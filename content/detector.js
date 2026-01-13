/**
 * AI-Powered Harmful Content Detector Module
 * Uses Claude API to detect harmful content based on user-defined preferences
 */

const HarmfulContentDetector = {
  // Cache for analyzed content to avoid re-analyzing the same text
  analysisCache: new Map(),

  // Maximum cache size to prevent memory issues
  maxCacheSize: 100,

  // Default settings
  settings: {
    apiKey: '',
    contentPreferences: '',
    harmThreshold: 0.5,
    enabled: true,
  },

  // Site-specific configurations (kept for behavior modes)
  siteConfigs: {
    email: {
      hostPatterns: [
        /mail\.google\.com/,
        /outlook\.(live|office)\.com/,
        /mail\.yahoo\.com/,
        /proton\.me/,
        /protonmail\.com/,
      ],
      contentSelectors: [
        '.a3s.aiL', // Gmail message body
        '[role="main"] .ii.gt', // Gmail
        '.ReadMsgBody', // Outlook
        '.msg-body', // Yahoo
      ],
      behavior: 'warn',
    },
    socialFeed: {
      hostPatterns: [
        /twitter\.com/,
        /x\.com/,
        /facebook\.com/,
        /reddit\.com/,
        /instagram\.com/,
        /tiktok\.com/,
      ],
      contentSelectors: [
        '[data-testid="tweet"]', // Twitter/X
        '[data-testid="tweetText"]', // Twitter/X text
        '[role="article"]', // Facebook posts
        '.Post', // Reddit
        '[data-testid="post-container"]', // Reddit new
        'article', // Generic posts
      ],
      behavior: 'remove',
    },
  },

  /**
   * Initialize detector with config from config.js
   */
  init() {
    // Load from config.js (injected before this script)
    if (typeof SLOPBLOCKER_CONFIG !== 'undefined') {
      this.settings.apiKey = SLOPBLOCKER_CONFIG.apiKey || '';
      this.settings.contentPreferences = SLOPBLOCKER_CONFIG.contentPreferences || '';
      this.settings.harmThreshold = SLOPBLOCKER_CONFIG.harmThreshold ?? 0.5;
    } else {
      console.warn('SlopBlocker: config.js not loaded');
    }
  },

  /**
   * Update settings (called when settings change)
   */
  updateSettings(newSettings) {
    Object.assign(this.settings, newSettings);
    // Clear cache when settings change as analysis results may differ
    this.analysisCache.clear();
  },

  /**
   * Generate a hash for cache key
   */
  hashText(text) {
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString();
  },

  /**
   * Analyze text for harmful content using Claude API
   * @param {string} text - Text to analyze
   * @returns {Promise<Object>} Analysis result with harmfulness score
   */
  async analyzeText(text) {
    if (!text || typeof text !== 'string' || text.length < 20) {
      return { isHarmful: false, score: 0, reason: '', type: null };
    }

    // Check if API key is configured
    if (!this.settings.apiKey) {
      return { isHarmful: false, score: 0, reason: 'API key not configured', type: null, needsConfig: true };
    }

    // Check if content preferences are set
    if (!this.settings.contentPreferences.trim()) {
      return { isHarmful: false, score: 0, reason: 'Content preferences not configured', type: null, needsConfig: true };
    }

    // Check cache first
    const cacheKey = this.hashText(text + this.settings.contentPreferences);
    if (this.analysisCache.has(cacheKey)) {
      return this.analysisCache.get(cacheKey);
    }

    try {
      const result = await this.callClaudeAPI(text);

      // Manage cache size
      if (this.analysisCache.size >= this.maxCacheSize) {
        // Remove oldest entry
        const firstKey = this.analysisCache.keys().next().value;
        this.analysisCache.delete(firstKey);
      }

      this.analysisCache.set(cacheKey, result);
      return result;
    } catch (error) {
      console.error('SlopBlocker: API call failed', error);
      return {
        isHarmful: false,
        score: 0,
        reason: `API error: ${error.message}`,
        type: null,
        error: true
      };
    }
  },

  /**
   * Call Claude API to analyze content with timeout
   */
  async callClaudeAPI(text) {
    // Truncate very long text to avoid token limits
    const maxLength = 4000;
    const truncatedText = text.length > maxLength
      ? text.substring(0, maxLength) + '... [truncated]'
      : text;

    const systemPrompt = `You are a content moderation assistant. Your job is to analyze text and determine if it contains harmful content based on the user's specified preferences.

User's content preferences (things they want to avoid):
${this.settings.contentPreferences}

Analyze the provided text and respond with a JSON object containing:
- "score": A number from 0 to 1 indicating harmfulness (0 = completely safe, 1 = extremely harmful based on user preferences)
- "isHarmful": Boolean, true if score >= ${this.settings.harmThreshold}
- "reason": A brief explanation of why the content is or isn't harmful
- "type": The category of harmful content detected (e.g., "hate_speech", "phishing", "misinformation", "violence", "spam", or null if not harmful)
- "matches": Array of specific phrases or patterns that triggered the detection

Respond ONLY with valid JSON, no other text.`;

    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.settings.apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 500,
          messages: [
            {
              role: 'user',
              content: `Analyze this content for harmfulness:\n\n${truncatedText}`,
            },
          ],
          system: systemPrompt,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `HTTP ${response.status}`);
      }

      const data = await response.json();
      let content = data.content?.[0]?.text || '{}';

      // Strip markdown code blocks if present
      content = content.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();

      try {
        const parsed = JSON.parse(content);
        return {
          isHarmful: parsed.isHarmful || false,
          score: parsed.score || 0,
          reason: parsed.reason || '',
          type: parsed.type || null,
          matches: parsed.matches || [],
          confidence: parsed.score || 0, // For compatibility with existing code
        };
      } catch (e) {
        console.error('SlopBlocker: Failed to parse API response', content);
        return { isHarmful: false, score: 0, reason: 'Failed to parse response', type: null };
      }
    } catch (error) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error('Request timed out');
      }
      throw error;
    }
  },

  /**
   * Determine which site type we're on
   */
  getSiteType(hostname) {
    for (const [type, config] of Object.entries(this.siteConfigs)) {
      for (const pattern of config.hostPatterns) {
        if (pattern.test(hostname)) {
          return { type, config };
        }
      }
    }
    return { type: 'generic', config: null };
  },

  /**
   * Get content selectors for current site
   */
  getContentSelectors(hostname) {
    const { config } = this.getSiteType(hostname);
    if (config) {
      return config.contentSelectors;
    }
    return ['article', '.post', '.message', '.content', '[role="article"]'];
  },

  /**
   * Determine behavior for harmful content on this site
   */
  getBehavior(hostname) {
    const { config } = this.getSiteType(hostname);
    return config?.behavior || 'warn';
  },

  /**
   * Check if the detector is properly configured
   */
  isConfigured() {
    return !!(this.settings.apiKey && this.settings.contentPreferences.trim());
  },
};

// Export for use in content script
if (typeof window !== 'undefined') {
  window.HarmfulContentDetector = HarmfulContentDetector;
}
