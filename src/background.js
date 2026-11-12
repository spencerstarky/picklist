/**
 * PickList - Background Service Worker (Manifest V3)
 * Author: Spencer Starkweather
 * Version: 1.0.0
 * Supports Apple Reminders & Google Tasks destinations
 */

const NIFTY_APP_URL = "https://app.nifty.ai";
const NIFTY_API_HOST = "https://api.nifty.ai";
const COOKIE_NAME = "__Secure-nifty.session_token";
const BRIDGE_URL = "http://127.0.0.1:8989";
const GOOGLE_TASKS_API = "https://tasks.googleapis.com/tasks/v1";

importScripts('config.js');

// Automatically open onboarding walkthrough on first extension install
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    chrome.tabs.create({ url: chrome.runtime.getURL("src/onboarding.html") });
  }
});

/**
 * Retrieves the Nifty session token from Chrome cookies.
 */
async function getSessionToken() {
  try {
    let cookie = await chrome.cookies.get({
      url: NIFTY_APP_URL,
      name: COOKIE_NAME
    });

    if (!cookie) {
      cookie = await chrome.cookies.get({
        url: NIFTY_API_HOST,
        name: COOKIE_NAME
      });
    }

    if (!cookie) {
      const allCookies = await chrome.cookies.getAll({ name: COOKIE_NAME });
      if (allCookies && allCookies.length > 0) {
        cookie = allCookies[0];
      }
    }

    if (cookie && cookie.value) {
      try {
        await chrome.cookies.set({
          url: NIFTY_API_HOST,
          name: COOKIE_NAME,
          value: cookie.value,
          secure: true,
          sameSite: "no_restriction"
        });
      } catch (err) {}
      return cookie.value;
    }

    return null;
  } catch (err) {
    console.error("[NiftySync] Cookie retrieval error:", err);
    return null;
  }
}

/**
 * Checks if the local macOS Python Reminders bridge is active and reachable.
 */
async function checkBridgeStatus() {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);
    const resp = await fetch(`${BRIDGE_URL}/health`, {
      method: "GET",
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    if (resp.ok) {
      const data = await resp.json();
      return { connected: true, data };
    }
    return { connected: false };
  } catch (err) {
    return { connected: false, error: err.message };
  }
}

/**
 * Translates low-level browser, OS, and network exceptions into human-friendly messages.
 */
function formatFriendlyError(raw) {
  if (!raw) return "An unexpected error occurred. Please try again.";
  const msg = typeof raw === "string" ? raw : (raw.message || String(raw));

  // 1. Out of disk space (Chrome LevelDB / OS disk errors)
  if (
    msg.includes("FILE_ERROR_NO_SPACE") ||
    msg.includes("NO_SPACE") ||
    msg.includes("ENOSPC") ||
    /disk.*full/i.test(msg) ||
    /no space left/i.test(msg)
  ) {
    return "⚠️ Your Mac is out of disk space. Please empty your Trash or delete unused files to allow Chrome to save data.";
  }

  // 2. Chrome storage quota exceeded
  if (msg.includes("QUOTA_BYTES") || msg.includes("QUOTA_EXCEEDED")) {
    return "⚠️ Extension storage limit reached. Please clear old completed items or sync history.";
  }

  // 3. LevelDB internal database corruption / lock error
  if (msg.includes("IO error") || msg.includes("LevelDB") || msg.includes("ChromeMethodBFE")) {
    return "⚠️ Chrome storage error. Please restart Google Chrome or check free disk space.";
  }

  // 4. Network offline / server unreachable
  if (
    msg.includes("Failed to fetch") ||
    msg.includes("NetworkError") ||
    msg.includes("ERR_INTERNET_DISCONNECTED") ||
    msg.includes("ERR_NETWORK_CHANGED")
  ) {
    return "⚠️ Network connection issue. Please check your internet connection and try again.";
  }

  // 5. Nifty auth/session expired
  if (
    msg.includes("401") ||
    msg.includes("Unauthorized") ||
    msg.includes("Invalid session") ||
    msg.includes("Please log into Nifty")
  ) {
    return "⚠️ Your Nifty session expired. Please sign into Nifty in Chrome and try again.";
  }

  // 6. Bridge connection refused
  if (msg.includes("ECONNREFUSED") || msg.includes("127.0.0.1:8989") || msg.includes("localhost:8989")) {
    return "⚠️ Apple Reminders bridge is offline. Launch the bridge or switch to Apple Shortcuts mode.";
  }

  // 7. Google Tasks permission/token expired
  if (msg.includes("invalid_grant") || msg.includes("Token expired") || msg.includes("403")) {
    return "⚠️ Google Tasks authorization expired. Click the Google Tasks button to reconnect.";
  }

  return msg;
}

/**
 * Intelligently classifies and formats an item's inventory tracking system:
 * Handles:
 * 1. Pure Numeric SKUs: "11053", "8109", "SKU 10464" -> bucket 1
 * 2. Location & Bin Systems: "Bin B-104", "Rack 3", "Shelf A", "Coats", "Storage" -> bucket 2
 * 3. No SKU / Missing / Un-inventoried: null, "", "none", "no sku", "n/a", "0" -> bucket 3
 */
function parseInventoryItem(skuRaw, title = "", orderId = "") {
  const emptyValues = new Set(["", "none", "no sku", "nosku", "n/a", "null", "undefined", "-", "0"]);
  const cleanStr = String(skuRaw || "").replace(/,/g, "").trim();

  // Case 1: No SKU or empty/placeholder string
  if (!cleanStr || emptyValues.has(cleanStr.toLowerCase())) {
    return {
      hasSku: false,
      systemType: "none",
      skuDisplay: "[No SKU]",
      skuNum: -1,
      skuSuffix: "",
      locationTag: "",
      sortBucket: 3,
      dedupKey: `nosku:${orderId || ''}:${title.toLowerCase().trim()}`
    };
  }

  // Explicit location bin keywords (Bins, Shelves, Rooms, Racks, Boxes)
  const locationPrefixRegex = /^(bin|shelf|box|tub|tote|rack|room|aisle|drawer|floor|bay|row)\b/i;
  const isExplicitLocation = locationPrefixRegex.test(cleanStr.trim());

  // Strip common prefix like "SKU", "SKU:", "SKU-", "#", etc.
  const strippedOfPrefix = cleanStr.replace(/^(sku[:\s\-_#]*|#)/i, "").trim();

  // Case 2: Numeric SKU or Numeric SKU with suffix/descriptor (e.g. "11022", "10937 AP", "10937-A", "10937B")
  const numMatch = strippedOfPrefix.match(/^(\d+)(.*)$/);

  if (!isExplicitLocation && numMatch) {
    const skuNum = parseInt(numMatch[1], 10);
    const rawSuffix = (numMatch[2] || "").trim();
    let displaySuffix = "";
    if (rawSuffix) {
      const cleanSuffix = rawSuffix.replace(/^[-_:/]+/, "").trim();
      displaySuffix = rawSuffix.startsWith("-") || rawSuffix.startsWith("_")
        ? ` - ${cleanSuffix}`
        : ` ${cleanSuffix}`;
    }

    return {
      hasSku: true,
      systemType: "numeric",
      skuDisplay: `SKU ${skuNum}${displaySuffix}`.trim(),
      skuNum,
      skuSuffix: rawSuffix.toLowerCase(),
      locationTag: "",
      sortBucket: 1,
      dedupKey: `sku:${skuNum}${displaySuffix}`.toLowerCase()
    };
  }

  // Case 3: Location, Bin, Shelf, Rack, Room, or Named Category
  let cleanLocation = cleanStr;
  if (/^sku[:\s\-_#]+/i.test(cleanLocation)) {
    cleanLocation = cleanLocation.replace(/^sku[:\s\-_#]+/i, "").trim();
  }
  cleanLocation = cleanLocation.replace(/^[\[\(]+|[\]\)]+$/g, "").trim();

  const embeddedDigits = cleanLocation.match(/\d+/);
  const locationNum = embeddedDigits ? parseInt(embeddedDigits[0], 10) : -1;

  return {
    hasSku: true,
    systemType: "location",
    skuDisplay: `[${cleanLocation}]`,
    skuNum: locationNum,
    skuSuffix: "",
    locationTag: cleanLocation,
    sortBucket: 2,
    dedupKey: cleanLocation.toLowerCase()
  };
}

// -------------------------------------------------------------
// Google Tasks Integration (For Universal / Windows / Android)
// -------------------------------------------------------------

/**
 * Extracts authorization code or error from a Google OAuth redirect URL.
 */
function extractAuthCodeFromUrl(redirectedUrl) {
  if (!redirectedUrl) return null;
  const url = new URL(redirectedUrl);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error") || (url.hash && new URLSearchParams(url.hash.replace(/^#/, "")).get("error"));
  const errorDesc = url.searchParams.get("error_description") || (url.hash && new URLSearchParams(url.hash.replace(/^#/, "")).get("error_description"));

  if (error) {
    throw new Error(errorDesc || error);
  }
  return code;
}

/**
 * Exchanges an authorization code for access_token and permanent refresh_token.
 */
async function exchangeCodeForTokens(code, redirectUri) {
  const proxyUrl = (typeof CONFIG !== "undefined" && CONFIG.GOOGLE_AUTH_PROXY_URL)
    ? CONFIG.GOOGLE_AUTH_PROXY_URL
    : null;

  let data;

  if (proxyUrl) {
    // 1. Production Mode: Cloudflare Auth Proxy (zero secrets in extension bundle)
    const resp = await fetch(`${proxyUrl}/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, redirect_uri: redirectUri })
    });
    data = await resp.json();
    if (!resp.ok) {
      throw new Error(data.error_description || data.error || `Token exchange failed (HTTP ${resp.status})`);
    }
  } else {
    // 2. Fallback Mode: Direct Google exchange (requires client secret in config)
    const manifest = chrome.runtime.getManifest();
    const clientId = manifest.oauth2?.client_id || (typeof CONFIG !== "undefined" ? CONFIG.GOOGLE_CLIENT_ID : "");
    const clientSecret = (typeof CONFIG !== "undefined" && CONFIG.GOOGLE_CLIENT_SECRET)
      ? CONFIG.GOOGLE_CLIENT_SECRET
      : "";

    if (!clientId || !clientSecret) {
      throw new Error("Google OAuth configuration error: Auth proxy or Client Secret is missing in config.js.");
    }

    const params = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code: code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri
    });

    const resp = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString()
    });

    data = await resp.json();
    if (!resp.ok) {
      throw new Error(data.error_description || data.error || `Token exchange failed (HTTP ${resp.status})`);
    }
  }

  const accessToken = data.access_token;
  const refreshToken = data.refresh_token;
  const expiresIn = parseInt(data.expires_in || "3600", 10);

  const storageUpdate = {
    google_access_token: accessToken,
    google_token_expiry: Date.now() + (expiresIn * 1000),
    googleConnected: true
  };
  if (refreshToken) {
    storageUpdate.google_refresh_token = refreshToken;
  }
  await chrome.storage.local.set(storageUpdate);

  return accessToken;
}

/**
 * Silently refreshes an expired access token using the stored permanent refresh_token.
 */
async function refreshGoogleAccessToken(refreshToken) {
  const proxyUrl = (typeof CONFIG !== "undefined" && CONFIG.GOOGLE_AUTH_PROXY_URL)
    ? CONFIG.GOOGLE_AUTH_PROXY_URL
    : null;

  let data;

  if (proxyUrl) {
    // 1. Production Mode: Cloudflare Auth Proxy (zero secrets in extension bundle)
    const resp = await fetch(`${proxyUrl}/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken })
    });
    data = await resp.json();
    if (!resp.ok) {
      throw new Error(data.error_description || data.error || `Token refresh failed (HTTP ${resp.status})`);
    }
  } else {
    // 2. Fallback Mode: Direct Google exchange (requires client secret in config)
    const manifest = chrome.runtime.getManifest();
    const clientId = manifest.oauth2?.client_id || (typeof CONFIG !== "undefined" ? CONFIG.GOOGLE_CLIENT_ID : "");
    const clientSecret = (typeof CONFIG !== "undefined" && CONFIG.GOOGLE_CLIENT_SECRET)
      ? CONFIG.GOOGLE_CLIENT_SECRET
      : "";

    if (!clientId || !clientSecret) {
      throw new Error("Google OAuth configuration error: Auth proxy or Client Secret is missing in config.js.");
    }

    const params = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token"
    });

    const resp = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString()
    });

    data = await resp.json();
    if (!resp.ok) {
      throw new Error(data.error_description || data.error || `Token refresh failed (HTTP ${resp.status})`);
    }
  }

  const newAccessToken = data.access_token;
  const expiresIn = parseInt(data.expires_in || "3600", 10);

  await chrome.storage.local.set({
    google_access_token: newAccessToken,
    google_token_expiry: Date.now() + (expiresIn * 1000),
    googleConnected: true
  });

  return newAccessToken;
}

/**
 * Retrieves a valid Google OAuth access token.
 * If token is expired, silently refreshes in the background using the permanent refresh_token.
 * Interactive login is only invoked once upon initial connection.
 */
async function getGoogleAuthToken(interactive = false) {
  // 1. Check storage for valid, non-expired cached access token
  const stored = await chrome.storage.local.get([
    "google_access_token",
    "google_refresh_token",
    "google_token_expiry",
    "googleConnected"
  ]);
  const now = Date.now();

  if (stored.google_access_token && stored.google_token_expiry && stored.google_token_expiry > now + 60000) {
    return stored.google_access_token;
  }

  // 2. If access token is expired, silently refresh in the background using permanent refresh_token (zero popups)
  if (stored.google_refresh_token) {
    try {
      const refreshedToken = await refreshGoogleAccessToken(stored.google_refresh_token);
      if (refreshedToken) {
        return refreshedToken;
      }
    } catch (refreshErr) {
      console.warn("[NiftySync] Silent token refresh failed:", refreshErr);
      if (refreshErr.message && refreshErr.message.includes("invalid_grant")) {
        // User revoked permissions in Google account
        await chrome.storage.local.remove(["google_access_token", "google_refresh_token", "google_token_expiry"]);
        await chrome.storage.local.set({ googleConnected: false });
      }
    }
  }

  // 3. Non-interactive requests (background alarms, status queries) return null if not authenticated
  if (!interactive) {
    return null;
  }

  // 4. Interactive authorization (initial connection): Request offline access for permanent refresh_token
  const manifest = chrome.runtime.getManifest();
  const clientId = manifest.oauth2?.client_id || (typeof CONFIG !== "undefined" ? CONFIG.GOOGLE_CLIENT_ID : "");
  const redirectUri = chrome.identity.getRedirectURL(); // e.g. https://<ext-id>.chromiumapp.org/
  const scopes = (manifest.oauth2?.scopes && manifest.oauth2.scopes.length > 0)
    ? manifest.oauth2.scopes.join(" ")
    : "https://www.googleapis.com/auth/tasks";

  const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("access_type", "offline");
  authUrl.searchParams.set("prompt", "consent");
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("scope", scopes);

  return new Promise((resolve, reject) => {
    let resolved = false;
    const width = 550;
    const height = 700;

    // Helper fallback for launchWebAuthFlow
    const runLaunchWebAuthFlow = () => {
      if (!chrome.identity || !chrome.identity.launchWebAuthFlow) {
        return reject(new Error("Google OAuth is not available in this browser environment."));
      }
      chrome.identity.launchWebAuthFlow(
        { url: authUrl.href, interactive: true },
        async (redirectedUrl) => {
          if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
          if (!redirectedUrl) return reject(new Error("Google sign-in was closed or cancelled."));
          try {
            const code = extractAuthCodeFromUrl(redirectedUrl);
            if (!code) {
              throw new Error("No authorization code was returned by Google.");
            }
            const token = await exchangeCodeForTokens(code, redirectUri);
            resolve(token);
          } catch (err) {
            reject(err);
          }
        }
      );
    };

    // Use chrome.windows.create to explicitly open window at full 550x700 size
    if (chrome.windows && chrome.windows.create) {
      chrome.windows.create(
        {
          url: authUrl.href,
          type: "popup",
          width,
          height,
          focused: true
        },
        (createdWin) => {
          if (chrome.runtime.lastError || !createdWin) {
            return runLaunchWebAuthFlow();
          }

          const winId = createdWin.id;

          const cleanup = () => {
            try { chrome.tabs.onUpdated.removeListener(onTabUpdated); } catch (_) {}
            try { chrome.windows.onRemoved.removeListener(onWinRemoved); } catch (_) {}
          };

          const onTabUpdated = async (tabId, changeInfo) => {
            if (!changeInfo.url) return;
            if (changeInfo.url.startsWith(redirectUri)) {
              resolved = true;
              cleanup();
              try { chrome.windows.remove(winId); } catch (_) {}

              try {
                const code = extractAuthCodeFromUrl(changeInfo.url);
                if (!code) {
                  throw new Error("No authorization code was returned by Google.");
                }
                const token = await exchangeCodeForTokens(code, redirectUri);
                resolve(token);
              } catch (err) {
                reject(new Error(`Failed to complete Google sign-in: ${err.message}`));
              }
            }
          };

          const onWinRemoved = (removedWinId) => {
            if (removedWinId === winId) {
              cleanup();
              if (!resolved) {
                reject(new Error("Google sign-in window was closed before completion."));
              }
            }
          };

          chrome.tabs.onUpdated.addListener(onTabUpdated);
          chrome.windows.onRemoved.addListener(onWinRemoved);
        }
      );
    } else {
      runLaunchWebAuthFlow();
    }
  });
}

/**
 * Checks Google Tasks connection status
 */
async function checkGoogleTasksStatus() {
  try {
    const token = await getGoogleAuthToken(false);
    if (!token) return { connected: false };

    const resp = await fetch(`${GOOGLE_TASKS_API}/users/@me/lists`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (resp.ok) {
      const data = await resp.json();
      return { connected: true, data };
    }
    return { connected: false, error: `Google API returned status ${resp.status}` };
  } catch (err) {
    return { connected: false, error: err.message };
  }
}

/**
 * Finds or creates the target task list in Google Tasks (default: "Daily Pull List")
 */
async function getOrCreateGoogleTaskList(token, listTitle = "Daily Pull List") {
  const resp = await fetch(`${GOOGLE_TASKS_API}/users/@me/lists`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!resp.ok) {
    throw new Error(`Failed to query Google Task lists (status ${resp.status})`);
  }
  const data = await resp.json();
  const existingList = (data.items || []).find((l) => l.title === listTitle);
  if (existingList) {
    return existingList.id;
  }

  const createResp = await fetch(`${GOOGLE_TASKS_API}/users/@me/lists`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ title: listTitle })
  });
  if (!createResp.ok) {
    throw new Error(`Failed to create Google Task list "${listTitle}" (status ${createResp.status})`);
  }
  const created = await createResp.json();
  return created.id;
}

/**
 * Generates all multi-factor comparison keys for a pull list item.
 * Uniquely identifies items across Order ID, SKU, SKU digits, dedupKey, and cleaned title.
 */
function getItemMatchKeys(item) {
  const keys = new Set();
  const orderId = (item.orderId || "").trim().toLowerCase();
  if (orderId) {
    keys.add(`order:${orderId}`);
    if (orderId.length > 8) {
      keys.add(`order:${orderId.slice(0, 8)}`);
    }
  }

  const dedup = (item.dedupKey || "").trim().toLowerCase();
  if (dedup) {
    keys.add(dedup);
    if (dedup.startsWith("sku:")) {
      keys.add(dedup.replace(/^sku:/, "").trim());
    } else {
      keys.add(`sku:${dedup}`);
    }
  }

  const rawSku = (item.skuDisplay || item.sku || "").trim();
  const mSku = rawSku.match(/SKU\s*([A-Za-z0-9\s\-_]+)/i);
  const cleanSku = mSku ? mSku[1].trim() : rawSku.replace(/^[\[\(]+|[\]\)]+$/g, "").trim();
  if (cleanSku) {
    const cleanLower = cleanSku.toLowerCase();
    keys.add(cleanLower);
    keys.add(`sku:${cleanLower}`);
  }

  if (item.skuNum && item.skuNum > 0) {
    keys.add(`num:${item.skuNum}`);
  }

  const rawTitle = (item.title || "").split("\n")[0].trim();
  const cleanTitle = rawTitle.replace(/[^\w\s]/gi, "").toLowerCase().trim();
  if (cleanTitle) {
    keys.add(`title:${cleanTitle}`);
  }

  return Array.from(keys);
}

/**
 * Extracts all multi-factor deduplication keys from a Google Task's title and notes.
 */
function extractTaskKeys(task) {
  const keys = new Set();
  const title = (task.title || "").trim();
  const notes = (task.notes || "").trim();

  if (title) {
    keys.add(title.toLowerCase());
  }

  // 1. Order ID from notes or title (e.g. "Order: #dfb8a553")
  const mOrder = notes.match(/Order:\s*#?([A-Za-z0-9\-_]+)/i) || title.match(/Order:\s*#?([A-Za-z0-9\-_]+)/i);
  if (mOrder) {
    const ordId = mOrder[1].trim().toLowerCase();
    keys.add(`order:${ordId}`);
    if (ordId.length > 8) {
      keys.add(`order:${ordId.slice(0, 8)}`);
    }
  }

  // 2. SKU from title: "SKU 11053 — Jacket" or "[Bin B-104] — Item"
  const mSku = title.match(/SKU\s*([A-Za-z0-9\s\-_]+?)\s*—/i) || title.match(/^\[([A-Za-z0-9\s\-_]+?)\]\s*—/i);
  if (mSku) {
    const rawSku = mSku[1].trim().toLowerCase();
    keys.add(rawSku);
    keys.add(`sku:${rawSku}`);
  }

  // 3. Digits from title: "11053"
  const mDigits = title.match(/\b(\d{3,7})\b/);
  if (mDigits) {
    keys.add(`num:${mDigits[1]}`);
  }

  // 4. Clean product title part (after '—' or '-')
  if (title.includes("—")) {
    const sub = title.split("—")[1].replace(/[^\w\s]/gi, "").toLowerCase().trim();
    if (sub) keys.add(`title:${sub}`);
  } else if (title.includes("-")) {
    const sub = title.split("-")[1].replace(/[^\w\s]/gi, "").toLowerCase().trim();
    if (sub) keys.add(`title:${sub}`);
  }

  return Array.from(keys);
}

/**
 * Syncs pull list items into Google Tasks
 */
async function syncWithGoogleTasks(items, options = {}) {
  const token = await getGoogleAuthToken(true);
  const targetTitle = (typeof CONFIG !== "undefined" && CONFIG.GOOGLE_TASKS_LIST_NAME)
    ? CONFIG.GOOGLE_TASKS_LIST_NAME
    : "Daily Pull List";

  const listId = await getOrCreateGoogleTaskList(token, targetTitle);

  // Load persistent completed history from local storage
  const stored = await chrome.storage.local.get("persistedCompletedKeys");
  const persistedMap = stored.persistedCompletedKeys || {};
  const allCompletedKeys = new Set(Object.keys(persistedMap));
  const nowTs = Date.now();

  // Fetch current tasks in the list to identify completed items and clear uncompleted ones
  const getTasksResp = await fetch(`${GOOGLE_TASKS_API}/lists/${listId}/tasks?showCompleted=true&showHidden=true&maxResults=100`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  const uncompletedTaskIds = [];

  if (getTasksResp.ok) {
    const taskData = await getTasksResp.json();
    for (const t of taskData.items || []) {
      if (t.status === "completed") {
        const taskKeys = extractTaskKeys(t);
        for (const k of taskKeys) {
          allCompletedKeys.add(k);
          persistedMap[k] = nowTs;
        }
      } else {
        uncompletedTaskIds.push(t.id);
      }
    }
  }

  // Save updated completed map back to storage
  await chrome.storage.local.set({ persistedCompletedKeys: persistedMap });

  // Clear uncompleted tasks so the new list is populated cleanly in order
  for (const tid of uncompletedTaskIds) {
    try {
      await fetch(`${GOOGLE_TASKS_API}/lists/${listId}/tasks/${tid}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
    } catch (e) {
      console.warn("[NiftySync] Failed to clear previous Google task:", e);
    }
  }

  let createdCount = 0;
  let skippedCount = 0;

  // Insert items in reverse order because Google Tasks displays the most recently added item on top
  const itemsToAdd = [...items].reverse();

  for (const item of itemsToAdd) {
    const itemKeys = getItemMatchKeys(item);
    const isCompleted = options.skipCompleted !== false && itemKeys.some(k => allCompletedKeys.has(k));
    if (isCompleted) {
      skippedCount++;
      continue;
    }

    const taskTitle = `${item.skuDisplay} — ${item.title}`;
    const locationText = item.locationTag ? ` | Location: ${item.locationTag}` : "";
    const orderText = item.orderId ? ` | Order: #${item.orderId.slice(0, 8)}` : "";
    const notes = `Platform: ${item.marketplace} | Price: $${item.price}${locationText}${orderText}`;

    const insertResp = await fetch(`${GOOGLE_TASKS_API}/lists/${listId}/tasks`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        title: taskTitle,
        notes: notes
      })
    });

    if (insertResp.ok) {
      createdCount++;
    }
  }

  return {
    created: createdCount,
    skipped: skippedCount,
    total: items.length,
    targetList: targetTitle,
    completedKeys: Array.from(allCompletedKeys)
  };
}

/**
 * Main ingestion, normalization, sorting, and dispatch workflow.
 */
async function fetchAndSyncOrders(options = {}) {
  // 0. Verify License Status
  const storedLicense = await chrome.storage.local.get(["isPaid", "userEmail"]);
  if (!storedLicense.isPaid) {
    const errorMsg = "Payment required. Please unlock lifetime access ($29.99).";
    await chrome.storage.local.set({ lastError: errorMsg, isPaid: false });
    return { success: false, error: errorMsg };
  }

  const token = await getSessionToken();
  if (!token) {
    const errorMsg = "Please log into Nifty in Chrome to sync.";
    await chrome.storage.local.set({ lastError: errorMsg });
    return { success: false, error: errorMsg };
  }

  const endpoint = `${NIFTY_API_HOST}/api/v1/analytics.getOrders?input=` + encodeURIComponent(
    JSON.stringify({ page: 0, query: "", sort: "sold_at", sortOrder: "desc" })
  );

  try {
    const resp = await fetch(endpoint, {
      method: "GET",
      credentials: "include",
      headers: {
        "Origin": NIFTY_APP_URL,
        "Referer": `${NIFTY_APP_URL}/`,
        "Sec-Fetch-Site": "same-site",
        "Sec-Fetch-Mode": "cors",
        "Sec-Fetch-Dest": "empty"
      }
    });

    if (!resp.ok) {
      if (resp.status === 401 || resp.status === 403) {
        throw new Error("Session expired. Please re-login at app.nifty.ai");
      }
      throw new Error(`Nifty API returned status ${resp.status}`);
    }

    const data = await resp.json();
    if (data.error) {
      throw new Error(data.error.message || "Failed to retrieve orders from Nifty");
    }

    const orders = data.result?.data?.orders || [];

    // Calculate lookback window
    const now = new Date();
    let lookbackHours = options.lookbackHours;
    let cutoff = null;

    if (lookbackHours === "since-last-sync") {
      const stored = await chrome.storage.local.get("lastSyncTimestamp");
      if (stored.lastSyncTimestamp) {
        cutoff = new Date(stored.lastSyncTimestamp);
        // Safety cap: don't look back more than 7 days (168h) to prevent flooding
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        if (cutoff < sevenDaysAgo) {
          cutoff = sevenDaysAgo;
        }
      } else {
        // Fallback for first-time sync
        cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      }
    } else if (!lookbackHours || lookbackHours === "auto") {
      // Smart Auto: 72h on Monday (weekend sales), 24h on Tue-Fri
      const isMonday = now.getDay() === 1;
      const hours = isMonday ? 72 : 24;
      cutoff = new Date(now.getTime() - hours * 60 * 60 * 1000);
    } else if (lookbackHours === "48") {
      cutoff = new Date(now.getTime() - 48 * 60 * 60 * 1000);
    } else if (lookbackHours === "72") {
      cutoff = new Date(now.getTime() - 72 * 60 * 60 * 1000);
    } else if (lookbackHours === "12") {
      cutoff = new Date(now.getTime() - 12 * 60 * 60 * 1000);
    } else if (lookbackHours === "168") {
      cutoff = new Date(now.getTime() - 168 * 60 * 60 * 1000);
    } else {
      const hours = parseInt(lookbackHours, 10) || 24;
      cutoff = new Date(now.getTime() - hours * 60 * 60 * 1000);
    }

    const items = [];
    for (const order of orders) {
      if (!order.soldAt) continue;
      const soldDate = new Date(order.soldAt);

      const status = (order.status || "").toLowerCase();
      const fulfillment = (order.fulfillmentStatus || "").toLowerCase();
      if (status === "shipped" || status === "delivered" || fulfillment === "fulfilled" || order.shippedAt) {
        continue;
      }

      // Apply lookback cutoff
      if (cutoff && soldDate < cutoff) continue;

      const marketplace = order.marketplace || "Nifty";
      for (const line of order.lineItems || []) {
        const rawTitle = (line.title || "Untitled Product").split("\n")[0].trim();
        const cleanTitle = rawTitle.slice(0, 80);
        const orderId = order.id || "";
        const parsed = parseInventoryItem(line.sku, cleanTitle, orderId);

        const price = line.salePrice || order.totalPrice || "0.00";

        items.push({
          skuNum: parsed.skuNum,
          sku: parsed.skuDisplay,
          skuDisplay: parsed.skuDisplay,
          hasSku: parsed.hasSku,
          systemType: parsed.systemType,
          locationTag: parsed.locationTag,
          sortBucket: parsed.sortBucket,
          dedupKey: parsed.dedupKey,
          title: cleanTitle,
          marketplace,
          price: String(price),
          soldAt: order.soldAt,
          orderId
        });
      }
    }

    // Apply inventory storage sorting strategy
    const savedSortPrefs = await chrome.storage.local.get("sortOrder");
    const sortOrder = options.sortOrder || savedSortPrefs.sortOrder || "hybrid-desc";

    items.sort((a, b) => {
      // 1. Smart Hybrid (Default - Numeric Racks -> Bins & Locations -> No SKU)
      if (sortOrder === "hybrid-desc" || sortOrder === "sku-desc" || !sortOrder) {
        if (a.sortBucket !== b.sortBucket) {
          return a.sortBucket - b.sortBucket;
        }
        if (a.sortBucket === 1) {
          if (b.skuNum !== a.skuNum) {
            return b.skuNum - a.skuNum; // Descending rack numbers
          }
          return (a.skuSuffix || "").localeCompare(b.skuSuffix || "");
        }
        if (a.sortBucket === 2) {
          return a.locationTag.localeCompare(b.locationTag, undefined, { numeric: true, sensitivity: 'base' });
        }
        return new Date(b.soldAt) - new Date(a.soldAt);
      }

      // 2. Alphanumeric Bins & Locations (A → Z Alphabetical)
      if (sortOrder === "alpha") {
        if (a.sortBucket === 3 && b.sortBucket !== 3) return 1;
        if (b.sortBucket === 3 && a.sortBucket !== 3) return -1;
        return a.skuDisplay.localeCompare(b.skuDisplay, undefined, { numeric: true, sensitivity: 'base' });
      }

      // 3. Numeric Sequence Ascending (1 → 999)
      if (sortOrder === "sku-asc") {
        if (a.sortBucket !== b.sortBucket) {
          return a.sortBucket - b.sortBucket;
        }
        if (a.sortBucket === 1) {
          return a.skuNum - b.skuNum;
        }
        if (a.sortBucket === 2) {
          return a.locationTag.localeCompare(b.locationTag, undefined, { numeric: true, sensitivity: 'base' });
        }
        return new Date(b.soldAt) - new Date(a.soldAt);
      }

      // 4. Platform / Marketplace Grouped (eBay, Poshmark, Mercari, Depop, Etsy, Whatnot)
      if (sortOrder === "marketplace") {
        const mComp = (a.marketplace || "").localeCompare(b.marketplace || "");
        if (mComp !== 0) return mComp;
        if (a.sortBucket !== b.sortBucket) return a.sortBucket - b.sortBucket;
        if (a.sortBucket === 1) return b.skuNum - a.skuNum;
        if (a.sortBucket === 2) return a.locationTag.localeCompare(b.locationTag, undefined, { numeric: true, sensitivity: 'base' });
        return new Date(b.soldAt) - new Date(a.soldAt);
      }

      // 5. Recent Sold Date (Chronological)
      if (sortOrder === "recent") {
        return new Date(b.soldAt) - new Date(a.soldAt);
      }

      return 0;
    });

    if (items.length === 0) {
      const summary = {
        lastSyncTimestamp: new Date().toISOString(),
        lastItemCount: 0,
        lastCreatedCount: 0,
        lastSkippedCount: 0,
        lastMethod: "none",
        lastError: null,
        lookbackHours,
        items: []
      };
      await chrome.storage.local.set(summary);
      return { success: true, count: 0, created: 0, skipped: 0, method: "none", items: [] };
    }

    // Determine Destination: Apple Reminders vs. Google Tasks
    const destPrefs = await chrome.storage.local.get(["syncDestination"]);
    const destination = options.destination || destPrefs.syncDestination || "apple";

    let dispatchMethod = destination;
    let bridgeResult = null;
    let createdCount = items.length;
    let skippedCount = 0;
    let shortcutPayload = null;

    if (destination === "google") {
      try {
        const googleResult = await syncWithGoogleTasks(items, options);
        dispatchMethod = "google_tasks";
        createdCount = googleResult.created !== undefined ? googleResult.created : items.length;
        skippedCount = googleResult.skipped || 0;
        bridgeResult = googleResult;
      } catch (googleErr) {
        console.error("[NiftySync] Google Tasks sync error:", googleErr);
        throw new Error(`Google Tasks sync failed: ${googleErr.message}`);
      }
    } else {
      // Apple Reminders (Bridge or Shortcuts fallback)
      const bridgeStatus = await checkBridgeStatus();

      // Load and prune persisted completed history
      const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
      const nowTs = Date.now();
      const storedCompleted = await chrome.storage.local.get("persistedCompletedKeys");
      const persistedMap = storedCompleted.persistedCompletedKeys || {};
      let pruned = false;
      for (const [k, ts] of Object.entries(persistedMap)) {
        if (nowTs - ts > SEVEN_DAYS_MS) {
          delete persistedMap[k];
          pruned = true;
        }
      }
      if (pruned) {
        await chrome.storage.local.set({ persistedCompletedKeys: persistedMap });
      }

      if (bridgeStatus.connected) {
        try {
          const bridgeResp = await fetch(`${BRIDGE_URL}/sync`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              items,
              clearExisting: false,
              skipCompleted: options.skipCompleted !== false,
              persistedCompletedKeys: Object.keys(persistedMap)
            })
          });
          if (bridgeResp.ok) {
            bridgeResult = await bridgeResp.json();
            dispatchMethod = "bridge";
            createdCount = bridgeResult.created !== undefined ? bridgeResult.created : items.length;
            skippedCount = bridgeResult.skipped || 0;

            // Merge back completed keys detected by Apple Reminders
            if (bridgeResult.completedKeys && Array.isArray(bridgeResult.completedKeys)) {
              for (const k of bridgeResult.completedKeys) {
                persistedMap[k] = nowTs;
              }
              await chrome.storage.local.set({ persistedCompletedKeys: persistedMap });
            }
          }
        } catch (bridgeErr) {
          console.warn("[NiftySync] Local bridge failed, falling back to Shortcuts:", bridgeErr);
        }
      }

      if (dispatchMethod !== "bridge") {
        const textLines = items.map((it) => {
          let skuDisplay = (it.skuDisplay || "").trim();
          const rawSku = (it.sku || "").trim();
          if (!skuDisplay) {
            if (rawSku.startsWith("[") && rawSku.endsWith("]")) {
              skuDisplay = rawSku;
            } else if (["no sku", "none", "n/a", "[no sku]"].includes(rawSku.toLowerCase())) {
              skuDisplay = "[No SKU]";
            } else if (rawSku.toLowerCase().startsWith("sku")) {
              skuDisplay = rawSku;
            } else if (/^\d+/.test(rawSku)) {
              skuDisplay = `SKU ${rawSku}`;
            } else if (rawSku) {
              skuDisplay = `[${rawSku}]`;
            } else {
              skuDisplay = "[No SKU]";
            }
          }
          const cleanTitle = (it.title || "").split("\n")[0].trim();
          return `${skuDisplay} — ${cleanTitle}`;
        });
        shortcutPayload = textLines.join("\n");
        const shortcutUrl = `shortcuts://run-shortcut?name=SyncPullList&input=text&text=${encodeURIComponent(shortcutPayload)}`;
        chrome.tabs.create({ url: shortcutUrl, active: true }, (tab) => {
          if (tab && tab.id) {
            setTimeout(() => {
              chrome.tabs.remove(tab.id).catch(() => {});
            }, 6000);
          }
        });
        dispatchMethod = "shortcuts";
        createdCount = items.length;
      }
    }

    const syncSummary = {
      lastSyncTimestamp: new Date().toISOString(),
      lastItemCount: items.length,
      lastCreatedCount: createdCount,
      lastSkippedCount: skippedCount,
      lastMethod: dispatchMethod,
      destination,
      lastError: null,
      lookbackHours,
      bridgeDetails: bridgeResult,
      items: items.slice(0, 15)
    };
    await chrome.storage.local.set(syncSummary);

    return {
      success: true,
      count: items.length,
      created: createdCount,
      skipped: skippedCount,
      method: dispatchMethod,
      destination,
      bridgeResult,
      shortcutPayload: dispatchMethod === "shortcuts" ? shortcutPayload : null,
      items
    };
  } catch (err) {
    console.error("[NiftySync] Error during order sync:", err);
    const friendly = formatFriendlyError(err.message);
    try {
      await chrome.storage.local.set({ lastError: friendly });
    } catch (storageErr) {
      console.warn("[NiftySync] Failed to persist error to storage:", storageErr);
    }
    return { success: false, error: friendly };
  }
}

// -------------------------------------------------------------
// Message Dispatcher
// -------------------------------------------------------------
chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {
  if (req.action === "syncNow") {
    (async () => {
      // Enforce license verification
      const stored = await chrome.storage.local.get("isPaid");
      if (!stored.isPaid) {
        return sendResponse({ success: false, error: "Payment required. Please unlock lifetime access ($29.99)." });
      }
      const result = await fetchAndSyncOrders(req.options || {});
      sendResponse(result);
    })();
    return true;
  }

  if (req.action === "setDestination") {
    (async () => {
      await chrome.storage.local.set({ syncDestination: req.destination });
      sendResponse({ success: true, destination: req.destination });
    })();
    return true;
  }

  if (req.action === "verifyLicense") {
    (async () => {
      const email = (req.email || "").trim().toLowerCase();
      if (!email) return sendResponse({ paid: false, error: "Email required" });
      try {
        const verifyUrl = (typeof CONFIG !== "undefined" && CONFIG.LICENSE_VERIFY_URL)
          ? CONFIG.LICENSE_VERIFY_URL
          : "https://nifty-pull-list-auth.picklist-auth.workers.dev/api/license/verify";
        const resp = await fetch(`${verifyUrl}?email=${encodeURIComponent(email)}`);
        const data = await resp.json();
        if (data && data.paid) {
          await chrome.storage.local.set({ isPaid: true, userEmail: email });
          return sendResponse({ paid: true, email });
        }
        sendResponse({ paid: false, message: data.message || "No license found" });
      } catch (err) {
        sendResponse({ paid: false, error: err.message });
      }
    })();
    return true;
  }

  if (req.action === "connectGoogleTasks") {
    (async () => {
      try {
        const token = await getGoogleAuthToken(true);
        await chrome.storage.local.set({ syncDestination: "google", googleConnected: true });
        sendResponse({ success: true, token });
      } catch (err) {
        sendResponse({ success: false, error: err.message });
      }
    })();
    return true;
  }

  if (req.action === "disconnectGoogleTasks") {
    (async () => {
      try {
        await chrome.storage.local.remove(["google_access_token", "google_token_expiry", "google_refresh_token"]);
        await chrome.storage.local.set({ googleConnected: false });
        if (chrome.identity && chrome.identity.clearAllCachedAuthTokens) {
          chrome.identity.clearAllCachedAuthTokens(() => {});
        }
        sendResponse({ success: true });
      } catch (err) {
        sendResponse({ success: false, error: err.message });
      }
    })();
    return true;
  }

  if (req.action === "cleanDuplicates") {
    (async () => {
      try {
        const resp = await fetch(`${BRIDGE_URL}/clean-duplicates`, { method: "POST" });
        const data = await resp.json();
        sendResponse(data);
      } catch (err) {
        sendResponse({ success: false, error: err.message });
      }
    })();
    return true;
  }

  if (req.action === "resetCompletedHistory") {
    (async () => {
      try {
        await chrome.storage.local.remove("persistedCompletedKeys");
        sendResponse({ success: true });
      } catch (err) {
        sendResponse({ success: false, error: err.message });
      }
    })();
    return true;
  }

  if (req.action === "checkStatus") {
    (async () => {
      const token = await getSessionToken();
      const bridge = await checkBridgeStatus();
      const google = await checkGoogleTasksStatus();
      const storage = await chrome.storage.local.get([
        "syncDestination",
        "shortcutInstalled",
        "lastSyncTimestamp",
        "lastItemCount",
        "lastCreatedCount",
        "lastSkippedCount",
        "lastMethod",
        "lastError",
        "lookbackHours",
        "persistedCompletedKeys",
        "items"
      ]);
      const completedHistoryCount = Object.keys(storage.persistedCompletedKeys || {}).length;
      sendResponse({
        authenticated: !!token,
        bridgeConnected: bridge.connected,
        bridgeData: bridge.data || null,
        googleConnected: google.connected,
        googleData: google.data || null,
        shortcutInstalled: !!storage.shortcutInstalled,
        syncDestination: storage.syncDestination || "apple",
        completedHistoryCount,
        storage
      });
    })();
    return true;
  }
});

// -------------------------------------------------------------
// Periodic Background Alarm (Configurable Weekday Auto-Send)
// -------------------------------------------------------------
chrome.alarms.create("dailyPullListSync", { periodInMinutes: 15 });

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === "dailyPullListSync") {
    const {
      scheduledTime = "8",
      savedLookback = "auto",
      savedCustomHours = 24
    } = await chrome.storage.local.get(["scheduledTime", "savedLookback", "savedCustomHours"]);

    if (scheduledTime === "off") return;

    const targetHour = parseInt(scheduledTime, 10);
    const now = new Date();
    const currentHour = now.getHours();
    const currentDay = now.getDay(); // 1 = Mon, ..., 5 = Fri

    if (currentHour === targetHour && currentDay >= 1 && currentDay <= 5) {
      const todayStr = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
      const { lastAlarmRunDate } = await chrome.storage.local.get("lastAlarmRunDate");

      if (lastAlarmRunDate !== todayStr) {
        console.log(`[NiftySync] Executing scheduled ${targetHour}:00 weekday sync for ${todayStr}...`);
        await chrome.storage.local.set({ lastAlarmRunDate: todayStr });

        let lookback = savedLookback;
        if (lookback === "custom") {
          lookback = savedCustomHours;
        }

        await fetchAndSyncOrders({ source: "scheduled_alarm", lookbackHours: lookback });
      }
    }
  }
});
