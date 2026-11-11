/**
 * PickList - Popup Controller
 * Supports Apple Reminders & Google Tasks destinations
 */

document.addEventListener("DOMContentLoaded", () => {
  const syncBtn = document.getElementById("syncBtn");
  const btnText = document.getElementById("btnText");
  const btnIcon = document.getElementById("btnIcon");
  const statusBox = document.getElementById("statusBox");
  const lookbackSelect = document.getElementById("lookbackSelect");
  const customRow = document.getElementById("customRow");
  const customHoursInput = document.getElementById("customHoursInput");
  const scheduleSelect = document.getElementById("scheduleSelect");
  const sortSelect = document.getElementById("sortSelect");
  const dotNifty = document.getElementById("dotNifty");
  const textNifty = document.getElementById("textNifty");
  const dotBridge = document.getElementById("dotBridge");
  const textBridge = document.getElementById("textBridge");
  const referralBox = document.getElementById("referralBox");
  const openGuideLink = document.getElementById("openGuideLink");
  const openSetupLink = document.getElementById("openSetupLink");
  const advancedDetails = document.getElementById("advancedDetails");
  const pillBridge = document.getElementById("pillBridge");
  const btnDestApple = document.getElementById("btnDestApple");
  const targetListLabel = document.getElementById("targetListLabel");
  const optSinceLastSync = document.getElementById("optSinceLastSync");
  const timeframeBadge = document.getElementById("timeframeBadge");
  const lookbackPreviewText = document.getElementById("lookbackPreviewText");
  let lastSyncTimestampCached = null;

  // Paywall & License Management
  const extpayId = (typeof CONFIG !== "undefined" && CONFIG.EXTPAY_ID) ? CONFIG.EXTPAY_ID : "nifty-pull-list";
  const extpay = typeof ExtPay !== "undefined" ? ExtPay(extpayId) : null;
  const paywallContainer = document.getElementById("paywallContainer");
  const mainControlsContainer = document.getElementById("mainControlsContainer");
  const btnPopupCheckout = document.getElementById("btnPopupCheckout");
  const btnPopupLogin = document.getElementById("btnPopupLogin");
  const badgeVer = document.querySelector(".badge-ver");

  function setPaidState(isPaid) {
    if (isPaid) {
      if (paywallContainer) paywallContainer.style.display = "none";
      if (mainControlsContainer) mainControlsContainer.style.display = "";
      if (syncBtn) syncBtn.disabled = false;
      if (badgeVer) {
        badgeVer.textContent = "✓ PRO";
        badgeVer.style.color = "#10b981";
        badgeVer.style.background = "rgba(16, 185, 129, 0.1)";
        badgeVer.style.borderColor = "rgba(16, 185, 129, 0.25)";
        badgeVer.style.fontWeight = "700";
      }
    } else {
      if (paywallContainer) paywallContainer.style.display = "block";
      if (mainControlsContainer) mainControlsContainer.style.display = "none";
      if (syncBtn) syncBtn.disabled = true;
    }
  }

  // Pre-load from storage cache for instant, zero-flicker UI
  chrome.storage.local.get(["isPaid", "userEmail"], (res) => {
    if (res && res.isPaid) {
      setPaidState(true);
    } else {
      setPaidState(false);
    }
  });

  // Verify in background with ExtPay
  if (extpay) {
    extpay.getUser().then((user) => {
      const isPaid = !!(user && user.paid);
      chrome.storage.local.set({ isPaid, userEmail: user?.email || "" });
      setPaidState(isPaid);
    }).catch(e => console.log("[ExtPay] User check:", e));

    if (btnPopupCheckout) {
      btnPopupCheckout.addEventListener("click", () => extpay.openPaymentPage());
    }
    if (btnPopupLogin) {
      btnPopupLogin.addEventListener("click", () => extpay.openLoginPage());
    }

    const btnPaywallViewDemo = document.getElementById("btnPaywallViewDemo");
    if (btnPaywallViewDemo) {
      btnPaywallViewDemo.addEventListener("click", (e) => {
        e.preventDefault();
        chrome.tabs.create({ url: chrome.runtime.getURL("src/onboarding.html") });
      });
    }

    if (extpay.onPaid) {
      extpay.onPaid.addListener((user) => {
        chrome.storage.local.set({ isPaid: true, userEmail: user?.email || "" });
        setPaidState(true);
      });
    }
  }

  let currentDestination = "apple";

  // Destination Switcher (Apple Reminders vs. Google Tasks)
  function setDestination(dest) {
    currentDestination = dest;
    chrome.storage.local.set({ syncDestination: dest });
    chrome.runtime.sendMessage({ action: "setDestination", destination: dest });

    if (btnDestApple && btnDestGoogle) {
      btnDestApple.classList.toggle("active", dest === "apple");
      btnDestGoogle.classList.toggle("active", dest === "google");
    }

    if (targetListLabel) {
      targetListLabel.textContent = dest === "google" 
        ? 'Google Tasks: "Daily Pull List"' 
        : 'Reminders: "Daily Pull List"';
    }

    refreshStatus();
  }

  if (btnDestApple) {
    btnDestApple.addEventListener("click", () => setDestination("apple"));
  }
  if (btnDestGoogle) {
    btnDestGoogle.addEventListener("click", () => setDestination("google"));
  }

  // Click destination status pill
  if (pillBridge) {
    pillBridge.style.cursor = "pointer";
    pillBridge.addEventListener("click", () => {
      if (currentDestination === "google") {
        // Trigger Google Tasks connection directly or open walkthrough
        chrome.runtime.sendMessage({ action: "connectGoogleTasks" }, (res) => {
          if (res && res.success) {
            refreshStatus();
            statusBox.textContent = "✓ Connected to Google Tasks!";
            statusBox.className = "status-box success";
            setTimeout(() => {
              statusBox.textContent = "Ready to sync";
              statusBox.className = "status-box";
            }, 2500);
          } else {
            chrome.tabs.create({ url: chrome.runtime.getURL("src/onboarding.html#step-2-google") });
          }
        });
      } else {
        chrome.tabs.create({ url: chrome.runtime.getURL("src/onboarding.html#step-2-apple") });
      }
    });
  }

  // Open dedicated feature guide and video walkthrough
  if (openGuideLink) {
    openGuideLink.addEventListener("click", (e) => {
      e.preventDefault();
      chrome.tabs.create({ url: chrome.runtime.getURL("src/guide.html") });
    });
  }

  // Open full onboarding & setup wizard in a new tab
  if (openSetupLink) {
    openSetupLink.addEventListener("click", (e) => {
      e.preventDefault();
      chrome.tabs.create({ url: chrome.runtime.getURL("src/onboarding.html") });
    });
  }

  // Restore and persist Advanced Settings open/close toggle
  if (advancedDetails) {
    chrome.storage.local.get("advancedOpen", (res) => {
      if (res && res.advancedOpen) {
        advancedDetails.open = true;
      }
    });
    advancedDetails.addEventListener("toggle", () => {
      chrome.storage.local.set({ advancedOpen: advancedDetails.open });
    });
  }

  // Inject Referral Link from CONFIG
  const referralLinkEl = document.getElementById("popupReferralLink");
  if (referralLinkEl && typeof CONFIG !== "undefined" && CONFIG.NIFTY_REFERRAL_URL) {
    referralLinkEl.href = CONFIG.NIFTY_REFERRAL_URL;
  }

  // Copy Promo Code Button Handler
  const btnCopyPromoCode = document.getElementById("btnCopyPromoCode");
  if (btnCopyPromoCode) {
    btnCopyPromoCode.addEventListener("click", () => {
      if (navigator.clipboard) {
        navigator.clipboard.writeText("SOURCEDANDSOLD").then(() => {
          btnCopyPromoCode.textContent = "✓ Copied!";
          btnCopyPromoCode.style.background = "#bbf7d0";
          setTimeout(() => {
            btnCopyPromoCode.textContent = "📋 Copy";
            btnCopyPromoCode.style.background = "";
          }, 2000);
        });
      }
    });
  }

  const footerPartnerLink = document.getElementById("footerPartnerLink");
  if (footerPartnerLink && typeof CONFIG !== "undefined" && CONFIG.NIFTY_REFERRAL_URL) {
    footerPartnerLink.href = CONFIG.NIFTY_REFERRAL_URL;
  }

  function formatTimeDescription(d) {
    if (!d || isNaN(d.getTime())) return "previous sync";
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const isYesterday = d.toDateString() === yesterday.toDateString();

    const timeStr = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    if (isToday) return `Today at ${timeStr}`;
    if (isYesterday) return `Yesterday at ${timeStr}`;

    const dateStr = d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
    return `${dateStr} at ${timeStr}`;
  }

  function updateLookbackPreview() {
    if (!lookbackSelect || !lookbackPreviewText) return;
    const now = new Date();
    const val = lookbackSelect.value;
    let badgeText = "1 Day";

    if (val === "since-last-sync") {
      if (lastSyncTimestampCached) {
        const d = new Date(lastSyncTimestampCached);
        badgeText = "Since Sync";
        lookbackPreviewText.innerHTML = `Pulls items sold since <strong>${formatTimeDescription(d)}</strong>`;
      } else {
        const d = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        badgeText = "First Sync";
        lookbackPreviewText.innerHTML = `First sync: Pulls items sold since <strong>${formatTimeDescription(d)}</strong>`;
      }
    } else if (val === "24") {
      const d = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      badgeText = "24 Hours";
      lookbackPreviewText.innerHTML = `Pulls items sold since <strong>${formatTimeDescription(d)}</strong>`;
    } else if (val === "48") {
      const d = new Date(now.getTime() - 48 * 60 * 60 * 1000);
      badgeText = "48 Hours";
      lookbackPreviewText.innerHTML = `Pulls items sold since <strong>${formatTimeDescription(d)}</strong>`;
    } else if (val === "72") {
      const d = new Date(now.getTime() - 72 * 60 * 60 * 1000);
      badgeText = "72 Hours";
      lookbackPreviewText.innerHTML = `Pulls items sold since <strong>${formatTimeDescription(d)}</strong>`;
    } else if (val === "auto") {
      const isMonday = now.getDay() === 1;
      const hours = isMonday ? 72 : 24;
      const d = new Date(now.getTime() - hours * 60 * 60 * 1000);
      badgeText = isMonday ? "72h Auto" : "24h Auto";
      lookbackPreviewText.innerHTML = `Smart Auto (${hours}h): Pulls items sold since <strong>${formatTimeDescription(d)}</strong>`;
    } else if (val === "custom") {
      const hours = parseInt(customHoursInput ? customHoursInput.value : 36, 10) || 24;
      const d = new Date(now.getTime() - hours * 60 * 60 * 1000);
      badgeText = `${hours}h Custom`;
      lookbackPreviewText.innerHTML = `Custom (${hours}h): Pulls items sold since <strong>${formatTimeDescription(d)}</strong>`;
    }

    if (timeframeBadge) {
      timeframeBadge.textContent = badgeText;
    }
  }

  // Toggle custom hours input visibility and update preview
  function updateCustomLookbackVisibility() {
    if (lookbackSelect.value === "custom") {
      customRow.style.display = "flex";
      customHoursInput.focus();
    } else {
      customRow.style.display = "none";
    }
    chrome.storage.local.set({ savedLookback: lookbackSelect.value });
    updateLookbackPreview();
  }

  lookbackSelect.addEventListener("change", updateCustomLookbackVisibility);

  customHoursInput.addEventListener("input", () => {
    const val = parseInt(customHoursInput.value, 10);
    if (val > 0) {
      chrome.storage.local.set({ savedCustomHours: val });
    }
    updateLookbackPreview();
  });

  // Save schedule preference on change
  scheduleSelect.addEventListener("change", () => {
    chrome.storage.local.set({ scheduledTime: scheduleSelect.value });
    const label = scheduleSelect.options[scheduleSelect.selectedIndex].text;
    statusBox.textContent = `Schedule updated to ${label}`;
    statusBox.className = "status-box success";
    setTimeout(() => {
      statusBox.textContent = "Ready to sync";
      statusBox.className = "status-box";
    }, 2500);
  });

  // Save sort order preference on change
  if (sortSelect) {
    sortSelect.addEventListener("change", () => {
      chrome.storage.local.set({ sortOrder: sortSelect.value });
      const label = sortSelect.options[sortSelect.selectedIndex].text;
      statusBox.textContent = `Sort updated: ${label}`;
      statusBox.className = "status-box success";
      setTimeout(() => {
        statusBox.textContent = "Ready to sync";
        statusBox.className = "status-box";
      }, 2000);
    });
  }

  /**
   * Converts low-level OS, Chrome, and LevelDB errors into clear, actionable user messages.
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
      return "⚠️ Your Mac is out of disk space. Please empty your Trash or delete unused files to allow Chrome to save data. (Click to dismiss)";
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

  // Click on error box to dismiss
  if (statusBox) {
    statusBox.addEventListener("click", () => {
      if (statusBox.classList.contains("error")) {
        statusBox.textContent = "Ready to sync";
        statusBox.className = "status-box";
        statusBox.removeAttribute("title");
        chrome.storage.local.remove("lastError");
      }
    });
  }

  // Refresh connection indicators and load saved settings
  function refreshStatus() {
    chrome.storage.local.get(
      ["syncDestination", "savedLookback", "savedCustomHours", "scheduledTime", "sortOrder", "lastSyncTimestamp"],
      (prefs) => {
        lastSyncTimestampCached = prefs.lastSyncTimestamp || null;

        if (prefs.syncDestination) {
          currentDestination = prefs.syncDestination;
          if (btnDestApple && btnDestGoogle) {
            btnDestApple.classList.toggle("active", currentDestination === "apple");
            btnDestGoogle.classList.toggle("active", currentDestination === "google");
          }
          if (targetListLabel) {
            targetListLabel.textContent = currentDestination === "google" 
              ? 'Google Tasks: "Daily Pull List"' 
              : 'Reminders: "Daily Pull List"';
          }
        }

        // Configure "Since Last Sync" for First-Time vs Returning users
        if (lastSyncTimestampCached) {
          const lastDate = new Date(lastSyncTimestampCached);
          if (!isNaN(lastDate.getTime()) && optSinceLastSync) {
            optSinceLastSync.style.display = "";
            optSinceLastSync.textContent = "Since Last Sync";
          }
          if (prefs.savedLookback) {
            lookbackSelect.value = prefs.savedLookback;
          } else {
            // Default returning user to "since-last-sync"
            lookbackSelect.value = "since-last-sync";
          }
        } else {
          // BRAND NEW USER: No previous sync exists yet!
          if (optSinceLastSync) {
            optSinceLastSync.style.display = "none";
          }
          // Default to 1 Day (24h) for first-time safe sync
          lookbackSelect.value = prefs.savedLookback || "24";
        }

        if (lookbackSelect.value === "custom") {
          customRow.style.display = "flex";
        } else {
          customRow.style.display = "none";
        }

        if (prefs.savedCustomHours) {
          customHoursInput.value = prefs.savedCustomHours;
        }
        if (prefs.scheduledTime) {
          scheduleSelect.value = prefs.scheduledTime;
        }
        if (prefs.sortOrder && sortSelect) {
          sortSelect.value = prefs.sortOrder;
        }

        updateLookbackPreview();
      }
    );

    chrome.runtime.sendMessage({ action: "checkStatus" }, (res) => {
      if (chrome.runtime.lastError || !res) {
        textNifty.textContent = "Offline";
        textBridge.textContent = "Offline";
        dotNifty.className = "dot error";
        dotBridge.className = "dot error";
        return;
      }

      // 1. Nifty session status
      if (res.authenticated) {
        dotNifty.className = "dot active";
        textNifty.textContent = "Nifty Active";
        if (pillNifty) pillNifty.href = "https://app.nifty.ai";
        if (referralBox) referralBox.style.display = "none";
      } else {
        dotNifty.className = "dot error";
        textNifty.textContent = "Log In Required";
        if (pillNifty) {
          pillNifty.href = (typeof CONFIG !== "undefined" && CONFIG.NIFTY_REFERRAL_URL)
            ? CONFIG.NIFTY_REFERRAL_URL
            : "https://nifty.ai/?referral=SOURCEDANDSOLD";
        }
        if (referralBox) referralBox.style.display = "block";
      }

      // 2. Destination Status (Apple Reminders vs Google Tasks)
      if (currentDestination === "google") {
        if (res.googleConnected) {
          dotBridge.className = "dot active";
          textBridge.textContent = "Tasks Active";
          if (pillBridge) pillBridge.title = "Google Tasks Connected (Click for guide)";
        } else {
          dotBridge.className = "dot";
          textBridge.textContent = "Connect Google ↗";
          if (pillBridge) pillBridge.title = "Click to Sign in with Google Tasks";
        }
      } else {
        // Apple Reminders (Active via either Shortcut or Silent Bridge)
        if (res.bridgeConnected || res.shortcutInstalled) {
          dotBridge.className = "dot active";
          textBridge.textContent = "Reminders Active";
          if (pillBridge) {
            pillBridge.title = res.bridgeConnected
              ? "Apple Reminders: Silent Bridge Active (Click for guide)"
              : "Apple Reminders: SyncPullList Shortcut Active (Click for guide)";
          }
        } else {
          dotBridge.className = "dot";
          textBridge.textContent = "Setup Reminders ↗";
          if (pillBridge) {
            pillBridge.title = "Apple Reminders: Click to install 1-Click Shortcut";
          }
        }
      }

      // 3. Error state if any
      const storage = res.storage || {};
      if (storage.lastError) {
        statusBox.textContent = formatFriendlyError(storage.lastError);
        statusBox.className = "status-box error";
        statusBox.title = "Click to dismiss error";
      }
    });
  }

  // Trigger manual sync
  syncBtn.addEventListener("click", () => {
    syncBtn.disabled = true;
    btnIcon.innerHTML = `<span class="spinner"></span>`;
    btnText.textContent = "Syncing...";
    statusBox.textContent = "Retrieving orders & checking pull list...";
    statusBox.className = "status-box";
    statusBox.removeAttribute("title");

    let lookbackHours = lookbackSelect.value;
    if (lookbackHours === "custom") {
      lookbackHours = parseInt(customHoursInput.value, 10) || 24;
    }

    const options = {
      destination: currentDestination,
      lookbackHours,
      sortOrder: sortSelect ? sortSelect.value : "hybrid-desc",
      skipCompleted: true
    };

    chrome.runtime.sendMessage({ action: "syncNow", options }, (res) => {
      syncBtn.disabled = false;
      btnIcon.innerHTML = "⚡";
      btnText.textContent = "Sync Pull List Now";

      if (chrome.runtime.lastError) {
        statusBox.textContent = formatFriendlyError(chrome.runtime.lastError.message || "Failed to communicate with extension.");
        statusBox.className = "status-box error";
        statusBox.title = "Click to dismiss error";
        return;
      }

      if (res && res.success) {
        if (res.shortcutPayload && navigator.clipboard) {
          navigator.clipboard.writeText(res.shortcutPayload).catch(e => console.warn("Clipboard write:", e));
        }
        const created = res.created !== undefined ? res.created : res.count;
        const skipped = res.skipped || 0;
        const targetAppName = currentDestination === "google" ? "Google Tasks" : "Reminders";

        if (created === 0 && skipped > 0) {
          statusBox.textContent = "Pull list is up to date! (no new items)";
          statusBox.className = "status-box";
        } else if (created === 0) {
          statusBox.textContent = "No orders found in the selected window.";
          statusBox.className = "status-box";
        } else if (res.method === "shortcuts") {
          statusBox.textContent = `⚡ Sent ${created} item${created === 1 ? "" : "s"} to Apple Shortcuts! Click "Open" in Chrome.`;
          statusBox.className = "status-box success";
        } else {
          statusBox.textContent = `✓ Added ${created} new item${created === 1 ? "" : "s"} to ${targetAppName}!`;
          statusBox.className = "status-box success";
        }
      } else {
        statusBox.textContent = formatFriendlyError(res?.error || "Sync failed. Check connection.");
        statusBox.className = "status-box error";
        statusBox.title = "Click to dismiss error";
      }

      refreshStatus();
    });
  });

  // Initial status check
  refreshStatus();
});
