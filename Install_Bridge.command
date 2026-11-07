#!/bin/bash
# ==============================================================================
# PickList - 1-Click macOS Apple Reminders Bridge Installer
# Author: Spencer Starkweather
# ==============================================================================

# Ensure Terminal stays open if double-clicked from Finder
trap 'echo ""; echo "Press [Enter] to close this window..."; read -r' EXIT

echo "=================================================================="
echo "  ⚡ PickList - Apple Reminders Bridge Setup"
echo "=================================================================="
echo ""
echo "This installer configures the silent background service (LaunchAgent)"
echo "so your Nifty pull lists sync directly into Apple Reminders on your Mac."
echo ""

# Find current script directory
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
APP_DIR="$HOME/Library/Application Support/NiftyPullList"
mkdir -p "$APP_DIR"
DEST_BRIDGE_PY="$APP_DIR/bridge.py"

# Locate source bridge.py
SRC_BRIDGE_PY=""
if [ -f "$DIR/src/bridge.py" ]; then
  SRC_BRIDGE_PY="$DIR/src/bridge.py"
elif [ -f "$DIR/bridge.py" ]; then
  SRC_BRIDGE_PY="$DIR/bridge.py"
elif [ -f "$HOME/antigravity/nifty-pull-list/src/bridge.py" ]; then
  SRC_BRIDGE_PY="$HOME/antigravity/nifty-pull-list/src/bridge.py"
elif [ -f "$DEST_BRIDGE_PY" ]; then
  SRC_BRIDGE_PY="$DEST_BRIDGE_PY"
fi

# Verify Python 3
if ! command -v python3 &> /dev/null; then
  echo "❌ Error: python3 is not installed or not in PATH."
  echo "macOS comes with Python 3, or you can install it via: xcode-select --install"
  exit 1
fi

PYTHON_BIN="$(which python3)"
echo "✓ Python detected: $PYTHON_BIN"

if [ -n "$SRC_BRIDGE_PY" ] && [ "$SRC_BRIDGE_PY" != "$DEST_BRIDGE_PY" ]; then
  echo "📦 Copying bridge helper to permanent directory ($APP_DIR)..."
  cp "$SRC_BRIDGE_PY" "$DEST_BRIDGE_PY"
  chmod +x "$DEST_BRIDGE_PY"
fi

if [ ! -f "$DEST_BRIDGE_PY" ]; then
  echo "❌ Error: Could not install bridge.py."
  exit 1
fi

echo "✓ Bridge located at: $DEST_BRIDGE_PY"
echo ""
echo "📦 Installing background LaunchAgent daemon..."
"$PYTHON_BIN" "$DEST_BRIDGE_PY" --install-service

echo ""
echo "⏳ Waiting 1 second for background service to initialize..."
sleep 1

echo ""
echo "🔍 Verifying bridge health & Apple Reminders access..."
"$PYTHON_BIN" "$DEST_BRIDGE_PY" --status

echo ""
echo "=================================================================="
echo "🎉 Setup complete! The bridge is now running silently in the background."
echo "It will automatically start whenever your Mac boots up."
echo ""
echo "📱 MULTI-DEVICE IPHONE SYNC REMINDER:"
echo "To ensure your pull list syncs to your phone when walking the floor:"
echo "1. On this Mac: System Settings -> Apple Account -> iCloud -> Reminders (ON)"
echo "2. On your iPhone/iPad: Settings -> Apple Account -> iCloud -> Reminders (ON)"
echo "(Make sure both devices use the same Apple Account!)"
echo ""
echo "You can return to the Chrome onboarding walkthrough now."
echo "=================================================================="
