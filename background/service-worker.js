/**
 * SlopBlocker Background Service Worker
 * Handles extension lifecycle and cross-tab communication
 */

// Track detection stats across tabs
const tabStats = new Map();

// Initialize on install
chrome.runtime.onInstalled.addListener((details) => {
  console.log('SlopBlocker installed:', details.reason);

  // Set default settings
  chrome.storage.local.set({
    enabled: true,
    stats: {
      totalBlocked: 0,
      totalWarned: 0,
      totalScanned: 0,
    },
  });

  // Set badge
  chrome.action.setBadgeBackgroundColor({ color: '#00d9ff' });
});

// Listen for messages from content scripts
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
      return true; // Keep channel open for async response
  }
});

/**
 * Handle harmful content detection
 */
function handleHarmfulContentDetected(tabId, data) {
  // Update badge to show detection
  if (tabId) {
    chrome.action.setBadgeText({ text: '!', tabId });
    chrome.action.setBadgeBackgroundColor({ color: '#e94560', tabId });

    // Clear badge after 3 seconds
    setTimeout(() => {
      updateBadgeForTab(tabId);
    }, 3000);
  }

  // Log for debugging
  console.log('Harmful content detected:', data);
}

/**
 * Handle stats update from content script
 */
async function handleStatsUpdate(tabId, stats) {
  if (!tabId) return;

  tabStats.set(tabId, stats);
  updateBadgeForTab(tabId);

  // Update global stats
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
 * Tracks cumulative stats by storing previous tab values and computing deltas
 */
const previousTabStats = new Map();

async function updateGlobalStats(tabId, newStats) {
  const { stats = { totalBlocked: 0, totalWarned: 0, totalScanned: 0 } } =
    await chrome.storage.local.get('stats');

  // Get previous stats for this tab to compute the delta
  const prevStats = previousTabStats.get(tabId) || { blocked: 0, warned: 0, scanned: 0 };

  // Only add the increment (delta) to global stats
  const blockedDelta = Math.max(0, (newStats.blocked || 0) - prevStats.blocked);
  const warnedDelta = Math.max(0, (newStats.warned || 0) - prevStats.warned);
  const scannedDelta = Math.max(0, (newStats.scanned || 0) - prevStats.scanned);

  stats.totalBlocked += blockedDelta;
  stats.totalWarned += warnedDelta;
  stats.totalScanned += scannedDelta;

  // Store current stats as previous for next update
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
