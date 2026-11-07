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
Stop wasting time walking back and forth between racks, shelves, and bins. PickList automatically gathers your recent multi-channel sales across eBay, Poshmark, Mercari, Depop, Etsy, and Whatnot from Nifty, sorts them sequentially by physical warehouse SKU, and sends them straight to your Apple Reminders or Google Tasks checklist.

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
For questions, support, or feature requests, contact support@spencerreselling.com.

**Category** [REQUIRED]
Productivity

**Single Purpose** [REQUIRED]
Syncs sold items from Nifty into a SKU-sorted Apple Reminders checklist for physical inventory pulling.

**Primary Language** [REQUIRED]
English

## Graphics & Assets

| Asset | Dimensions | Status | Filename |
|-------|-----------|--------|----------|
| Store Icon [REQUIRED] | 128×128 PNG | ✅ Ready | icons/icon128.png |
| Screenshot 1 [REQUIRED] | 1280×800 or 640×400 | ⬜ Not created | |
| Screenshot 2 [RECOMMENDED] | 1280×800 or 640×400 | ⬜ Not created | |
| Small Promo Tile [RECOMMENDED] | 440×280 | ⬜ Not created | |

### Screenshot Notes
- Screenshot 1: Extension popup open showing active session status, SKU sorting preview, and one-click sync button.
- Screenshot 2: Apple Reminders app on macOS and iOS showing the compiled "Daily Pull List" sorted descending by SKU.

## Permissions Justification

| Permission | Type | Justification |
|------------|------|---------------|
| `cookies` | permissions | Used to read the existing authenticated session token from Nifty so the user does not need to manually enter credentials. |
| `alarms` | permissions | Used to schedule the automated 8:00 AM weekday pull list compilation in the background. |
| `storage` | permissions | Stores the last sync timestamp, item count, and user preferences locally on the device for status display. |
| `https://app.nifty.ai/*` | host_permissions | Allows reading the session cookie and verifying the active login state on Nifty. |
| `https://api.nifty.ai/*` | host_permissions | Allows retrieving recent sold orders directly from Nifty's order analytics endpoint. |
| `http://127.0.0.1:8989/*` | host_permissions | Allows communicating with the local macOS Reminders bridge daemon to insert items without manual Shortcuts configuration. |
| `http://localhost:8989/*` | host_permissions | Alternative loopback address for the local macOS Reminders bridge daemon. |
| `https://tasks.googleapis.com/*` | host_permissions | Communicates with the official Google Tasks API to create and manage pull list items. |
| `https://oauth2.googleapis.com/*` | host_permissions | Used for secure Google Tasks OAuth authentication token refresh. |
| `https://extensionpay.com/*` | host_permissions | Communicates with ExtensionPay API to verify flat-fee license purchase status and handle user login. |

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
`https://spencerreselling.com/privacy-policy` (or hosted `src/privacy.html`)

**Terms of Service URL** [RECOMMENDED]  
`https://spencerreselling.com/terms` (or hosted `src/terms.html`)

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
| 1.0.0 | 2026-11-02 | Initial production release with automated bridge and descending SKU sorting | Draft |
