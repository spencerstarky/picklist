// guide.js - Interactive behaviors for PickList Guide & Reseller Showcase
// Strict Manifest V3 compliant: zero inline scripts or inline event handlers

document.addEventListener('DOMContentLoaded', () => {
  // ==========================================
  // 1. Interactive Pull List Demo
  // ==========================================
  let activeGuideView = 'floor';

  function playTactileClick() {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(420, ctx.currentTime + 0.04);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.04);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.04);
    } catch (e) {
      // Audio context fallback
    }
  }

  function updateCounter() {
    const activeStack = document.getElementById(`interactive-demo-${activeGuideView}`);
    if (!activeStack) return;
    const items = activeStack.querySelectorAll('.interactive-item');
    const completed = activeStack.querySelectorAll('.interactive-item.completed');
    const remaining = items.length - completed.length;
    const counterEl = document.getElementById('live-count-pill');
    if (counterEl) {
      if (remaining === 0) {
        counterEl.textContent = '🎉 All items pulled!';
        counterEl.style.background = '#dcfce7';
        counterEl.style.color = '#15803d';
      } else {
        counterEl.textContent = `${remaining} item${remaining === 1 ? '' : 's'} remaining`;
        if (activeGuideView === 'google') {
          counterEl.style.background = 'rgba(26, 115, 232, 0.12)';
          counterEl.style.color = '#1a73e8';
        } else if (activeGuideView === 'apple') {
          counterEl.style.background = 'rgba(0, 113, 227, 0.12)';
          counterEl.style.color = 'var(--accent)';
        } else {
          counterEl.style.background = 'var(--success-light)';
          counterEl.style.color = 'var(--success)';
        }
      }
    }
  }

  function switchGuideDemoView(view) {
    activeGuideView = view;
    ['floor', 'apple', 'google'].forEach(v => {
      const stack = document.getElementById(`interactive-demo-${v}`);
      const tabBtn = document.getElementById(`tab-btn-${v}`);
      if (stack) stack.style.display = v === view ? 'flex' : 'none';
      if (tabBtn) tabBtn.classList.toggle('active', v === view);
    });
    playTactileClick();
    updateCounter();
  }

  function resetGuideDemo() {
    const activeStack = document.getElementById(`interactive-demo-${activeGuideView}`);
    if (!activeStack) return;
    const completed = activeStack.querySelectorAll('.interactive-item.completed');
    completed.forEach(item => item.classList.remove('completed'));
    playTactileClick();
    updateCounter();
  }

  // Bind tab buttons
  const tabFloor = document.getElementById('tab-btn-floor');
  const tabApple = document.getElementById('tab-btn-apple');
  const tabGoogle = document.getElementById('tab-btn-google');
  if (tabFloor) tabFloor.addEventListener('click', () => switchGuideDemoView('floor'));
  if (tabApple) tabApple.addEventListener('click', () => switchGuideDemoView('apple'));
  if (tabGoogle) tabGoogle.addEventListener('click', () => switchGuideDemoView('google'));

  // Bind reset button
  const btnReset = document.getElementById('btn-guide-reset');
  if (btnReset) btnReset.addEventListener('click', resetGuideDemo);

  // Event delegation for all checklist items
  document.addEventListener('click', (e) => {
    const item = e.target.closest('.interactive-item');
    if (item && item.closest('.live-checklist-card')) {
      item.classList.toggle('completed');
      playTactileClick();
      updateCounter();
    }
  });

  // ==========================================
  // 2. Browser Extension Dropdown Simulator
  // ==========================================
  let isSimDropdownOpen = true;
  const dropdown = document.getElementById('sim-popup-dropdown');
  const trigger = document.getElementById('sim-ext-trigger');
  const hint = document.getElementById('sim-click-hint');
  const viewport = document.getElementById('browser-viewport');

  function toggleSimDropdown(e) {
    if (e) e.stopPropagation();
    isSimDropdownOpen = !isSimDropdownOpen;
    if (dropdown) dropdown.classList.toggle('open', isSimDropdownOpen);
    if (trigger) trigger.classList.toggle('active', isSimDropdownOpen);
    if (hint && isSimDropdownOpen) hint.style.display = 'none';
  }

  if (trigger) trigger.addEventListener('click', toggleSimDropdown);
  if (hint) hint.addEventListener('click', toggleSimDropdown);
  if (dropdown) dropdown.addEventListener('click', (e) => e.stopPropagation());
  if (viewport) {
    viewport.addEventListener('click', (e) => {
      if (isSimDropdownOpen && !e.target.closest('#sim-popup-dropdown') && !e.target.closest('#sim-ext-trigger')) {
        toggleSimDropdown();
      }
    });
  }

  // Sim Destination Tabs
  const appleTabBtn = document.getElementById('sim-tab-apple');
  const googleTabBtn = document.getElementById('sim-tab-google');
  const statusText = document.getElementById('sim-dest-status-text');
  const footerTarget = document.getElementById('sim-footer-target');

  function simSetTab(platform) {
    if (platform === 'apple') {
      if (appleTabBtn) appleTabBtn.classList.add('active');
      if (googleTabBtn) googleTabBtn.classList.remove('active');
      if (statusText) statusText.textContent = 'Reminders Active';
      if (footerTarget) footerTarget.textContent = 'Reminders: "Daily Pull List"';
    } else {
      if (googleTabBtn) googleTabBtn.classList.add('active');
      if (appleTabBtn) appleTabBtn.classList.remove('active');
      if (statusText) statusText.textContent = 'Tasks Active';
      if (footerTarget) footerTarget.textContent = 'Google Tasks: "Daily Pull List"';
    }
  }

  if (appleTabBtn) appleTabBtn.addEventListener('click', () => simSetTab('apple'));
  if (googleTabBtn) googleTabBtn.addEventListener('click', () => simSetTab('google'));

  // Sim Time Filter Select
  const timeSelect = document.getElementById('sim-time-select');
  if (timeSelect) {
    timeSelect.addEventListener('change', () => {
      const val = timeSelect.value;
      const pill = document.getElementById('sim-filter-pill');
      const sub = document.getElementById('sim-filter-subtext');
      if (pill) pill.textContent = val;
      if (sub) {
        if (val === 'Today') {
          sub.innerHTML = 'Pulls all items sold <strong>Today since 12:00 AM</strong>';
        } else if (val === '24 Hours') {
          sub.innerHTML = 'Pulls items sold in the <strong>last 24 hours</strong>';
        } else if (val === 'All Unshipped') {
          sub.innerHTML = 'Pulls <strong>all active unshipped sales</strong>';
        } else {
          sub.innerHTML = 'Pulls items sold since <strong>Today at 4:37 PM</strong>';
        }
      }
    });
  }

  // Sim Sync Button
  let isSimSyncing = false;
  const simSyncBtn = document.getElementById('sim-sync-btn');
  if (simSyncBtn) {
    simSyncBtn.addEventListener('click', () => {
      if (isSimSyncing) return;
      isSimSyncing = true;

      const icon = document.getElementById('sim-sync-icon');
      const txt = document.getElementById('sim-sync-text');
      const bar = document.getElementById('sim-status-bar');

      simSyncBtn.classList.add('syncing');
      if (icon) icon.textContent = '⏳';
      if (txt) txt.textContent = 'Reading Nifty orders...';
      if (bar) {
        bar.textContent = 'Found 16 sales across eBay, Poshmark, Mercari...';
        bar.classList.add('highlight');
      }

      setTimeout(() => {
        if (txt) txt.textContent = 'Sequencing 16 physical SKUs...';
        if (bar) bar.textContent = 'Sorting numeric racks & location bins...';
      }, 900);

      setTimeout(() => {
        simSyncBtn.classList.remove('syncing');
        simSyncBtn.classList.add('success');
        if (icon) icon.textContent = '✅';
        if (txt) txt.textContent = '16 Items Synced!';
        if (bar) bar.textContent = 'Pull list delivered to Daily Pull List';

        setTimeout(() => {
          simSyncBtn.classList.remove('success');
          if (icon) icon.textContent = '⚡';
          if (txt) txt.textContent = 'Sync Pull List Now';
          if (bar) {
            bar.textContent = 'Ready to sync';
            bar.classList.remove('highlight');
          }
          isSimSyncing = false;
        }, 3200);
      }, 1900);
    });
  }

  // Initial counter calculation
  updateCounter();
});
