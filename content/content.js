/**
 * SlopBlocker Content Script
 * Scans page content for harmful material using AI-powered detection
 */

(function() {
  'use strict';

  // Configuration
  const CONFIG = {
    scanInterval: 5000, // Re-scan for dynamic content (longer due to API calls)
    maxConcurrentAnalysis: 3, // Limit concurrent API calls
    enabled: true,
    configured: false,
  };

  // Track processed elements and pending analyses
  const processedElements = new WeakSet();
  const pendingElements = new WeakSet();
  let analysisQueue = [];
  let activeAnalyses = 0;

  // Stats for popup
  let stats = {
    blocked: 0,
    warned: 0,
    scanned: 0,
  };

  /**
   * Create warning overlay for email content
   */
  function createWarningOverlay(element, analysis) {
    const overlay = document.createElement('div');
    overlay.className = 'slopblocker-warning-overlay';

    const warningType = analysis.type || 'Harmful Content';
    const formattedType = warningType.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

    overlay.innerHTML = `
      <div class="slopblocker-warning-content">
        <div class="slopblocker-warning-header">
          <span class="slopblocker-warning-icon">⚠️</span>
          <span class="slopblocker-warning-title">SlopBlocker: ${formattedType} Detected</span>
        </div>
        <div class="slopblocker-warning-body">
          <p><strong>Warning:</strong> This content has been flagged as potentially harmful.</p>
          <p class="slopblocker-warning-details">
            <strong>Confidence:</strong> ${Math.round((analysis.score || analysis.confidence) * 100)}%<br>
            <strong>Reason:</strong> ${analysis.reason || 'Content matches your filter preferences'}
          </p>
          <p class="slopblocker-warning-advice">
            This content was flagged based on your content preferences.
          </p>
        </div>
        <div class="slopblocker-warning-actions">
          <button class="slopblocker-btn slopblocker-btn-safe" data-action="hide">
            Hide Content
          </button>
          <button class="slopblocker-btn slopblocker-btn-danger" data-action="show">
            Show Anyway
          </button>
        </div>
      </div>
    `;

    // Add click handlers
    overlay.querySelector('[data-action="hide"]').addEventListener('click', () => {
      element.style.display = 'none';
      overlay.remove();
    });

    overlay.querySelector('[data-action="show"]').addEventListener('click', () => {
      overlay.remove();
      element.dataset.slopblockerDismissed = 'true';
    });

    // Position overlay
    const parent = element.parentElement;
    if (parent) {
      parent.style.position = 'relative';
      parent.insertBefore(overlay, element);
    }

    return overlay;
  }

  /**
   * Remove harmful content from feed
   */
  function removeHarmfulContent(element, analysis) {
    const placeholder = document.createElement('div');
    placeholder.className = 'slopblocker-removed-placeholder';

    const typeLabel = analysis.type
      ? analysis.type.replace(/_/g, ' ')
      : 'harmful content';

    placeholder.innerHTML = `
      <div class="slopblocker-removed-content">
        <span class="slopblocker-removed-icon">🛡️</span>
        <span class="slopblocker-removed-text">
          Content removed by SlopBlocker (${typeLabel})
        </span>
        <button class="slopblocker-btn-small" data-action="undo">Undo</button>
      </div>
    `;

    const originalDisplay = element.style.display;
    element.style.display = 'none';
    element.parentElement?.insertBefore(placeholder, element);

    placeholder.querySelector('[data-action="undo"]').addEventListener('click', () => {
      element.style.display = originalDisplay;
      element.dataset.slopblockerDismissed = 'true';
      placeholder.remove();
      stats.blocked--;
      updateStats();
    });

    return placeholder;
  }

  /**
   * Show configuration needed message
   */
  function showConfigNeeded() {
    // Only show once per page
    if (document.querySelector('.slopblocker-config-notice')) return;

    const notice = document.createElement('div');
    notice.className = 'slopblocker-config-notice';
    notice.innerHTML = `
      <div style="
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: #1a1a2e;
        border: 1px solid #00d9ff;
        border-radius: 8px;
        padding: 16px;
        color: #fff;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 14px;
        z-index: 999999;
        max-width: 300px;
        box-shadow: 0 4px 20px rgba(0, 217, 255, 0.2);
      ">
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
          <span style="font-size: 20px;">🛡️</span>
          <strong>SlopBlocker</strong>
        </div>
        <p style="margin: 0 0 12px 0; color: #a0a0a0;">
          Please configure your API key and content preferences to enable AI-powered content blocking.
        </p>
        <button id="slopblocker-open-settings" style="
          background: #00d9ff;
          color: #000;
          border: none;
          padding: 8px 16px;
          border-radius: 4px;
          cursor: pointer;
          font-weight: 500;
        ">Open Settings</button>
        <button id="slopblocker-dismiss-notice" style="
          background: transparent;
          color: #666;
          border: 1px solid #333;
          padding: 8px 16px;
          border-radius: 4px;
          cursor: pointer;
          margin-left: 8px;
        ">Dismiss</button>
      </div>
    `;

    document.body.appendChild(notice);

    notice.querySelector('#slopblocker-open-settings').addEventListener('click', () => {
      chrome.runtime?.sendMessage({ type: 'OPEN_OPTIONS' });
      notice.remove();
    });

    notice.querySelector('#slopblocker-dismiss-notice').addEventListener('click', () => {
      notice.remove();
    });
  }

  /**
   * Process analysis queue with concurrency control
   */
  async function processQueue() {
    while (analysisQueue.length > 0 && activeAnalyses < CONFIG.maxConcurrentAnalysis) {
      const { element, text } = analysisQueue.shift();
      activeAnalyses++;

      // Process asynchronously and continue queue processing when done
      analyzeAndProcess(element, text).finally(() => {
        activeAnalyses--;
        pendingElements.delete(element);
        // Continue processing remaining items in queue
        if (analysisQueue.length > 0) {
          processQueue();
        }
      });
    }
  }

  /**
   * Analyze element and take action
   */
  async function analyzeAndProcess(element, text) {
    const analysis = await window.HarmfulContentDetector.analyzeText(text);

    // Check if configuration is needed
    if (analysis.needsConfig) {
      CONFIG.configured = false;
      showConfigNeeded();
      return;
    }

    CONFIG.configured = true;
    stats.scanned++;

    if (analysis.isHarmful) {
      const hostname = window.location.hostname;
      const behavior = window.HarmfulContentDetector.getBehavior(hostname);

      if (behavior === 'warn') {
        createWarningOverlay(element, analysis);
        stats.warned++;
      } else {
        removeHarmfulContent(element, analysis);
        stats.blocked++;
      }

      updateStats();

      // Notify background script
      chrome.runtime?.sendMessage({
        type: 'HARMFUL_CONTENT_DETECTED',
        data: {
          url: window.location.href,
          analysisType: analysis.type,
          confidence: analysis.score || analysis.confidence,
          reason: analysis.reason,
        },
      });
    }
  }

  /**
   * Process a single element
   */
  function processElement(element) {
    // Skip if already processed, pending, or dismissed
    if (processedElements.has(element) ||
        pendingElements.has(element) ||
        element.dataset.slopblockerDismissed) {
      return;
    }

    // Mark as processed
    processedElements.add(element);

    // Get text content
    const text = element.textContent || element.innerText || '';
    if (text.length < 20) return;

    // Add to analysis queue
    pendingElements.add(element);
    analysisQueue.push({ element, text });

    // Process queue
    processQueue();
  }

  /**
   * Scan page for harmful content
   */
  function scanPage() {
    if (!CONFIG.enabled) return;

    const hostname = window.location.hostname;
    const selectors = window.HarmfulContentDetector.getContentSelectors(hostname);

    for (const selector of selectors) {
      const elements = document.querySelectorAll(selector);
      elements.forEach(processElement);
    }
  }

  /**
   * Update stats and notify popup
   */
  function updateStats() {
    chrome.runtime?.sendMessage({
      type: 'UPDATE_STATS',
      data: stats,
    });
  }

  /**
   * Set up mutation observer for dynamic content
   */
  function observeDynamicContent() {
    const observer = new MutationObserver((mutations) => {
      let shouldScan = false;

      for (const mutation of mutations) {
        if (mutation.addedNodes.length > 0) {
          shouldScan = true;
          break;
        }
      }

      if (shouldScan) {
        clearTimeout(observeDynamicContent.timeout);
        observeDynamicContent.timeout = setTimeout(scanPage, 1000);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  /**
   * Listen for messages from popup/background
   */
  function setupMessageListener() {
    chrome.runtime?.onMessage.addListener((message, sender, sendResponse) => {
      switch (message.type) {
        case 'GET_STATS':
          sendResponse(stats);
          break;
        case 'TOGGLE_ENABLED':
          CONFIG.enabled = message.enabled;
          if (CONFIG.enabled) {
            scanPage();
          }
          sendResponse({ enabled: CONFIG.enabled });
          break;
        case 'RESCAN':
          // Clear processed elements to allow re-scanning
          scanPage();
          sendResponse({ scanned: true });
          break;
        case 'SETTINGS_UPDATED':
          // Reload settings in detector
          window.HarmfulContentDetector.updateSettings(message.settings);
          CONFIG.configured = window.HarmfulContentDetector.isConfigured();
          sendResponse({ updated: true });
          break;
      }
      return true;
    });
  }

  /**
   * Listen for storage changes
   */
  function setupStorageListener() {
    chrome.storage?.onChanged.addListener((changes, namespace) => {
      if (namespace === 'local') {
        const newSettings = {};
        if (changes.apiKey) newSettings.apiKey = changes.apiKey.newValue;
        if (changes.contentPreferences) newSettings.contentPreferences = changes.contentPreferences.newValue;
        if (changes.harmThreshold) newSettings.harmThreshold = changes.harmThreshold.newValue;
        if (changes.enabled !== undefined) {
          newSettings.enabled = changes.enabled.newValue;
          CONFIG.enabled = changes.enabled.newValue;
        }

        if (Object.keys(newSettings).length > 0) {
          window.HarmfulContentDetector.updateSettings(newSettings);
          CONFIG.configured = window.HarmfulContentDetector.isConfigured();
        }
      }
    });
  }

  /**
   * Initialize the content script
   */
  async function init() {
    // Wait for detector to be available
    if (typeof window.HarmfulContentDetector === 'undefined') {
      console.warn('SlopBlocker: Detector not loaded');
      return;
    }

    console.log('SlopBlocker: Initializing AI-powered content protection');

    // Initialize detector with stored settings
    await window.HarmfulContentDetector.init();
    CONFIG.configured = window.HarmfulContentDetector.isConfigured();

    // Set up listeners
    setupMessageListener();
    setupStorageListener();

    // Initial scan
    scanPage();

    // Set up observers
    observeDynamicContent();

    // Periodic re-scan for lazy-loaded content
    setInterval(scanPage, CONFIG.scanInterval);
  }

  // Start when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => init());
  } else {
    init();
  }
})();
