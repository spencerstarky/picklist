# Chrome Web Store Listing — PickList

> Last Updated: 2026-11-06

## Store Listing

**Extension Name** [REQUIRED]
PickList : Daily Order Pulls for Nifty

**Short Name** [RECOMMENDED]
PickList

**Short Description** [REQUIRED]
Automatically sync sold inventory from Nifty into Apple Reminders and Google Tasks sorted by physical warehouse SKU for fast order pulling.

**Detailed Description** [REQUIRED]
Stop wasting time walking back and forth between racks, shelves, and bins. PickList automatically gathers your recent multi-channel sales from your connected Nifty account, sorts them sequentially by physical warehouse SKU, and sends them straight to your Apple Reminders or Google Tasks checklist.

Walk the floor with your iPhone or iPad every morning with a clean, ordered pull list ready to check off.

Key Features:
- Zero manual data entry: Connects with your active Nifty session without re-entering passwords.
- Physical storage sorting: Organize your pull list by numeric SKU sequence, bin/shelf location (A–Z), platform batching, or order time.
- Weekend catch-up: Automatically expands lookback on Monday mornings to capture all Friday-Sunday weekend orders.
- Native Apple Reminders & Google Tasks: Syncs directly to your "Daily Pull List", ready on your Mac, iPhone, iPad, Android, and desktop.
- Manual sync anytime: Pick a custom lookback window (24h, 48h, 72h, or 7 days) and sync on demand.

How to Use:
1. Make sure you are signed into your Nifty account in Google Chrome.
2. Click the PickList extension icon in your toolbar.
3. Choose your lookback window (or leave on Auto) and click "Sync Daily Pull List".
4. Open the Reminders or Tasks app on your device to view your sorted daily pull list.

Privacy & Security:
Your sales data stays completely private. All order processing, SKU sorting, and reminder syncing happen locally on your computer. No personal customer information, order history, or authentication tokens are ever sent to external third-party servers.

Support & Feedback:
For questions, support, or feature requests, contact picklist.help@gmail.com.

**Category** [REQUIRED]
Productivity

**Single Purpose** [REQUIRED]
Syncs sold items from Nifty into a SKU-sorted Apple Reminders or Google Tasks checklist for physical inventory pulling.

**Primary Language** [REQUIRED]
English

## Graphics & Assets

| Asset | Dimensions | Status | Filename |
|-------|-----------|--------|----------|
| Store Icon [REQUIRED] | 128×128 PNG | ✅ Ready | icons/icon128.png |
| Screenshot 1 [REQUIRED] | 1280×800 or 640×400 | ⬜ Not created | |
| Screenshot 2 [RECOMMENDED] | 1280×800 or 640×400 | ⬜ Not created | |
| Screenshot 3 [RECOMMENDED] | 1280×800 or 640×400 | ⬜ Not created | |
| Small Promo Tile [RECOMMENDED] | 440×280 | ⬜ Not created | |

### Screenshot Notes
- **Screenshot 1:** Extension popup open showing active session status, SKU sorting preview, and one-click sync button.
- **Screenshot 2:** Apple Reminders app on macOS and iOS showing the compiled "Daily Pull List" sorted descending by SKU.
- **Screenshot 3 (Toolbar Pinning):** Chrome toolbar showing the puzzle-piece extensions menu (🧩) with the pin icon highlighted next to PickList, showing users how to keep it one-click accessible.

## Permissions Justification

| Permission | Type | Justification |
|------------|------|---------------|
| `cookies` | permissions | Reads the existing session cookie from Nifty so the user is authenticated automatically without manual password entry. |
| `alarms` | permissions | Schedules the daily background pull list compilation (e.g. 8:00 AM) without keeping a persistent background tab open. |
| `storage` | permissions | Saves user sync preferences (lookback window, destination task app, last sync counts) locally on the device. |
| `identity` | permissions | Powers secure Google Tasks OAuth authentication via `chrome.identity.launchWebAuthFlow` without exposing API client secrets. |
| `tabs` | permissions | Detects active Nifty tabs to help the user connect their account and opens the setup walkthrough and guide pages. |
| `clipboardWrite` | permissions | Allows the user to one-click copy terminal commands and setup shortcuts from the onboarding and guide pages. |
| `https://app.nifty.ai/*` | host_permissions | Verifies active login state and session validity on Nifty web app. |
| `https://api.nifty.ai/*` | host_permissions | Retrieves the user's sold multi-channel orders from Nifty's order analytics endpoint. |
| `http://127.0.0.1:8989/*` | host_permissions | Communicates with the local macOS Reminders bridge daemon to insert pull list tasks. |
| `http://localhost:8989/*` | host_permissions | Loopback fallback address for the local macOS Reminders bridge daemon. |
| `https://tasks.googleapis.com/*` | host_permissions | Communicates with the official Google Tasks REST API to create and manage pull list items. |
| `https://www.googleapis.com/*` | host_permissions | Queries Google user profile and task list endpoints during Google Tasks integration. |
| `https://oauth2.googleapis.com/*` | host_permissions | Exchanges and refreshes Google OAuth tokens securely. |
| `https://*.chromiumapp.org/*` | host_permissions | OAuth redirect callback URL used by Chrome Identity (`launchWebAuthFlow`). |
| `https://*.workers.dev/*` | host_permissions | Secure Cloudflare proxy worker for license verification and Google Tasks OAuth token exchange without client secrets. |

## Privacy & Data Use

### Data Collection

**Does the extension collect user data?** No

All sales and order data is processed in-memory and transferred directly to the user's personal Apple Reminders or Google Tasks application. No customer data or order details are collected, stored remotely, or transmitted to any third-party analytics or external database servers.

### Data Use Certification
- [x] Data is NOT sold to third parties
- [x] Data is NOT used for purposes unrelated to the extension's core functionality
- [x] Data is NOT used for creditworthiness or lending purposes
- [x] Data is NOT used for advertising or marketing

## Privacy Policy & Terms

**Privacy Policy URL** [REQUIRED]  
`https://spencerstarky.github.io/picklist/privacy.html` (or `https://spencerreselling.com/privacy-policy`)

**Terms of Service URL** [RECOMMENDED]  
`https://spencerstarky.github.io/picklist/terms.html` (or `https://spencerreselling.com/terms`)

## Distribution

**Visibility**: Public (or Unlisted during testing)  
**Regions**: All regions  

## Developer Info

**Publisher / Brand Name** [REQUIRED]  
PickList

**Contact Email** [REQUIRED]  
support@spencerreselling.com

## Version History

| Version | Date | Changes | Status |
|---------|------|---------|--------|
| 1.0.0 | 2026-11-10 | Initial public store release with automated bridge and descending SKU sorting | Live |
| 1.0.1 | 2026-11-11 | Human-friendly error translation, disk space recovery handling, Nifty prerequisite notices, and upgraded partner deal flow | Ready for submission |
