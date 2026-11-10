/**
 * PickList - Onboarding Controller
 * Author: Spencer Starkweather
 * Supports Apple Reminders & Google Tasks destinations
 */

let isUserPaid = false;

function goToStep(stepNum) {
  const stepLockNotice = document.getElementById("stepLockNotice");
  if (!isUserPaid && stepNum > 1) {
    if (stepLockNotice) {
      stepLockNotice.style.display = "block";
      stepLockNotice.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    return;
  }
  if (stepLockNotice) stepLockNotice.style.display = "none";

  document.querySelectorAll(".step-tab").forEach((tab) => {
    tab.classList.toggle("active", parseInt(tab.dataset.step, 10) === stepNum);
  });
  document.querySelectorAll(".step-panel").forEach((panel) => {
    panel.classList.remove("active");
  });
  const activePanel = document.getElementById(`panel-${stepNum}`);
  if (activePanel) {
    activePanel.classList.add("active");
  }
  window.location.hash = `#step-${stepNum}`;
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function switchOnboardingDest(dest) {
  const tabApple = document.getElementById("tabOnboardingApple");
  const tabGoogle = document.getElementById("tabOnboardingGoogle");
  const destAppleContainer = document.getElementById("destAppleContainer");
  const destGoogleContainer = document.getElementById("destGoogleContainer");

  if (tabApple) tabApple.classList.toggle("active", dest === "apple");
  if (tabGoogle) tabGoogle.classList.toggle("active", dest === "google");

  if (destAppleContainer) destAppleContainer.style.display = dest === "apple" ? "block" : "none";
  if (destGoogleContainer) destGoogleContainer.style.display = dest === "google" ? "block" : "none";

  if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
    chrome.storage.local.set({ syncDestination: dest });
  }
  if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.sendMessage) {
    chrome.runtime.sendMessage({ action: "setDestination", destination: dest });
  }

  if (dest === "google") {
    if (typeof checkGoogleTasks === "function") checkGoogleTasks(false);
  } else {
    if (typeof checkBridge === "function") checkBridge(false);
  }
}

// Gentle Web Audio tactile click feedback for checklist items
function playTactileClick() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(800, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(420, ctx.currentTime + 0.04);
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.04);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.04);
  } catch (e) {
    // Safe fallback if audio context is blocked
  }
}

function toggleMockItem(el, type) {
  if (!el) return;
  el.classList.toggle("completed");
  playTactileClick();
  updateMockCounter(type);
}

function updateMockCounter(type) {
  const containerId = type === "google" ? "destGoogleContainer" : "destAppleContainer";
  const pillId = type === "google" ? "mock-counter-google" : "mock-counter-apple";
  const container = document.getElementById(containerId);
  const pill = document.getElementById(pillId);
  if (!container || !pill) return;

  const items = container.querySelectorAll(".mock-item");
  const completed = container.querySelectorAll(".mock-item.completed");
  const remaining = items.length - completed.length;

  if (remaining === 0) {
    pill.textContent = "🎉 All pulled!";
    pill.style.background = "#dcfce7";
    pill.style.color = "#15803d";
  } else {
    pill.textContent = `${remaining} left`;
    pill.style.background = type === "google" ? "rgba(26, 115, 232, 0.12)" : "rgba(0, 113, 227, 0.1)";
    pill.style.color = type === "google" ? "#1a73e8" : "var(--primary)";
  }

  const bigCount = document.getElementById(`widget-count-${type}`);
  if (bigCount) {
    bigCount.textContent = remaining;
  }
}

function resetMockList(type) {
  const containerId = type === "google" ? "destGoogleContainer" : "destAppleContainer";
  const container = document.getElementById(containerId);
  if (!container) return;
  const completed = container.querySelectorAll(".mock-item.completed");
  completed.forEach(item => item.classList.remove("completed"));
  playTactileClick();
  updateMockCounter(type);
}

// Make accessible to onclick handlers
window.switchOnboardingDest = switchOnboardingDest;
window.goToStep = goToStep;
window.toggleMockItem = toggleMockItem;
window.resetMockList = resetMockList;
window.playTactileClick = playTactileClick;

document.addEventListener("DOMContentLoaded", () => {
  // Check URL hash on page load for deep-linking
  if (window.location.hash) {
    if (window.location.hash === "#step-2-google") {
      goToStep(2);
      switchOnboardingDest("google");
    } else if (window.location.hash === "#step-2-apple") {
      goToStep(2);
      switchOnboardingDest("apple");
    } else {
      const match = window.location.hash.match(/#step-(\d+)/);
      if (match && match[1]) {
        const targetStep = parseInt(match[1], 10);
        if (targetStep >= 1 && targetStep <= 3) {
          goToStep(targetStep);
        }
      }
    }
  } else {
    goToStep(1);
  }

  // Restore saved destination preference
  if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
    chrome.storage.local.get("syncDestination", (res) => {
      if (res && res.syncDestination) {
        switchOnboardingDest(res.syncDestination);
      }
    });
  }

  // Stepper navigation tabs & buttons
  document.querySelectorAll(".step-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      const step = parseInt(tab.dataset.step, 10);
      goToStep(step);
    });
  });

  // Handle all data-goto-step buttons
  document.querySelectorAll("[data-goto-step]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const step = parseInt(btn.dataset.gotoStep, 10);
      const dest = btn.dataset.gotoDest;
      if (dest && typeof switchOnboardingDest === "function") {
        switchOnboardingDest(dest);
      }
      goToStep(step);
    });
  });

  // Handle all data-switch-dest buttons
  document.querySelectorAll("[data-switch-dest]").forEach((btn) => {
    btn.addEventListener("click", () => {
      switchOnboardingDest(btn.dataset.switchDest);
    });
  });

  // Inject Referral Link from CONFIG
  const referralUrl = (typeof CONFIG !== "undefined" && CONFIG.NIFTY_REFERRAL_URL) 
    ? CONFIG.NIFTY_REFERRAL_URL 
    : "https://nifty.ai/?referral=SOURCEDANDSOLD";

  const referralBtn = document.getElementById("referralBtn");
  const footerReferralLink = document.getElementById("footerReferralLink");
  if (referralBtn) referralBtn.href = referralUrl;
  if (footerReferralLink) footerReferralLink.href = referralUrl;

  // Inject Apple Shortcut iCloud Link from CONFIG
  const shortcutIcloudUrl = (typeof CONFIG !== "undefined" && CONFIG.APPLE_SHORTCUT_ICLOUD_URL)
    ? CONFIG.APPLE_SHORTCUT_ICLOUD_URL
    : "https://www.icloud.com/shortcuts/7238ff49f04843de82338725bb356aa1";

  const btnInstallShortcut = document.getElementById("btnInstallShortcut");
  if (btnInstallShortcut) btnInstallShortcut.href = shortcutIcloudUrl;
  document.querySelectorAll(".btn-install-shortcut").forEach((btn) => {
    btn.href = shortcutIcloudUrl;
  });

  // Step 1: Nifty session check
  const onboardingDotNifty = document.getElementById("onboardingDotNifty");
  const onboardingTextNifty = document.getElementById("onboardingTextNifty");
  const onboardingSubNifty = document.getElementById("onboardingSubNifty");
  const btnCheckNifty = document.getElementById("btnCheckNifty");

  function checkNifty() {
    onboardingTextNifty.textContent = "Checking Nifty session...";
    chrome.runtime.sendMessage({ action: "checkStatus" }, (res) => {
      if (res && res.authenticated) {
        onboardingDotNifty.className = "dot active";
        onboardingTextNifty.textContent = "Connected to Nifty (Active Session)";
        onboardingSubNifty.textContent = "Your authenticated seller session was found and is ready!";
      } else {
        onboardingDotNifty.className = "dot";
        onboardingTextNifty.textContent = "Not logged into Nifty";
        onboardingSubNifty.textContent = "Please sign into app.nifty.ai, or use the referral partner link above.";
      }
    });
  }
  if (btnCheckNifty) btnCheckNifty.addEventListener("click", checkNifty);

  // Step 2A: Apple Bridge check & Walkthrough Actions
  const onboardingDotBridge = document.getElementById("onboardingDotBridge");
  const onboardingTextBridge = document.getElementById("onboardingTextBridge");
  const onboardingSubBridge = document.getElementById("onboardingSubBridge");
  const btnTestBridge = document.getElementById("btnTestBridge");
  const bridgeAlertBox = document.getElementById("bridgeAlertBox");
  const btnDownloadInstaller = document.getElementById("btnDownloadInstaller");
  const btnCopyTerminalCmd = document.getElementById("btnCopyTerminalCmd");
  const terminalCommandText = document.getElementById("terminalCommandText");
  const btnConfirmShortcutInstalled = document.getElementById("btnConfirmShortcutInstalled");
  const btnTestShortcutDirect = document.getElementById("btnTestShortcutDirect");

  function showBridgeAlert(message, isSuccess = true) {
    if (!bridgeAlertBox) return;
    bridgeAlertBox.style.display = "block";
    bridgeAlertBox.textContent = message;
    if (isSuccess) {
      bridgeAlertBox.style.background = "#f0fdf4";
      bridgeAlertBox.style.border = "1px solid #bbf7d0";
      bridgeAlertBox.style.color = "#15803d";
    } else {
      bridgeAlertBox.style.background = "#fef2f2";
      bridgeAlertBox.style.border = "1px solid #fecaca";
      bridgeAlertBox.style.color = "#b91c1c";
    }
  }

  function checkBridge(userTriggered = false) {
    if (!onboardingTextBridge) return;
    onboardingTextBridge.textContent = "Checking Apple Reminders status...";
    chrome.runtime.sendMessage({ action: "checkStatus" }, (res) => {
      if (res && res.bridgeConnected) {
        onboardingDotBridge.className = "dot active";
        onboardingTextBridge.textContent = "Apple Reminders Active (Silent Bridge Running)";
        if (onboardingSubBridge) {
          onboardingSubBridge.textContent = "Background daemon active on port 8989 • Target: 'Daily Pull List' • iCloud Ready";
        }
        if (userTriggered) {
          showBridgeAlert("✓ Connected! Apple Reminders silent bridge is active and ready for background sync.", true);
        }
      } else if (res && res.shortcutInstalled) {
        onboardingDotBridge.className = "dot active";
        onboardingTextBridge.textContent = "Apple Reminders Active (SyncPullList Shortcut)";
        if (onboardingSubBridge) {
          onboardingSubBridge.textContent = "Official Apple Shortcut is active • Syncs directly to Reminders app & widgets";
        }
        if (userTriggered) {
          showBridgeAlert("✓ 'SyncPullList' shortcut is active! Clicking Sync in Chrome will populate your Reminders.", true);
        }
      } else {
        onboardingDotBridge.className = "dot";
        onboardingTextBridge.textContent = "Apple Reminders: Setup Required";
        if (onboardingSubBridge) {
          onboardingSubBridge.textContent = "Install the official Apple Shortcut below to connect Reminders.";
        }
        if (userTriggered) {
          showBridgeAlert("Please click '➕ 1-Click Install Shortcut' below to activate Apple Reminders.", false);
        }
      }
    });
  }
  window.checkBridge = checkBridge;

  if (btnTestBridge) {
    btnTestBridge.addEventListener("click", () => checkBridge(true));
  }

  // Handle clicking the official Apple Shortcut install link
  const onInstallClick = () => {
    chrome.storage.local.set({ shortcutInstalled: true }, () => {
      showBridgeAlert("✓ Opening Apple Shortcuts! Click 'Add Shortcut' in the macOS dialog, then return here.", true);
      setTimeout(() => checkBridge(false), 2000);
    });
  };
  if (btnInstallShortcut) {
    btnInstallShortcut.addEventListener("click", onInstallClick);
  }
  document.querySelectorAll(".btn-install-shortcut").forEach((btn) => {
    btn.addEventListener("click", onInstallClick);
  });

  // Handle confirming shortcut is installed
  if (btnConfirmShortcutInstalled) {
    btnConfirmShortcutInstalled.addEventListener("click", () => {
      chrome.storage.local.set({ shortcutInstalled: true }, () => {
        showBridgeAlert("✓ Confirmed! 'SyncPullList' shortcut marked active. Reminders is ready to sync!", true);
        checkBridge(true);
      });
    });
  }

  // Handle testing shortcut directly
  if (btnTestShortcutDirect) {
    btnTestShortcutDirect.addEventListener("click", () => {
      chrome.storage.local.set({ shortcutInstalled: true }, () => {
        const testPayload = "SKU 11053 — Metallica 2025 Tour Tee (Test Sync)";
        if (navigator.clipboard) {
          navigator.clipboard.writeText(testPayload).catch((e) => console.warn(e));
        }
        const shortcutUrl = `shortcuts://run-shortcut?name=SyncPullList&input=text&text=${encodeURIComponent(testPayload)}`;
        chrome.tabs.create({ url: shortcutUrl, active: true }, (t) => {
          if (t && t.id) {
            setTimeout(() => chrome.tabs.remove(t.id).catch(() => {}), 6000);
          }
        });
        showBridgeAlert("⚡ Dispatched test item to 'SyncPullList'! Click 'Open Shortcuts' in Chrome if prompted.", true);
        checkBridge(true);
      });
    });
  }

  // 1-Click Installer Download handler (Generates 100% self-contained installer)
  if (btnDownloadInstaller) {
    btnDownloadInstaller.addEventListener("click", async () => {
      try {
        let bridgeCode = "";
        try {
          const bridgeUrl = chrome.runtime.getURL("src/bridge.py");
          const resp = await fetch(bridgeUrl);
          if (resp.ok) {
            bridgeCode = await resp.text();
          }
        } catch (fetchErr) {
          console.warn("Could not fetch bundled bridge.py:", fetchErr);
        }

        const scriptHeader = `#!/bin/bash
# ==============================================================================
# PickList - 1-Click macOS Apple Reminders Bridge Installer
# ==============================================================================
trap 'echo ""; echo "Press [Enter] to close this window..."; read -r' EXIT

echo "=================================================================="
echo "  ⚡ PickList - Apple Reminders Bridge Setup"
echo "=================================================================="
echo ""
echo "Setting up background LaunchAgent so pull lists sync silently..."
echo ""

APP_DIR="\\$HOME/Library/Application Support/NiftyPullList"
mkdir -p "\\$APP_DIR"
BRIDGE_PY="\\$APP_DIR/bridge.py"

if ! command -v python3 &> /dev/null; then
  echo "❌ Error: python3 is not installed or not in PATH."
  echo "macOS includes Python 3. If prompted to install Developer Tools, click Install."
  exit 1
fi

PYTHON_BIN="$(which python3)"
echo "✓ Python detected: \\$PYTHON_BIN"

echo "📦 Installing bridge helper to: \\$BRIDGE_PY..."
cat << 'EOF_NIFTY_BRIDGE_PYTHON' > "\\$BRIDGE_PY"
`;

        const scriptFooter = `
EOF_NIFTY_BRIDGE_PYTHON

chmod +x "\\$BRIDGE_PY"
echo "✓ Bridge script installed."

echo "⚙️  Configuring automatic background service (LaunchAgent)..."
"\\$PYTHON_BIN" "\\$BRIDGE_PY" --install-service

echo ""
echo "⏳ Initializing background service..."
sleep 1
"\\$PYTHON_BIN" "\\$BRIDGE_PY" --status

echo ""
echo "=================================================================="
echo "🎉 Setup complete! The bridge is now active in the background."
echo ""
echo "📱 MULTI-DEVICE IPHONE SYNC REMINDER:"
echo "To ensure your pull list syncs to your phone when walking the floor:"
echo "1. On this Mac: System Settings -> Apple Account -> iCloud -> Reminders (ON)"
echo "2. On your iPhone/iPad: Settings -> Apple Account -> iCloud -> Reminders (ON)"
echo "(Make sure both devices use the same Apple Account!)"
echo ""
echo "Return to Chrome and click '⚡ Test Connection' to verify!"
echo "=================================================================="
`;

        const scriptContent = scriptHeader + bridgeCode + scriptFooter;

        const blob = new Blob([scriptContent], { type: "text/plain;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "Install_Bridge.command";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        showBridgeAlert("📥 'Install_Bridge.command' downloaded! Open your Downloads folder and double-click it (or run: bash ~/Downloads/Install_Bridge.command).", true);
      } catch (err) {
        console.error("Installer generation failed:", err);
        showBridgeAlert("Failed to download installer: " + err.message, false);
      }
    });
  }
  // Copy Terminal command to clipboard
  if (btnCopyTerminalCmd && terminalCommandText) {
    btnCopyTerminalCmd.addEventListener("click", () => {
      const textToCopy = terminalCommandText.textContent.trim();
      navigator.clipboard.writeText(textToCopy).then(() => {
        const originalText = btnCopyTerminalCmd.textContent;
        btnCopyTerminalCmd.textContent = "✓ Copied!";
        setTimeout(() => {
          btnCopyTerminalCmd.textContent = originalText;
        }, 2000);
      });
    });
  }

  // Step 2B: Google Tasks check & actions
  const onboardingDotGoogle = document.getElementById("onboardingDotGoogle");
  const onboardingTextGoogle = document.getElementById("onboardingTextGoogle");
  const onboardingSubGoogle = document.getElementById("onboardingSubGoogle");
  const btnConnectGoogle = document.getElementById("btnConnectGoogle");
  const btnTestGoogle = document.getElementById("btnTestGoogle");
  const googleAlertBox = document.getElementById("googleAlertBox");

  function showGoogleAlert(message, isSuccess = true) {
    if (!googleAlertBox) return;
    googleAlertBox.style.display = "block";
    googleAlertBox.textContent = message;
    if (isSuccess) {
      googleAlertBox.style.background = "#f0fdf4";
      googleAlertBox.style.border = "1px solid #bbf7d0";
      googleAlertBox.style.color = "#15803d";
    } else {
      googleAlertBox.style.background = "#fef2f2";
      googleAlertBox.style.border = "1px solid #fecaca";
      googleAlertBox.style.color = "#b91c1c";
    }
  }

  function checkGoogleTasks(userTriggered = false) {
    if (!onboardingTextGoogle) return;
    onboardingTextGoogle.textContent = "Checking Google Tasks connection...";
    chrome.runtime.sendMessage({ action: "checkStatus" }, (res) => {
      if (res && res.googleConnected) {
        onboardingDotGoogle.className = "dot active";
        onboardingTextGoogle.textContent = "Connected to Google Tasks ✓";
        if (onboardingSubGoogle) {
          onboardingSubGoogle.textContent = 'Target List: "Daily Pull List" • Ready to sync!';
        }
        if (btnConnectGoogle) {
          btnConnectGoogle.textContent = "✓ Google Tasks Authorized";
          btnConnectGoogle.style.background = "#15803d";
        }
        if (userTriggered) {
          showGoogleAlert("✓ Success! Google Tasks is connected and ready to receive your daily pull lists.", true);
        }
      } else {
        onboardingDotGoogle.className = "dot";
        onboardingTextGoogle.textContent = "Google Tasks Not Connected";
        if (onboardingSubGoogle) {
          onboardingSubGoogle.textContent = "Click 'Sign in with Google' to authorize your account.";
        }
        if (btnConnectGoogle) {
          btnConnectGoogle.textContent = "🔑 Sign in with Google";
          btnConnectGoogle.style.background = "linear-gradient(180deg, #1a73e8 0%, #1557b0 100%)";
        }
        if (userTriggered) {
          showGoogleAlert("Google Tasks is not authorized yet. Please click 'Sign in with Google' above.", false);
        }
      }
    });
  }
  window.checkGoogleTasks = checkGoogleTasks;

  if (btnConnectGoogle) {
    btnConnectGoogle.addEventListener("click", () => {
      btnConnectGoogle.textContent = "Signing in...";
      chrome.runtime.sendMessage({ action: "connectGoogleTasks" }, (res) => {
        if (res && res.success) {
          checkGoogleTasks(true);
        } else {
          if (res?.error && res.error.includes("client_secret")) {
            showGoogleAlert("Browser cached an older background worker. Reloading extension now...", false);
            setTimeout(() => {
              if (chrome.runtime && chrome.runtime.reload) {
                chrome.runtime.reload();
              }
            }, 800);
            return;
          }
          showGoogleAlert(`Google authentication failed: ${res?.error || "Unknown error"}`, false);
          checkGoogleTasks(false);
        }
      });
    });
  }

  if (btnTestGoogle) {
    btnTestGoogle.addEventListener("click", () => checkGoogleTasks(true));
  }

  // Demo Platform Switcher (Step 1)
  const tabDemoApple = document.getElementById("tabDemoApple");
  const tabDemoGoogle = document.getElementById("tabDemoGoogle");
  const demoAppleContainer = document.getElementById("demoAppleContainer");
  const demoGoogleContainer = document.getElementById("demoGoogleContainer");

  function switchDemo(platform) {
    if (tabDemoApple) tabDemoApple.classList.toggle("active", platform === "apple");
    if (tabDemoGoogle) tabDemoGoogle.classList.toggle("active", platform === "google");
    if (demoAppleContainer) demoAppleContainer.style.display = platform === "apple" ? "block" : "none";
    if (demoGoogleContainer) demoGoogleContainer.style.display = platform === "google" ? "block" : "none";
  }

  if (tabDemoApple) tabDemoApple.addEventListener("click", () => switchDemo("apple"));
  if (tabDemoGoogle) tabDemoGoogle.addEventListener("click", () => switchDemo("google"));

  const btnContinueToStep2 = document.getElementById("btnContinueToStep2");
  if (btnContinueToStep2) {
    btnContinueToStep2.addEventListener("click", () => goToStep(2));
  }

  // Step 1: ExtensionPay Lifetime Access Integration
  const extpayId = (typeof CONFIG !== "undefined" && CONFIG.EXTPAY_ID) ? CONFIG.EXTPAY_ID : "nifty-pull-list";
  const extpay = typeof ExtPay !== "undefined" ? ExtPay(extpayId) : null;

  const btnExtPayCheckout = document.getElementById("btnExtPayCheckout");
  const btnExtPayLogin = document.getElementById("btnExtPayLogin");
  const paymentStatusBox = document.getElementById("paymentStatusBox");
  const paymentSuccessBox = document.getElementById("paymentSuccessBox");
  const paidUserEmailText = document.getElementById("paidUserEmailText");
  const displayPrice = document.getElementById("displayPrice");
  const btnPriceTag = document.getElementById("btnPriceTag");

  const priceText = (typeof CONFIG !== "undefined" && CONFIG.FLAT_FEE_PRICE) ? CONFIG.FLAT_FEE_PRICE : "$29.99";
  if (displayPrice) displayPrice.innerHTML = `${priceText} <span style="font-size: 18px; font-weight: 500; color: var(--text-muted);">one-time flat fee</span>`;
  if (btnPriceTag) btnPriceTag.textContent = `(${priceText})`;

  function applyPaidState(user) {
    isUserPaid = true;
    chrome.storage.local.set({ isPaid: true, userEmail: user?.email || "" });

    // Unlock Stepper Tabs
    const tab2 = document.getElementById("tab-step-2");
    const tab3 = document.getElementById("tab-step-3");
    if (tab2) {
      tab2.classList.remove("locked");
      tab2.classList.add("paid-unlocked");
    }
    if (tab3) {
      tab3.classList.remove("locked");
      tab3.classList.add("paid-unlocked");
    }
    const num1 = document.getElementById("step-num-1");
    if (num1) num1.innerHTML = `<span style="color:#10b981; font-weight:700;">✓</span> Step 1`;
    const num2 = document.getElementById("step-num-2");
    if (num2) num2.textContent = "Step 2";
    const num3 = document.getElementById("step-num-3");
    if (num3) num3.textContent = "Step 3";

    const lockNotice = document.getElementById("stepLockNotice");
    if (lockNotice) lockNotice.style.display = "none";

    if (btnExtPayCheckout) {
      btnExtPayCheckout.textContent = "✓ Lifetime Access Active";
      btnExtPayCheckout.disabled = true;
      btnExtPayCheckout.style.background = "#059669";
      btnExtPayCheckout.style.cursor = "default";
      btnExtPayCheckout.style.boxShadow = "none";
    }
    if (btnExtPayLogin) btnExtPayLogin.style.display = "none";
    if (paymentStatusBox) paymentStatusBox.style.display = "none";
    if (paidUserEmailText && user?.email) {
      paidUserEmailText.textContent = `License verified for ${user.email}. All setup steps unlocked!`;
    }
    if (paymentSuccessBox) {
      paymentSuccessBox.style.display = "block";
    }
  }

  // Pre-check storage cache for instant rendering
  chrome.storage.local.get(["isPaid", "userEmail"], (res) => {
    if (res && res.isPaid) {
      applyPaidState({ email: res.userEmail || "" });
    }
  });

  if (extpay) {
    // Check payment status with ExtensionPay server
    extpay.getUser().then((user) => {
      if (user && user.paid) {
        applyPaidState(user);
      }
    }).catch((err) => {
      console.log("[ExtPay] User check:", err);
    });

    if (btnExtPayCheckout) {
      btnExtPayCheckout.addEventListener("click", () => {
        extpay.openPaymentPage();
      });
    }

    if (btnExtPayLogin) {
      btnExtPayLogin.addEventListener("click", () => {
        extpay.openLoginPage();
      });
    }

    if (extpay.onPaid) {
      extpay.onPaid.addListener((user) => {
        applyPaidState(user);
        // Automatically advance to Step 2: Connect Nifty
        setTimeout(() => goToStep(2), 1500);
      });
    }
  }

  // Finish Onboarding
  const btnFinishOnboarding = document.getElementById("btnFinishOnboarding");
  if (btnFinishOnboarding) {
    btnFinishOnboarding.addEventListener("click", () => {
      chrome.storage.local.set({ onboardingCompleted: true });
      alert("🎉 You're all set! Click the PickList icon in your Chrome toolbar anytime to sync.");
      window.close();
    });
  }

  // Interactive Checklist Previews (Apple & Google)
  document.addEventListener("click", (e) => {
    const mockItem = e.target.closest(".mock-item");
    if (mockItem) {
      const platform = mockItem.getAttribute("data-platform") || (mockItem.closest("#destGoogleContainer") ? "google" : "apple");
      toggleMockItem(mockItem, platform);
      return;
    }

    const resetBtn = e.target.closest(".btn-mock-reset");
    if (resetBtn) {
      const platform = resetBtn.getAttribute("data-platform") || "apple";
      resetMockList(platform);
      return;
    }
  });

  // Run initial checks
  checkNifty();
  checkBridge();
  checkGoogleTasks();
});
