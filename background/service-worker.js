/**
 * SlopBlocker Background Service Worker
 * Handles extension lifecycle, cross-tab communication, and settings management
 */

// Track detection stats across tabs
const tabStats = new Map();

// Initialize on install
chrome.runtime.onInstalled.addListener((details) => {
  console.log('SlopBlocker installed:', details.reason);

  // Set default settings
  chrome.storage.local.set({
    enabled: true,
    apiKey: '',
    contentPreferences: '',
    harmThreshold: 0.5,
    stats: {
      totalBlocked: 0,
      totalWarned: 0,
      totalScanned: 0,
    },
  });

  // Set badge
  chrome.action.setBadgeBackgroundColor({ color: '#00d9ff' });

  // Open options page on first install
  if (details.reason === 'install') {
    chrome.runtime.openOptionsPage();
  }
});

// Listen for messages from content scripts and popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const tabId = sender.tab?.id;

  switch (message.type) {
    case 'HARMFUL_CONTENT_DETECTED':
      handleHarmfulContentDetected(tabId, message.data);
      break;

    case 'UPDATE_STATS':
      handleStatsUpdate(tabId, message.data);
      break;

    case 'GET_GLOBAL_STATS':
      chrome.storage.local.get('stats', (result) => {
        sendResponse(result.stats || { totalBlocked: 0, totalWarned: 0, totalScanned: 0 });
      });
      return true;

    case 'OPEN_OPTIONS':
      chrome.runtime.openOptionsPage();
      break;

    case 'GET_SETTINGS':
      chrome.storage.local.get(['apiKey', 'contentPreferences', 'harmThreshold', 'enabled'], (result) => {
        sendResponse(result);
      });
      return true;

    case 'SAVE_SETTINGS':
      chrome.storage.local.set(message.settings, () => {
        // Notify all tabs about settings update
        chrome.tabs.query({}, (tabs) => {
          tabs.forEach((tab) => {
            chrome.tabs.sendMessage(tab.id, {
              type: 'SETTINGS_UPDATED',
              settings: message.settings,
            }).catch(() => {
              // Tab might not have content script
            });
          });
        });
        sendResponse({ success: true });
      });
      return true;

    case 'TEST_API_KEY':
      testApiKey(message.apiKey).then((result) => {
        sendResponse(result);
      });
      return true;
  }
});

/**
 * Test if an API key is valid
 */
async function testApiKey(apiKey) {
  if (!apiKey) {
    return { valid: false, error: 'No API key provided' };
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 10,
        messages: [{ role: 'user', content: 'Hi' }],
      }),
    });

    if (response.ok) {
      return { valid: true };
    } else {
      const data = await response.json().catch(() => ({}));
      return {
        valid: false,
        error: data.error?.message || `HTTP ${response.status}`,
      };
    }
  } catch (error) {
    return { valid: false, error: error.message };
  }
}

/**
 * Handle harmful content detection
 */
function handleHarmfulContentDetected(tabId, data) {
  if (tabId) {
    chrome.action.setBadgeText({ text: '!', tabId });
    chrome.action.setBadgeBackgroundColor({ color: '#e94560', tabId });

    setTimeout(() => {
      updateBadgeForTab(tabId);
    }, 3000);
  }

  console.log('Harmful content detected:', data);
}

/**
 * Handle stats update from content script
 */
async function handleStatsUpdate(tabId, stats) {
  if (!tabId) return;

  tabStats.set(tabId, stats);
  updateBadgeForTab(tabId);
  await updateGlobalStats(tabId, stats);
}

/**
 * Update badge for a specific tab
 */
function updateBadgeForTab(tabId) {
  const stats = tabStats.get(tabId);

  if (stats && (stats.blocked > 0 || stats.warned > 0)) {
    const count = stats.blocked + stats.warned;
    chrome.action.setBadgeText({ text: count.toString(), tabId });
    chrome.action.setBadgeBackgroundColor({
      color: stats.blocked > 0 ? '#e94560' : '#ffd700',
      tabId,
    });
  } else {
    chrome.action.setBadgeText({ text: '', tabId });
  }
}

/**
 * Update global statistics in storage
 */
const previousTabStats = new Map();

async function updateGlobalStats(tabId, newStats) {
  const { stats = { totalBlocked: 0, totalWarned: 0, totalScanned: 0 } } =
    await chrome.storage.local.get('stats');

  const prevStats = previousTabStats.get(tabId) || { blocked: 0, warned: 0, scanned: 0 };

  const blockedDelta = Math.max(0, (newStats.blocked || 0) - prevStats.blocked);
  const warnedDelta = Math.max(0, (newStats.warned || 0) - prevStats.warned);
  const scannedDelta = Math.max(0, (newStats.scanned || 0) - prevStats.scanned);

  stats.totalBlocked += blockedDelta;
  stats.totalWarned += warnedDelta;
  stats.totalScanned += scannedDelta;

  previousTabStats.set(tabId, { ...newStats });

  await chrome.storage.local.set({ stats });
}

// Clean up when tab is closed
chrome.tabs.onRemoved.addListener((tabId) => {
  tabStats.delete(tabId);
  previousTabStats.delete(tabId);
});

// Reset tab stats when navigating
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === 'loading') {
    tabStats.delete(tabId);
    previousTabStats.delete(tabId);
    chrome.action.setBadgeText({ text: '', tabId });
  }
});

console.log('SlopBlocker service worker initialized');
