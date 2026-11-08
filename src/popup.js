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
        if (referralBox) referralBox.style.display = "none";
      } else {
        dotNifty.className = "dot error";
        textNifty.textContent = "Log In Required";
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
        statusBox.textContent = storage.lastError;
        statusBox.className = "status-box error";
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
        statusBox.textContent = chrome.runtime.lastError.message || "Failed to communicate with extension.";
        statusBox.className = "status-box error";
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
        statusBox.textContent = res?.error || "Sync failed. Check connection.";
        statusBox.className = "status-box error";
      }

      refreshStatus();
    });
  });

  // Initial status check
  refreshStatus();
});
