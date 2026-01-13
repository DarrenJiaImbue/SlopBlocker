/**
 * SlopBlocker Popup Script
 * Controls the extension popup UI and communicates with content scripts
 */

document.addEventListener('DOMContentLoaded', async () => {
  // DOM elements
  const enableToggle = document.getElementById('enableToggle');
  const blockedCount = document.getElementById('blockedCount');
  const warnedCount = document.getElementById('warnedCount');
  const scannedCount = document.getElementById('scannedCount');
  const siteName = document.getElementById('siteName');
  const behaviorMode = document.getElementById('behaviorMode');
  const rescanBtn = document.getElementById('rescanBtn');
  const recentList = document.getElementById('recentList');

  // Get current tab
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  let hostname = 'Unknown';
  try {
    if (tab?.url) {
      hostname = new URL(tab.url).hostname;
    }
  } catch (e) {
    console.log('Could not parse URL:', e.message);
  }

  // Update site info
  siteName.textContent = hostname;

  // Determine behavior mode based on site
  const emailSites = ['mail.google.com', 'outlook.live.com', 'outlook.office.com', 'mail.yahoo.com', 'proton.me', 'protonmail.com'];
  const socialSites = ['twitter.com', 'x.com', 'facebook.com', 'reddit.com', 'instagram.com', 'tiktok.com'];

  if (emailSites.some(site => hostname.includes(site))) {
    behaviorMode.textContent = 'Email Protection (Warnings)';
    behaviorMode.style.color = '#ffd700';
  } else if (socialSites.some(site => hostname.includes(site))) {
    behaviorMode.textContent = 'Feed Protection (Auto-remove)';
    behaviorMode.style.color = '#00d9ff';
  } else {
    behaviorMode.textContent = 'Standard Protection';
    behaviorMode.style.color = '#a0a0a0';
  }

  // Load enabled state from storage
  const { enabled = true } = await chrome.storage.local.get('enabled');
  enableToggle.checked = enabled;

  // Get stats from content script
  async function updateStats() {
    if (!tab?.id) return;
    try {
      const response = await chrome.tabs.sendMessage(tab.id, { type: 'GET_STATS' });
      if (response) {
        blockedCount.textContent = response.blocked || 0;
        warnedCount.textContent = response.warned || 0;
        scannedCount.textContent = response.scanned || 0;

        // Update recent detections display
        if (response.blocked > 0 || response.warned > 0) {
          recentList.innerHTML = `
            <div class="detection-item">
              <span class="detection-icon">${response.warned > 0 ? '⚠️' : '🚫'}</span>
              <span class="detection-text">
                ${response.warned > 0 ? `${response.warned} warning(s) shown` : ''}
                ${response.blocked > 0 ? `${response.blocked} item(s) blocked` : ''}
              </span>
            </div>
          `;
        }
      }
    } catch (e) {
      // Content script may not be loaded on this page
      console.log('Could not get stats:', e.message);
    }
  }

  // Initial stats load
  await updateStats();

  // Toggle enabled state
  enableToggle.addEventListener('change', async () => {
    const newEnabled = enableToggle.checked;
    await chrome.storage.local.set({ enabled: newEnabled });

    if (!tab?.id) return;
    try {
      await chrome.tabs.sendMessage(tab.id, {
        type: 'TOGGLE_ENABLED',
        enabled: newEnabled,
      });
    } catch (e) {
      console.log('Could not toggle content script:', e.message);
    }
  });

  // Rescan button
  rescanBtn.addEventListener('click', async () => {
    if (!tab?.id) return;

    rescanBtn.disabled = true;
    rescanBtn.innerHTML = '<span class="btn-icon">⏳</span> Scanning...';

    try {
      await chrome.tabs.sendMessage(tab.id, { type: 'RESCAN' });
      await new Promise(resolve => setTimeout(resolve, 2000));
      await updateStats();
    } catch (e) {
      console.log('Could not rescan:', e.message);
    }

    rescanBtn.disabled = false;
    rescanBtn.innerHTML = '<span class="btn-icon">🔄</span> Rescan Page';
  });

  // Listen for updates from content script
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'UPDATE_STATS') {
      blockedCount.textContent = message.data.blocked || 0;
      warnedCount.textContent = message.data.warned || 0;
      scannedCount.textContent = message.data.scanned || 0;
    }
  });
});
