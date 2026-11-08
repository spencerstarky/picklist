#!/usr/bin/env python3
"""
Nifty Pull List - Local macOS Apple Reminders Bridge
Listens on http://127.0.0.1:8989/sync and dispatches items directly
into Apple Reminders ("Daily Pull List") using native AppleScript.
"""

import sys
import os
import json
import re
import subprocess
import argparse
from http.server import HTTPServer, BaseHTTPRequestHandler
import urllib.request
import urllib.error

DEFAULT_PORT = 8989
TARGET_LIST = "Daily Pull List"
PLIST_LABEL = "com.nifty.pulllist.bridge"
PLIST_PATH = os.path.expanduser(f"~/Library/LaunchAgents/{PLIST_LABEL}.plist")
LOG_PATH = os.path.expanduser("~/Library/Logs/nifty_bridge.log")


def run_applescript(script: str, timeout: int = 20) -> str:
    """Executes an AppleScript via osascript and returns stdout."""
    res = subprocess.run(
        ["osascript", "-e", script],
        capture_output=True,
        text=True,
        timeout=timeout,
        check=True
    )
    return res.stdout.strip()


def normalize_sku(text: str) -> str:
    """
    Extracts comparable deduplication key from a reminder title or raw SKU string.
    Supports:
    - Pure Numeric: "SKU 11053 — Jacket" -> "11053"
    - Location Bins: "[Bin B-104] — Sweater" -> "bin b-104"
    - Category / Room: "[Coats] — Trench" -> "coats"
    - No SKU: "[No SKU] — Levi 501" -> "nosku:levi 501"
    """
    if not text:
        return ""
    clean = text.strip()

    # Match [No SKU] — Title
    m_nosku = re.search(r"\[No SKU\]\s*—\s*(.+)", clean, re.IGNORECASE)
    if m_nosku:
        clean_title = re.sub(r"[^\w\s]", "", m_nosku.group(1)).lower().strip()
        return f"nosku:{clean_title}"

    # Match [Location/Bin] — Title
    m_bracket = re.search(r"^\[([A-Za-z0-9\s\-_/]+?)\]\s*—", clean)
    if m_bracket:
        return m_bracket.group(1).strip().lower()

    # Match SKU 11053 — Title
    m_sku = re.search(r"SKU\s*([A-Za-z0-9,\s\-_/]+?)\s*—", clean, re.IGNORECASE)
    raw = m_sku.group(1) if m_sku else clean
    raw_clean = raw.replace(",", "").strip()

    digits = re.search(r"^\d+$", raw_clean)
    if digits:
        return digits.group(0)

    # Alphanumeric or location bin name (e.g. Bin H, Coats, Shelf-3)
    return raw_clean.lower()


def check_reminders_access() -> bool:
    """Verifies that the Reminders app is accessible and list exists."""
    script = f'''
    tell application "Reminders"
        set listName to "{TARGET_LIST}"
        if not (exists list listName) then
            try
                set targetAcc to default account
                make new list with properties {{name:listName}} at targetAcc
            on error
                set targetAcc to first account
                make new list with properties {{name:listName}} at targetAcc
            end try
        end if
        return (name of list listName)
    end tell
    '''
    try:
        out = run_applescript(script, timeout=10)
        return out == TARGET_LIST
    except Exception as e:
        print(f"[Error] Failed to access Reminders: {e}", file=sys.stderr)
        return False


def get_existing_reminder_skus():
    """
    Retrieves all reminder titles (both completed and uncompleted)
    and returns a set of normalized SKUs.
    """
    script = f'''
    tell application "Reminders"
        set listName to "{TARGET_LIST}"
        if not (exists list listName) then
            try
                set targetAcc to default account
                make new list with properties {{name:listName}} at targetAcc
            on error
                set targetAcc to first account
                make new list with properties {{name:listName}} at targetAcc
            end try
        end if
        tell list listName
            set AppleScript's text item delimiters to "|||"
            return (name of every reminder) as text
        end tell
    end tell
    '''
    try:
        out = run_applescript(script, timeout=15)
        titles = [t.strip() for t in out.split("|||") if t.strip()]
        skus = set()
        for t in titles:
            k = normalize_sku(t)
            if k:
                skus.add(k)
        return skus
    except Exception as e:
        print(f"[Warning] Failed to fetch existing reminders: {e}", file=sys.stderr)
        return set()


def clean_duplicate_uncompleted():
    """
    Removes any uncompleted reminder if an identical SKU was already
    marked completed or pulled earlier today.
    """
    script = f'''
    tell application "Reminders"
        tell list "{TARGET_LIST}"
            set AppleScript's text item delimiters to "|||"
            set compNames to (name of every reminder whose completed is true) as text
            set uncompNames to (name of every reminder whose completed is false) as text
            return compNames & "###SECTION###" & uncompNames
        end tell
    end tell
    '''
    try:
        out = run_applescript(script, timeout=15)
        parts = out.split("###SECTION###")
        comp = [x.strip() for x in parts[0].split("|||") if x.strip()]
        uncomp = [x.strip() for x in parts[1].split("|||") if x.strip()] if len(parts) > 1 else []

        comp_skus = set()
        for c in comp:
            k = normalize_sku(c)
            if k:
                comp_skus.add(k)

        deleted_count = 0

        for u in uncomp:
            sku = normalize_sku(u)
            if sku and sku in comp_skus:
                safe_name = u.replace('\\', '\\\\').replace('"', '\\"')
                del_script = f'''
                tell application "Reminders"
                    tell list "{TARGET_LIST}"
                        delete (first reminder whose completed is false and name is "{safe_name}")
                    end tell
                end tell
                '''
                run_applescript(del_script, timeout=10)
                deleted_count += 1

        return {"success": True, "deleted": deleted_count, "remaining": len(uncomp) - deleted_count}
    except Exception as e:
        return {"success": False, "error": str(e)}


def extract_keys_from_reminder(name: str, body: str = "") -> set:
    """
    Extracts all possible deduplication keys from a reminder's title (name) and body (notes).
    Returns a set containing:
    - Order keys: "order:<order_id_lower>" and "order:<8_char_prefix>"
    - SKU keys: "sku:<normalized_sku>", "<normalized_sku>"
    - Numeric keys: "num:<sku_digits>"
    - Clean Title keys: "title:<clean_product_name>"
    """
    keys = set()
    clean_name = (name or "").strip()
    clean_body = (body or "").strip()

    # 1. Extract Order ID from body and name
    for text_source in (clean_body, clean_name):
        m_order = re.search(r"Order:\s*#?([A-Za-z0-9\-_]+)", text_source, re.IGNORECASE)
        if m_order:
            ord_id = m_order.group(1).strip().lower()
            keys.add(f"order:{ord_id}")
            if len(ord_id) > 8:
                keys.add(f"order:{ord_id[:8]}")

    # 2. Extract SKU / normalized SKU from title
    norm = normalize_sku(clean_name)
    if norm:
        keys.add(norm)
        keys.add(f"sku:{norm}")
        if norm.startswith("sku:"):
            keys.add(norm[4:].strip())

    # 3. Extract pure numeric rack digits (e.g. 10937 from SKU 10937 AP)
    m_digits = re.search(r"\b(\d{3,7})\b", clean_name)
    if m_digits:
        keys.add(f"num:{m_digits.group(1)}")

    # 4. Extract product title part (after '—' or '-')
    if "—" in clean_name:
        sub = clean_name.split("—", 1)[1]
        c = re.sub(r"[^\w\s]", "", sub).lower().strip()
        if c:
            keys.add(f"title:{c}")
    elif "-" in clean_name:
        sub = clean_name.split("-", 1)[1]
        c = re.sub(r"[^\w\s]", "", sub).lower().strip()
        if c:
            keys.add(f"title:{c}")

    return keys


def generate_item_keys(item: dict) -> set:
    """Generates all comparison keys for an incoming pull list item."""
    keys = set()
    order_id = str(item.get("orderId") or "").strip().lower()
    if order_id:
        keys.add(f"order:{order_id}")
        if len(order_id) > 8:
            keys.add(f"order:{order_id[:8]}")

    dedup = str(item.get("dedupKey") or "").strip().lower()
    if dedup:
        keys.add(dedup)
        if dedup.startswith("sku:"):
            keys.add(dedup[4:].strip())
        else:
            keys.add(f"sku:{dedup}")

    raw_sku = str(item.get("sku") or item.get("skuDisplay") or "").strip()
    norm = normalize_sku(raw_sku)
    if norm:
        keys.add(norm)
        keys.add(f"sku:{norm}")
        if norm.startswith("sku:"):
            keys.add(norm[4:].strip())

    sku_num = item.get("skuNum")
    try:
        if sku_num is not None and int(sku_num) > 0:
            keys.add(f"num:{int(sku_num)}")
    except (ValueError, TypeError):
        pass

    raw_title = str(item.get("title") or "").split("\n")[0].strip()
    clean_title = re.sub(r"[^\w\s]", "", raw_title).lower().strip()
    if clean_title:
        keys.add(f"title:{clean_title}")

    return keys


def get_completed_reminder_keys():
    """
    Retrieves multi-factor identifiers of reminders that have ALREADY been checked off/completed.
    Queries both name and body of completed reminders to extract Order IDs, SKUs, and Numbers.
    Ensures that pulled items are never re-added to the pull list.
    """
    script = f'''
    tell application "Reminders"
        set listName to "{TARGET_LIST}"
        if not (exists list listName) then
            return ""
        end if
        tell list listName
            set compReminders to (every reminder whose completed is true)
            set outList to {{}}
            repeat with r in compReminders
                set rName to name of r
                set rBody to ""
                try
                    set rBody to body of r
                    if rBody is missing value then set rBody to ""
                end try
                set end of outList to (rName & ":::" & rBody)
            end repeat
            set AppleScript's text item delimiters to "|||"
            return outList as text
        end tell
    end tell
    '''
    try:
        out = run_applescript(script, timeout=15)
        entries = [t.strip() for t in out.split("|||") if t.strip()]
        all_keys = set()
        for entry in entries:
            parts = entry.split(":::", 1)
            name = parts[0]
            body = parts[1] if len(parts) > 1 else ""
            extracted = extract_keys_from_reminder(name, body)
            all_keys.update(extracted)
        return all_keys
    except Exception as e:
        print(f"[Warning] Failed to fetch completed reminders: {e}", file=sys.stderr)
        return set()


def get_completed_reminder_skus():
    """Backward compatibility wrapper returning normalized SKUs."""
    return get_completed_reminder_keys()


def sync_items_to_reminders(items, clear_existing: bool = True, skip_completed: bool = True, persisted_keys: list = None):
    """
    Inserts a list of items into the target Apple Reminders list in exact sorted order.
    1. Checks all COMPLETED reminders (pulled items) and skips them so they are never re-added.
    2. Clears only UNCOMPLETED reminders and re-inserts the current active batch in one single pass.
       This guarantees that Reminders displays items in exact descending order, even when orders
       are synced in multiple batches throughout the day.
    """
    if not items:
        return {"created": 0, "skipped": 0, "total": 0, "completedKeys": []}

    # Fetch multi-factor keys of completed reminders from Apple Reminders
    completed_keys = get_completed_reminder_keys() if skip_completed else set()

    # Merge in any persisted completed keys from previous syncs/Google Tasks
    if persisted_keys and skip_completed:
        for pk in persisted_keys:
            if pk:
                completed_keys.add(str(pk).strip().lower())

    formatted_to_create = []
    skipped_count = 0
    seen_in_batch = set()

    for item in items:
        item_keys = generate_item_keys(item)
        raw_sku = str(item.get("sku") or item.get("skuDisplay") or "No SKU").strip()
        raw_title = str(item.get("title") or "Untitled Item").split("\n")[0].strip()[:80]
        marketplace = str(item.get("marketplace") or "Nifty").strip()
        price = str(item.get("price") or "0.00").strip()
        order_id = str(item.get("orderId") or "").strip()

        # Deduplication key for within-batch uniqueness
        batch_key = item.get("dedupKey") or (f"order:{order_id}" if order_id else f"sku:{raw_sku}")

        # If already marked off/completed earlier, skip it!
        if skip_completed and (item_keys & completed_keys):
            skipped_count += 1
            continue

        # Prevent duplicate entries within the same incoming payload
        if batch_key in seen_in_batch:
            continue
        seen_in_batch.add(batch_key)

        # Clean display title formatting
        sku_display = str(item.get("skuDisplay") or "").strip()
        if not sku_display:
            if raw_sku.startswith("[") and raw_sku.endswith("]"):
                sku_display = raw_sku
            elif raw_sku.lower() in ["no sku", "none", "n/a", "[no sku]"]:
                sku_display = "[No SKU]"
            elif raw_sku.lower().startswith("sku"):
                sku_display = raw_sku
            else:
                m_num = re.match(r"^(\d+)(.*)$", raw_sku)
                loc_match = re.match(r"^(bin|shelf|box|tub|tote|rack|room|aisle|drawer|floor|bay|row)\b", raw_sku, re.IGNORECASE)
                if m_num and not loc_match:
                    num = m_num.group(1)
                    suf = m_num.group(2).strip()
                    clean_suf = f" {suf}" if suf else ""
                    sku_display = f"SKU {num}{clean_suf}"
                else:
                    sku_display = f"[{raw_sku}]"

        rem_title = f"{sku_display} — {raw_title}"

        location_tag = str(item.get("locationTag") or "").strip()
        location_info = f" | Location: {location_tag}" if location_tag else ""
        order_info = f" | Order: #{order_id[:8]}" if order_id else ""
        rem_notes = f"Platform: {marketplace} | Price: ${price}{location_info}{order_info}"

        safe_title = rem_title.replace('\\', '\\\\').replace('"', '\\"')
        safe_notes = rem_notes.replace('\\', '\\\\').replace('"', '\\"')
        formatted_to_create.append({
            "title": safe_title,
            "notes": safe_notes,
            "sku_key": batch_key
        })

    lines = [
        'tell application "Reminders"',
        f'    set listName to "{TARGET_LIST}"',
        '    if not (exists list listName) then',
        '        try',
        '            set targetAcc to default account',
        '            make new list with properties {name:listName} at targetAcc',
        '        on error',
        '            set targetAcc to first account',
        '            make new list with properties {name:listName} at targetAcc',
        '        end try',
        '    end if',
        '    set targetList to list listName',
        '    tell targetList to delete (every reminder whose completed is false)',
    ]

    for entry in formatted_to_create:
        t = entry["title"]
        n = entry["notes"]
        lines.append(f'    tell targetList to make new reminder with properties {{name:"{t}", body:"{n}"}}')

    lines.append('    return "OK"')
    lines.append('end tell')

    full_script = "\n".join(lines)
    run_applescript(full_script, timeout=30)

    return {
        "created": len(formatted_to_create),
        "skipped": skipped_count,
        "total": len(items),
        "targetList": TARGET_LIST,
        "completedKeys": list(completed_keys)
    }


class BridgeRequestHandler(BaseHTTPRequestHandler):
    def _send_cors_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")

    def do_OPTIONS(self):
        self.send_response(200)
        self._send_cors_headers()
        self.end_headers()

    def do_GET(self):
        if self.path in ("/health", "/status", "/"):
            has_access = check_reminders_access()
            data = {
                "status": "ok" if has_access else "error",
                "service": "Nifty Pull List Bridge",
                "targetList": TARGET_LIST,
                "remindersConnected": has_access
            }
            body = json.dumps(data).encode("utf-8")
            self.send_response(200 if has_access else 500)
            self._send_cors_headers()
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        else:
            self.send_response(404)
            self._send_cors_headers()
            self.end_headers()

    def do_POST(self):
        if self.path == "/clean-duplicates" or self.path == "/cleanup":
            res = clean_duplicate_uncompleted()
            body = json.dumps(res).encode("utf-8")
            self.send_response(200 if res.get("success") else 500)
            self._send_cors_headers()
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return

        if self.path == "/sync":
            try:
                content_len = int(self.headers.get("Content-Length", 0))
                raw_body = self.rfile.read(content_len).decode("utf-8")
                payload = json.loads(raw_body) if raw_body else {}

                if isinstance(payload, list):
                    items = payload
                    clear_existing = False
                    skip_completed = True
                    persisted_keys = []
                elif isinstance(payload, dict):
                    items = payload.get("items", [])
                    clear_existing = payload.get("clearExisting", False)
                    skip_completed = payload.get("skipCompleted", True)
                    persisted_keys = payload.get("persistedCompletedKeys", [])
                else:
                    items = []
                    clear_existing = False
                    skip_completed = True
                    persisted_keys = []

                res = sync_items_to_reminders(
                    items,
                    clear_existing=clear_existing,
                    skip_completed=skip_completed,
                    persisted_keys=persisted_keys
                )
                response_data = {
                    "success": True,
                    **res
                }
                body = json.dumps(response_data).encode("utf-8")
                self.send_response(200)
                self._send_cors_headers()
                self.send_header("Content-Type", "application/json")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)
            except Exception as e:
                err_data = {"success": False, "error": str(e)}
                body = json.dumps(err_data).encode("utf-8")
                self.send_response(500)
                self._send_cors_headers()
                self.send_header("Content-Type", "application/json")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)
        else:
            self.send_response(404)
            self._send_cors_headers()
            self.end_headers()

    def log_message(self, format, *args):
        sys.stdout.write(f"[Bridge] {self.address_string()} - {format % args}\n")
        sys.stdout.flush()


def run_server(port: int):
    server_address = ("127.0.0.1", port)
    httpd = HTTPServer(server_address, BridgeRequestHandler)
    print(f"🚀 Nifty Pull List Bridge running on http://127.0.0.1:{port}")
    print(f"📋 Target Reminders List: '{TARGET_LIST}'")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping bridge server...")
        httpd.server_close()


def check_status(port: int = DEFAULT_PORT):
    try:
        req = urllib.request.Request(f"http://127.0.0.1:{port}/health")
        with urllib.request.urlopen(req, timeout=2) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            print(f"✅ Bridge is running on http://127.0.0.1:{port}")
            print(f"   Status: {data.get('status')}")
            print(f"   Reminders Access: {data.get('remindersConnected')}")
            print(f"   Target List: {data.get('targetList')}")
            return True
    except Exception as e:
        print(f"❌ Bridge is NOT running on port {port} ({e})")
        return False


def install_service(port: int = DEFAULT_PORT):
    script_path = os.path.abspath(__file__)
    python_path = sys.executable

    os.makedirs(os.path.dirname(PLIST_PATH), exist_ok=True)
    os.makedirs(os.path.dirname(LOG_PATH), exist_ok=True)

    plist_content = f"""<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>{PLIST_LABEL}</string>
    <key>ProgramArguments</key>
    <array>
        <string>{python_path}</string>
        <string>{script_path}</string>
        <string>--port</string>
        <string>{port}</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>{LOG_PATH}</string>
    <key>StandardErrorPath</key>
    <string>{LOG_PATH}</string>
</dict>
</plist>
"""
    with open(PLIST_PATH, "w") as f:
        f.write(plist_content)

    subprocess.run(["launchctl", "unload", PLIST_PATH], capture_output=True)
    res = subprocess.run(["launchctl", "load", PLIST_PATH], capture_output=True, text=True)
    if res.returncode == 0:
        print(f"✅ Successfully reloaded {PLIST_LABEL} as background daemon!")
    else:
        print(f"⚠️ launchctl load: {res.stderr}")


def uninstall_service():
    if os.path.exists(PLIST_PATH):
        subprocess.run(["launchctl", "unload", PLIST_PATH], capture_output=True)
        os.remove(PLIST_PATH)
        print(f"✅ Unloaded and removed {PLIST_PATH}")


def main():
    parser = argparse.ArgumentParser(description="Nifty Pull List - Apple Reminders Bridge")
    parser.add_argument("--port", type=int, default=DEFAULT_PORT, help=f"HTTP port (default {DEFAULT_PORT})")
    parser.add_argument("--status", action="store_true", help="Check if bridge is running")
    parser.add_argument("--cleanup", action="store_true", help="Clean uncompleted reminders whose SKU is already completed")
    parser.add_argument("--install-service", action="store_true", help="Install / update LaunchAgent daemon")
    parser.add_argument("--uninstall-service", action="store_true", help="Uninstall LaunchAgent service")

    args = parser.parse_args()

    if args.status:
        check_status(args.port)
        return
    if args.cleanup:
        res = clean_duplicate_uncompleted()
        print("Cleanup result:", res)
        return
    if args.install_service:
        install_service(args.port)
        return
    if args.uninstall_service:
        uninstall_service()
        return

    run_server(args.port)


if __name__ == "__main__":
    main()
