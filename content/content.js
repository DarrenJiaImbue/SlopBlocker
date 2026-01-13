/**
 * SlopBlocker Content Script
 * Scans page content for harmful material and takes appropriate action
 */

// Import detector (will be injected via manifest)
// HarmfulContentDetector is available from detector.js

(function() {
  'use strict';

  // Configuration
  const CONFIG = {
    scanInterval: 2000, // Re-scan for dynamic content
    maxScansPerElement: 1, // Don't re-scan already processed elements
    enabled: true,
  };

  // Track processed elements
  const processedElements = new WeakSet();

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

    const warningType = analysis.type === 'phishing' ? 'Phishing Attempt' : 'Harmful Content';
    const warningIcon = analysis.type === 'phishing' ? '🎣' : '⚠️';

    overlay.innerHTML = `
      <div class="slopblocker-warning-content">
        <div class="slopblocker-warning-header">
          <span class="slopblocker-warning-icon">${warningIcon}</span>
          <span class="slopblocker-warning-title">SlopBlocker: ${warningType} Detected</span>
        </div>
        <div class="slopblocker-warning-body">
          <p><strong>Warning:</strong> This content has been flagged as potentially harmful.</p>
          <p class="slopblocker-warning-details">
            <strong>Confidence:</strong> ${Math.round(analysis.confidence * 100)}%<br>
            <strong>Detected patterns:</strong> ${analysis.matches.slice(0, 3).map(m => m.category).join(', ')}
          </p>
          <p class="slopblocker-warning-advice">
            ${analysis.type === 'phishing'
              ? 'Do not click any links or provide personal information. Verify the sender through official channels.'
              : 'This content may contain hate speech or harmful material.'}
          </p>
        </div>
        <div class="slopblocker-warning-actions">
          <button class="slopblocker-btn slopblocker-btn-safe" data-action="hide">
            Hide Content
          </button>
          <button class="slopblocker-btn slopblocker-btn-danger" data-action="show">
            Show Anyway (Not Recommended)
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
    // Create a placeholder so the feed doesn't jump
    const placeholder = document.createElement('div');
    placeholder.className = 'slopblocker-removed-placeholder';
    placeholder.innerHTML = `
      <div class="slopblocker-removed-content">
        <span class="slopblocker-removed-icon">🛡️</span>
        <span class="slopblocker-removed-text">
          Content removed by SlopBlocker
          (${analysis.type === 'hateSpeech' ? 'hate speech' : 'harmful content'})
        </span>
        <button class="slopblocker-btn-small" data-action="undo">Undo</button>
      </div>
    `;

    // Store original element for undo
    const originalDisplay = element.style.display;
    element.style.display = 'none';
    element.parentElement?.insertBefore(placeholder, element);

    // Undo handler
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
   * Process a single element
   */
  function processElement(element) {
    // Skip if already processed or dismissed
    if (processedElements.has(element) || element.dataset.slopblockerDismissed) {
      return;
    }

    // Mark as processed
    processedElements.add(element);
    stats.scanned++;

    // Get text content
    const text = element.textContent || element.innerText || '';
    if (text.length < 20) return; // Skip very short content

    // Analyze content
    const analysis = window.HarmfulContentDetector.analyzeText(text);

    if (analysis.isHarmful) {
      const hostname = window.location.hostname;
      const behavior = window.HarmfulContentDetector.getBehavior(hostname);

      if (behavior === 'warn' || analysis.type === 'phishing') {
        // Show warning overlay for emails and phishing
        createWarningOverlay(element, analysis);
        stats.warned++;
      } else {
        // Remove content for social feeds
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
          confidence: analysis.confidence,
        },
      });
    }
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
        // Debounce scanning
        clearTimeout(observeDynamicContent.timeout);
        observeDynamicContent.timeout = setTimeout(scanPage, 500);
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
          scanPage();
          sendResponse({ scanned: true });
          break;
      }
      return true;
    });
  }

  /**
   * Initialize the content script
   */
  function init() {
    // Wait for detector to be available
    if (typeof window.HarmfulContentDetector === 'undefined') {
      console.warn('SlopBlocker: Detector not loaded');
      return;
    }

    console.log('SlopBlocker: Initializing content protection');

    // Initial scan
    scanPage();

    // Set up observers and listeners
    observeDynamicContent();
    setupMessageListener();

    // Periodic re-scan for lazy-loaded content
    setInterval(scanPage, CONFIG.scanInterval);
  }

  // Start when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
