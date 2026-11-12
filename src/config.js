/**
 * PickList - App Configuration
 * 
 * Update your Nifty referral URL or Google Tasks settings here anytime!
 */
const CONFIG = {
  // Your Nifty referral link to capture referral program commissions
  NIFTY_REFERRAL_URL: "https://nifty.ai/?referral=SOURCEDANDSOLD",

  // Stripe Payment Link for $29.99 Lifetime Access
  STRIPE_PAYMENT_LINK: "https://buy.stripe.com/4gM6oB1CdbNL1MI0h9dAk00",
  LICENSE_VERIFY_URL: "https://nifty-pull-list-auth.picklist-auth.workers.dev/api/license/verify",

  // One-time flat fee display price (or monthly fee depending on your Stripe setup)
  FLAT_FEE_PRICE: "$29.99",

  // Google Tasks Configuration (For non-Apple users on Windows, Android & ChromeOS)
  GOOGLE_TASKS_LIST_NAME: "Daily Pull List",
  GOOGLE_CLIENT_ID: "231991706388-ronnrq67mcfgg7e39aaj1rp7mop9obgc.apps.googleusercontent.com",
  GOOGLE_AUTH_PROXY_URL: "https://nifty-pull-list-auth.picklist-auth.workers.dev",

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
