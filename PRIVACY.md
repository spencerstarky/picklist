# Privacy Policy — PickList

> **Effective Date:** November 6, 2026  
> **Version:** 1.0  
> **Hosted URL:** `src/privacy.html` / `https://spencerreselling.com/privacy-policy`

---

## Core Privacy Architecture: Local-First & Zero-Knowledge

PickList is built with an absolute local-first architecture. All parsing of order details, SKU calculations, and pull list sequencing execute **100% locally on your computer** within the Google Chrome Extension sandbox. Your sales data, buyer names, financial amounts, and order histories are never collected, stored, or transmitted to any third-party analytics or external database servers.

---

## 1. Information Accessed & Processed

### A. Sales & Order Information (via Nifty Session)
- **What is accessed:** When you initiate a sync, PickList reads recent sales summaries (item titles, SKU numbers, sale prices, marketplace platform sources such as eBay, Poshmark, Mercari, Depop, Etsy, Whatnot, and order timestamps) through your existing, active browser session with Nifty (`api.nifty.ai`).
- **How it is processed:** This data is held transiently in local computer RAM, sequenced according to your physical storage layout (numeric racks, alpha-numeric bins, shelves), and formatted into checklist items.
- **Where it goes:** Output is dispatched directly to your chosen task system (Apple Reminders via local bridge/macOS Shortcuts, or Google Tasks via direct Google API). No intermediate server ever receives this information.

### B. Google Tasks & Google Account Data
- **Scope Requested:** `https://www.googleapis.com/auth/tasks`
- **Purpose:** Used strictly to create and manage the user's designated `"Daily Pull List"` task list, insert sequenced order items, and check for existing tasks to avoid duplicate reminders.
- **Token Security:** OAuth 2.0 access and refresh tokens are stored securely in the browser's local sandbox using Chrome's native `chrome.identity` and `chrome.storage.local` APIs. Tokens are never transmitted to any external server.

### C. Extension Settings & Local Cache
- Configuration settings (such as chosen task destination, sorting mode, lookback window, and last sync timestamp) are saved exclusively to `chrome.storage.local`.

### D. Payment Information
- Lifetime license purchases are handled securely through **Stripe**.
- PickList never receives, handles, or stores credit card numbers, CVVs, or financial details. Stripe provides only a customer identifier and license confirmation status.

---

## 2. Google API Services User Data Policy (Limited Use Disclosure)

PickList's use and transfer to any other app of information received from Google APIs will adhere to the [Google API Services User Data Policy](https://developers.google.com/terms/api-services-user-data-policy), including the Limited Use requirements:
1. We only use access to Google Tasks to read and write to your designated PickList task list.
2. We do not transfer Google user data to any third party.
3. We do not use Google user data for serving advertisements.
4. We do not allow humans to read Google user data unless required for security investigations or under explicit user request for technical support.

---

## 3. Data Sharing & Third Parties

- **No Sale of Data:** We do not sell, rent, license, or disclose your personal information or your buyers' information to third parties, data brokers, or advertisers for any reason.
- **No Third-Party Trackers:** PickList does not load tracking pixels, telemetry beacons, ad networks, or third-party analytics.
- **Direct Encrypted Calls:** All network communication is conducted via direct, encrypted HTTPS connections with:
  - `api.nifty.ai` (your inventory platform)
  - `tasks.googleapis.com` (official Google Tasks API)
  - `*.workers.dev` (secure license verification)

---

## 4. Data Retention & Deletion

- **Zero Remote Retention:** Because no customer data is sent to our servers, we hold no database of your sales records.
- **Local Removal:** Removing the extension from your browser (`chrome://extensions` → Remove) instantly and permanently purges all locally cached preferences, timestamps, and stored tokens.
- **Revoking Google Access:** You can revoke PickList's access to your Google account at any time at [https://myaccount.google.com/permissions](https://myaccount.google.com/permissions).

---

## 5. Contact Information

For questions or inquiries regarding this Privacy Policy:
- **Email:** `picklist.help@gmail.com`
- **GitHub / Website:** `https://github.com/spencerstarky/picklist`
