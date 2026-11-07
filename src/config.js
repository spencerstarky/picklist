/**
 * PickList - App Configuration
 * 
 * Update your Nifty referral URL or Google Tasks settings here anytime!
 */
const CONFIG = {
  // Your Nifty referral link to capture referral program commissions
  NIFTY_REFERRAL_URL: "https://nifty.ai/?referral=SOURCEDANDSOLD",

  // Your ExtensionPay extension ID registered at https://extensionpay.com
  EXTPAY_ID: "nifty-pull-list",

  // One-time flat fee display price (or monthly fee depending on your Stripe setup)
  FLAT_FEE_PRICE: "$29",

  // Google Tasks Configuration (For non-Apple users on Windows, Android & ChromeOS)
  GOOGLE_TASKS_LIST_NAME: "Daily Pull List",
  GOOGLE_CLIENT_ID: "",
  GOOGLE_CLIENT_SECRET: "",

  // Official Apple Shortcut 1-Click Install link (Zero terminal, zero Gatekeeper)
  APPLE_SHORTCUT_ICLOUD_URL: "https://www.icloud.com/shortcuts/602f704bb9c045c0a46f42fc37a9a8bf"
};

// Make accessible in service workers & window contexts
if (typeof self !== "undefined") {
  self.CONFIG = CONFIG;
}
if (typeof window !== "undefined") {
  window.CONFIG = CONFIG;
}
if (typeof module !== "undefined" && module.exports) {
  module.exports = CONFIG;
}
