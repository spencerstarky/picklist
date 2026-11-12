/**
 * PickList - Onboarding Controller
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

  if (stepNum === 2 || stepNum === 3) {
    if (typeof checkBridge === "function") checkBridge(false);
    if (typeof checkGoogleTasks === "function") checkGoogleTasks(false);
  } else if (stepNum === 1) {
    if (typeof checkNifty === "function") checkNifty();
  }
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
  const container = document.getElementById(type === "google" ? "demoGoogleContainer" : "demoAppleContainer")
                 || document.getElementById(type === "google" ? "destGoogleContainer" : "destAppleContainer");
  const pill = document.getElementById(type === "google" ? "mock-counter-google" : "mock-counter-apple");
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
  const container = document.getElementById(type === "google" ? "demoGoogleContainer" : "demoAppleContainer")
                 || document.getElementById(type === "google" ? "destGoogleContainer" : "destAppleContainer");
  if (!container) return;
  const completed = container.querySelectorAll(".mock-item.completed");
  completed.forEach(item => item.classList.remove("completed"));
  playTactileClick();
  updateMockCounter(type);
}

function switchDemo(platform) {
  const tabDemoApple = document.getElementById("tabDemoApple");
  const tabDemoGoogle = document.getElementById("tabDemoGoogle");
  const demoAppleContainer = document.getElementById("demoAppleContainer");
  const demoGoogleContainer = document.getElementById("demoGoogleContainer");

  if (tabDemoApple) tabDemoApple.classList.toggle("active", platform === "apple");
  if (tabDemoGoogle) tabDemoGoogle.classList.toggle("active", platform === "google");
  if (demoAppleContainer) demoAppleContainer.style.display = platform === "apple" ? "block" : "none";
  if (demoGoogleContainer) demoGoogleContainer.style.display = platform === "google" ? "block" : "none";
}

// Make accessible to onclick handlers
window.switchOnboardingDest = switchOnboardingDest;
window.switchDemo = switchDemo;
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

  // Handle all data-switch-demo buttons
  document.querySelectorAll("[data-switch-demo]").forEach((btn) => {
    btn.addEventListener("click", () => {
      switchDemo(btn.dataset.switchDemo);
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

  // Copy Promo Code in Onboarding
  const btnCopyOnboardingPromo = document.getElementById("btnCopyOnboardingPromo");
  if (btnCopyOnboardingPromo) {
    btnCopyOnboardingPromo.addEventListener("click", () => {
      if (navigator.clipboard) {
        navigator.clipboard.writeText("SOURCEDANDSOLD").then(() => {
          btnCopyOnboardingPromo.textContent = "✓ Copied!";
          btnCopyOnboardingPromo.style.background = "#bbf7d0";
          setTimeout(() => {
            btnCopyOnboardingPromo.textContent = "📋 Copy Code";
            btnCopyOnboardingPromo.style.background = "";
          }, 2000);
        });
      }
    });
  }

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

    if (btnTestBridge && userTriggered) {
      btnTestBridge.disabled = true;
      btnTestBridge.textContent = "⚡ Testing...";
    }
    if (onboardingDotBridge && userTriggered) {
      onboardingDotBridge.className = "dot checking";
    }

    // Fast-path: pre-check storage for instant UI rendering
    if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(["shortcutInstalled", "syncDestination"], (stored) => {
        if (stored && stored.shortcutInstalled) {
          if (onboardingDotBridge) onboardingDotBridge.className = "dot active";
          if (onboardingTextBridge) onboardingTextBridge.textContent = "Apple Reminders Connected ✓";
          if (onboardingSubBridge) {
            onboardingSubBridge.textContent = 'Target List: "Daily Pull List" • Ready to sync across Mac & iPhone';
          }
        }
      });
    }

    let resolved = false;
    const timeoutTimer = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        if (btnTestBridge) {
          btnTestBridge.disabled = false;
          btnTestBridge.textContent = "⚡ Check / Test Status";
        }
      }
    }, 4500);

    const handleBridgeResult = (res) => {
      if (resolved) return;
      resolved = true;
      clearTimeout(timeoutTimer);

      if (btnTestBridge) {
        btnTestBridge.disabled = false;
        btnTestBridge.textContent = "⚡ Check / Test Status";
      }

      if (res && (res.bridgeConnected || res.shortcutInstalled)) {
        if (onboardingDotBridge) onboardingDotBridge.className = "dot active";
        if (onboardingTextBridge) onboardingTextBridge.textContent = "Apple Reminders Connected ✓";
        if (onboardingSubBridge) {
          onboardingSubBridge.textContent = 'Target List: "Daily Pull List" • Ready to sync across Mac & iPhone';
        }
        if (userTriggered) {
          showBridgeAlert("✓ Success! Apple Reminders is connected and ready to receive your daily pull lists.", true);
        }
      } else {
        // Fallback: check if local helper responds directly on port 8989
        fetch("http://127.0.0.1:8989/health")
          .then((r) => r.ok ? r.json() : null)
          .then((health) => {
            if (health && health.status === "ok") {
              if (onboardingDotBridge) onboardingDotBridge.className = "dot active";
              if (onboardingTextBridge) onboardingTextBridge.textContent = "Apple Reminders Connected ✓";
              if (onboardingSubBridge) {
                onboardingSubBridge.textContent = 'Target List: "Daily Pull List" • Ready to sync across Mac & iPhone';
              }
              if (userTriggered) {
                showBridgeAlert("✓ Success! Apple Reminders is connected and ready to receive your daily pull lists.", true);
              }
            } else {
              if (onboardingDotBridge) onboardingDotBridge.className = "dot";
              if (onboardingTextBridge) onboardingTextBridge.textContent = "Apple Reminders: Setup Required";
              if (onboardingSubBridge) {
                onboardingSubBridge.textContent = "Install the official Apple Shortcut below to connect Reminders.";
              }
              if (userTriggered) {
                showBridgeAlert("No connection detected yet. If you already added the shortcut, click '✓ I've Added It' below to confirm.", false);
              }
            }
          })
          .catch(() => {
            if (onboardingDotBridge) onboardingDotBridge.className = "dot";
            if (onboardingTextBridge) onboardingTextBridge.textContent = "Apple Reminders: Setup Required";
            if (onboardingSubBridge) {
              onboardingSubBridge.textContent = "Install the official Apple Shortcut below to connect Reminders.";
            }
            if (userTriggered) {
              showBridgeAlert("No connection detected yet. If you already added the shortcut, click '✓ I've Added It' below to confirm.", false);
            }
          });
      }
    };

    if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.sendMessage) {
      chrome.runtime.sendMessage({ action: "checkStatus" }, (res) => {
        if (chrome.runtime.lastError) {
          console.warn("checkStatus bridge error:", chrome.runtime.lastError);
        }
        handleBridgeResult(res);
      });
    } else {
      handleBridgeResult(null);
    }
  }
  window.checkBridge = checkBridge;

  if (btnTestBridge) {
    btnTestBridge.addEventListener("click", () => checkBridge(true));
  }

  // Handle clicking the official Apple Shortcut install link
  const onInstallClick = () => {
    chrome.storage.local.set({ shortcutInstalled: true }, () => {
      if (onboardingDotBridge) onboardingDotBridge.className = "dot active";
      if (onboardingTextBridge) onboardingTextBridge.textContent = "Apple Reminders Connected ✓";
      if (onboardingSubBridge) {
        onboardingSubBridge.textContent = 'Target List: "Daily Pull List" • Ready to sync across Mac & iPhone';
      }
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
        if (onboardingDotBridge) onboardingDotBridge.className = "dot active";
        if (onboardingTextBridge) onboardingTextBridge.textContent = "Apple Reminders Connected ✓";
        if (onboardingSubBridge) {
          onboardingSubBridge.textContent = 'Target List: "Daily Pull List" • Ready to sync across Mac & iPhone';
        }
        showBridgeAlert("✓ Success! Apple Reminders marked connected and ready to receive your pull lists.", true);
        checkBridge(true);
      });
    });
  }

  // Handle testing shortcut directly
  if (btnTestShortcutDirect) {
    btnTestShortcutDirect.addEventListener("click", () => {
      chrome.storage.local.set({ shortcutInstalled: true }, () => {
        if (onboardingDotBridge) onboardingDotBridge.className = "dot active";
        if (onboardingTextBridge) onboardingTextBridge.textContent = "Apple Reminders Connected ✓";
        if (onboardingSubBridge) {
          onboardingSubBridge.textContent = 'Target List: "Daily Pull List" • Ready to sync across Mac & iPhone';
        }
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

    if (btnTestGoogle && userTriggered) {
      btnTestGoogle.disabled = true;
      btnTestGoogle.textContent = "⚡ Testing...";
    }
    if (onboardingDotGoogle && userTriggered) {
      onboardingDotGoogle.className = "dot checking";
    }

    // Fast-path: pre-check storage for instant rendering
    if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(["googleConnected", "google_refresh_token"], (stored) => {
        if (stored && (stored.googleConnected || stored.google_refresh_token)) {
          if (onboardingDotGoogle) onboardingDotGoogle.className = "dot active";
          if (onboardingTextGoogle) onboardingTextGoogle.textContent = "Connected to Google Tasks ✓";
          if (onboardingSubGoogle) {
            onboardingSubGoogle.textContent = 'Target List: "Daily Pull List" • Ready to sync!';
          }
          if (btnConnectGoogle) {
            btnConnectGoogle.textContent = "✓ Google Tasks Authorized";
            btnConnectGoogle.style.background = "#15803d";
          }
        }
      });
    }

    let resolved = false;
    const timeoutTimer = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        if (btnTestGoogle) {
          btnTestGoogle.disabled = false;
          btnTestGoogle.textContent = "⚡ Test Access";
        }
      }
    }, 4500);

    const handleGoogleResult = (res) => {
      if (resolved) return;
      resolved = true;
      clearTimeout(timeoutTimer);

      if (btnTestGoogle) {
        btnTestGoogle.disabled = false;
        btnTestGoogle.textContent = "⚡ Test Access";
      }

      if (res && res.googleConnected) {
        if (onboardingDotGoogle) onboardingDotGoogle.className = "dot active";
        if (onboardingTextGoogle) onboardingTextGoogle.textContent = "Connected to Google Tasks ✓";
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
        if (onboardingDotGoogle) onboardingDotGoogle.className = "dot";
        if (onboardingTextGoogle) onboardingTextGoogle.textContent = "Google Tasks Not Connected";
        if (onboardingSubGoogle) {
          onboardingSubGoogle.textContent = "Click 'Sign in with Google' to authorize your account.";
        }
        if (btnConnectGoogle) {
          btnConnectGoogle.textContent = "🔑 Sign in with Google";
          btnConnectGoogle.style.background = "linear-gradient(180deg, #1a73e8 0%, #1557b0 100%)";
        }
        if (userTriggered) {
          showGoogleAlert("Google Tasks is not authorized yet. Launching Google Sign-in now...", false);
          if (btnConnectGoogle) {
            btnConnectGoogle.click();
          }
        }
      }
    };

    if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.sendMessage) {
      chrome.runtime.sendMessage({ action: "checkStatus" }, (res) => {
        if (chrome.runtime.lastError) {
          console.warn("checkStatus google error:", chrome.runtime.lastError);
        }
        handleGoogleResult(res);
      });
    } else {
      handleGoogleResult(null);
    }
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

  // Step 1: Stripe Lifetime Access Integration
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
    if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({ isPaid: true, userEmail: user?.email || "" });
    }

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

    const btnContinueToStep2 = document.getElementById("btnContinueToStep2");
    const checkoutTrustLine = document.getElementById("checkoutTrustLine");
    const checkoutRestoreRow = document.getElementById("checkoutRestoreRow");

    if (btnExtPayCheckout) {
      btnExtPayCheckout.style.setProperty("display", "none", "important");
      btnExtPayCheckout.classList.add("btn-hidden");
    }
    if (btnContinueToStep2) {
      btnContinueToStep2.style.setProperty("display", "flex", "important");
      btnContinueToStep2.classList.remove("btn-hidden");
    }
    if (checkoutTrustLine) {
      checkoutTrustLine.style.setProperty("display", "none", "important");
      checkoutTrustLine.classList.add("btn-hidden");
    }
    if (checkoutRestoreRow) {
      checkoutRestoreRow.style.setProperty("display", "none", "important");
      checkoutRestoreRow.classList.add("btn-hidden");
    }
    if (btnExtPayLogin) btnExtPayLogin.style.display = "none";
    if (paymentStatusBox) paymentStatusBox.style.display = "none";

    if (paidUserEmailText) {
      if (user?.email) {
        paidUserEmailText.textContent = `License verified for ${user.email}. All setup steps unlocked!`;
      } else {
        paidUserEmailText.textContent = "License verified. All setup steps unlocked!";
      }
    }
    if (paymentSuccessBox) {
      paymentSuccessBox.style.display = "block";
    }

    if (typeof checkBridge === "function") checkBridge(false);
    if (typeof checkGoogleTasks === "function") checkGoogleTasks(false);
  }
  window.applyPaidState = applyPaidState;

  // Check URL query parameters for instant post-checkout unlock
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get("paid") === "true") {
    const emailParam = urlParams.get("email") || "";
    applyPaidState({ email: emailParam });
    if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({ isPaid: true, userEmail: emailParam });
    }
  }

  // Pre-check storage cache for instant rendering
  if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
    chrome.storage.local.get(["isPaid", "userEmail"], (res) => {
      if (res && res.isPaid) {
        applyPaidState({ email: res.userEmail || "" });
      }
    });
  }

  // Stripe Checkout Button Handler
  if (btnExtPayCheckout) {
    btnExtPayCheckout.addEventListener("click", () => {
      const stripePaymentLink = (typeof CONFIG !== "undefined" && CONFIG.STRIPE_PAYMENT_LINK)
        ? CONFIG.STRIPE_PAYMENT_LINK
        : "https://buy.stripe.com/4gM6oB1CdbNL1MI0h9dAk00";
      window.open(stripePaymentLink, "_blank");
    });
  }

  // Restore License Modal & API Verification
  const restoreModal = document.getElementById("restoreModal");
  const btnCloseRestoreModal = document.getElementById("btnCloseRestoreModal");
  const restoreEmailInput = document.getElementById("restoreEmailInput");
  const btnSubmitRestore = document.getElementById("btnSubmitRestore");
  const restoreMsgBox = document.getElementById("restoreMsgBox");

  function openRestoreModal() {
    if (restoreModal) {
      if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
        chrome.storage.local.get("userEmail", (res) => {
          if (res?.userEmail && restoreEmailInput) restoreEmailInput.value = res.userEmail;
        });
      }
      if (restoreMsgBox) restoreMsgBox.style.display = "none";
      restoreModal.showModal();
    }
  }

  if (urlParams.get("restore") === "true") {
    openRestoreModal();
  }

  if (btnExtPayLogin) {
    btnExtPayLogin.addEventListener("click", openRestoreModal);
  }

  if (btnCloseRestoreModal && restoreModal) {
    btnCloseRestoreModal.addEventListener("click", () => restoreModal.close());
    restoreModal.addEventListener("click", (e) => {
      if (e.target === restoreModal) restoreModal.close();
    });
  }

  if (btnSubmitRestore) {
    btnSubmitRestore.addEventListener("click", async () => {
      const email = (restoreEmailInput?.value || "").trim().toLowerCase();
      if (!email || !email.includes("@")) {
        if (restoreMsgBox) {
          restoreMsgBox.style.display = "block";
          restoreMsgBox.style.background = "#fee2e2";
          restoreMsgBox.style.color = "#991b1b";
          restoreMsgBox.textContent = "Please enter a valid email address.";
        }
        return;
      }

      btnSubmitRestore.disabled = true;
      btnSubmitRestore.textContent = "Verifying with Stripe...";
      if (restoreMsgBox) restoreMsgBox.style.display = "none";

      try {
        const verifyUrl = (typeof CONFIG !== "undefined" && CONFIG.LICENSE_VERIFY_URL)
          ? CONFIG.LICENSE_VERIFY_URL
          : "https://nifty-pull-list-auth.picklist-auth.workers.dev/api/license/verify";

        const resp = await fetch(`${verifyUrl}?email=${encodeURIComponent(email)}`);
        const data = await resp.json();

        if (data && data.paid) {
          if (restoreMsgBox) {
            restoreMsgBox.style.display = "block";
            restoreMsgBox.style.background = "#dcfce7";
            restoreMsgBox.style.color = "#166534";
            restoreMsgBox.textContent = "✓ License verified! Unlocking PickList...";
          }
          applyPaidState({ email });
          if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
            await chrome.storage.local.set({ isPaid: true, userEmail: email });
          }
          setTimeout(() => {
            if (restoreModal) restoreModal.close();
            goToStep(2);
          }, 1200);
        } else {
          if (restoreMsgBox) {
            restoreMsgBox.style.display = "block";
            restoreMsgBox.style.background = "#fee2e2";
            restoreMsgBox.style.color = "#991b1b";
            restoreMsgBox.textContent = data.message || "No paid lifetime license found for this email. Check spelling or purchase a license.";
          }
        }
      } catch (err) {
        if (restoreMsgBox) {
          restoreMsgBox.style.display = "block";
          restoreMsgBox.style.background = "#fee2e2";
          restoreMsgBox.style.color = "#991b1b";
          restoreMsgBox.textContent = "Connection error. Please try again in a moment.";
        }
      } finally {
        btnSubmitRestore.disabled = false;
        btnSubmitRestore.textContent = "Verify & Unlock License";
      }
    });
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
      const platform = mockItem.getAttribute("data-platform") || (mockItem.closest("#demoGoogleContainer, #destGoogleContainer") ? "google" : "apple");
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

  // Video Walkthrough Modal Dialog
  const videoModal = document.getElementById("videoModal");
  const videoModalIframe = document.getElementById("videoModalIframe");
  const btnOpenVideoModal = document.getElementById("btnOpenVideoModal");
  const btnCloseVideoModal = document.getElementById("btnCloseVideoModal");

  function openVideoModal() {
    if (videoModal) {
      if (videoModalIframe && (!videoModalIframe.src || videoModalIframe.src.endsWith("src/onboarding.html") || videoModalIframe.src === "about:blank")) {
        videoModalIframe.src = "https://www.loom.com/embed/7890456879c04e14948ffe996555a12f";
      }
      videoModal.showModal();
    }
  }

  function closeVideoModal() {
    if (videoModal) {
      videoModal.close();
      if (videoModalIframe && videoModalIframe.src) {
        // Soft reload iframe to stop audio
        const currentSrc = videoModalIframe.src;
        videoModalIframe.src = "";
        setTimeout(() => { videoModalIframe.src = currentSrc; }, 200);
      }
    }
  }

  if (btnOpenVideoModal) {
    btnOpenVideoModal.addEventListener("click", openVideoModal);
  }

  if (btnCloseVideoModal) {
    btnCloseVideoModal.addEventListener("click", closeVideoModal);
  }

  document.querySelectorAll("[data-open-video-modal]").forEach((el) => {
    el.addEventListener("click", openVideoModal);
  });

  if (videoModal) {
    videoModal.addEventListener("click", (e) => {
      const rect = videoModal.getBoundingClientRect();
      const isInDialog = (
        rect.top <= e.clientY &&
        e.clientY <= rect.top + rect.height &&
        rect.left <= e.clientX &&
        e.clientX <= rect.left + rect.width
      );
      if (!isInDialog) {
        closeVideoModal();
      }
    });

    videoModal.addEventListener("cancel", () => {
      if (videoModalIframe) videoModalIframe.src = "";
    });
  }

  // Re-check payment status whenever user refocuses this tab (e.g. returning from Stripe checkout)
  window.addEventListener("focus", () => {
    if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(["isPaid", "userEmail"], (res) => {
        if (res && res.isPaid) {
          applyPaidState({ email: res.userEmail || "" });
        }
      });
    }
    checkNifty();
  });

  // Run initial checks
  checkNifty();
  checkBridge();
  checkGoogleTasks();
});
