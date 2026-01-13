/**
 * Harmful Content Detector Module
 * Detects phishing attempts, hate speech, and other harmful content
 */

const HarmfulContentDetector = {
  // Phishing indicators - common patterns in phishing emails/pages
  phishingPatterns: {
    urgentLanguage: [
      /your account (will be|has been) (suspended|closed|terminated)/i,
      /immediate action required/i,
      /verify your (account|identity|information) (immediately|now|within)/i,
      /unusual (activity|sign-in|login) (detected|noticed)/i,
      /security alert[:\s]/i,
      /confirm your (identity|account|payment)/i,
      /update your (payment|billing|account) information/i,
      /your (password|account) (expires|will expire)/i,
      /click (here|below) to (verify|confirm|secure)/i,
      /failure to (respond|verify|confirm) will result in/i,
      /unauthorized (access|transaction|activity)/i,
      /suspicious (activity|login|transaction)/i,
    ],
    fakeRewards: [
      /you('ve| have) (won|been selected|been chosen)/i,
      /claim your (prize|reward|gift)/i,
      /congratulations[!,]?\s*(you|winner)/i,
      /lottery winner/i,
      /free (gift|prize|money|iphone|android)/i,
    ],
    financialScams: [
      /wire transfer/i,
      /send (money|funds|bitcoin|crypto)/i,
      /nigerian prince/i,
      /inheritance from/i,
      /million (dollars|usd|euros)/i,
      /investment opportunity/i,
      /guaranteed returns/i,
      /double your (money|bitcoin|investment)/i,
    ],
    credentialHarvesting: [
      /enter your (password|credentials|login)/i,
      /confirm your (ssn|social security)/i,
      /verify your (credit card|bank account)/i,
      /update your (banking|financial) details/i,
    ],
    suspiciousLinks: [
      /bit\.ly|tinyurl|t\.co|goo\.gl/i,
      /click (this link|here) (to|and)/i,
    ],
  },

  // Hate speech and harmful content patterns
  hateSpeechPatterns: {
    // These are simplified patterns - production would use ML models
    slurs: [
      // Intentionally leaving this minimal - real implementation would use
      // comprehensive hate speech detection APIs or ML models
    ],
    targetedHarassment: [
      /kill yourself/i,
      /you should die/i,
      /hope you die/i,
      /go die/i,
      /kys\b/i,
    ],
    threats: [
      /i('ll| will) (kill|hurt|find) you/i,
      /going to (kill|hurt|attack) you/i,
      /know where you live/i,
      /coming for you/i,
    ],
    dehumanization: [
      /subhuman/i,
      /not (real |a )?human/i,
      /animals? like (you|them)/i,
    ],
  },

  // Site-specific configurations
  siteConfigs: {
    email: {
      // Gmail, Outlook, Yahoo Mail, etc.
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
      behavior: 'warn', // Show warning overlay instead of removing
    },
    socialFeed: {
      // Twitter/X, Facebook, Reddit, etc.
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
      behavior: 'remove', // Remove content entirely
    },
  },

  /**
   * Analyze text for harmful content
   * @param {string} text - Text to analyze
   * @returns {Object} Analysis result with type and confidence
   */
  analyzeText(text) {
    if (!text || typeof text !== 'string') {
      return { isHarmful: false, type: null, confidence: 0, matches: [] };
    }

    const results = {
      phishing: this.detectPhishing(text),
      hateSpeech: this.detectHateSpeech(text),
    };

    // Return the most confident detection
    if (results.phishing.confidence > results.hateSpeech.confidence) {
      return {
        isHarmful: results.phishing.confidence > 0.3,
        type: 'phishing',
        ...results.phishing,
      };
    } else if (results.hateSpeech.confidence > 0) {
      return {
        isHarmful: results.hateSpeech.confidence > 0.3,
        type: 'hateSpeech',
        ...results.hateSpeech,
      };
    }

    return { isHarmful: false, type: null, confidence: 0, matches: [] };
  },

  /**
   * Detect phishing patterns in text
   */
  detectPhishing(text) {
    const matches = [];
    let score = 0;

    for (const [category, patterns] of Object.entries(this.phishingPatterns)) {
      for (const pattern of patterns) {
        if (pattern.test(text)) {
          matches.push({ category, pattern: pattern.toString() });
          score += this.getCategoryWeight(category);
        }
      }
    }

    // Check for suspicious characteristics
    if (this.hasExcessiveCapitalization(text)) {
      score += 0.1;
      matches.push({ category: 'formatting', pattern: 'excessive caps' });
    }

    if (this.hasExcessiveExclamation(text)) {
      score += 0.1;
      matches.push({ category: 'formatting', pattern: 'excessive punctuation' });
    }

    // Normalize confidence to 0-1
    const confidence = Math.min(score, 1);

    return { confidence, matches, category: 'phishing' };
  },

  /**
   * Detect hate speech patterns in text
   */
  detectHateSpeech(text) {
    const matches = [];
    let score = 0;

    for (const [category, patterns] of Object.entries(this.hateSpeechPatterns)) {
      for (const pattern of patterns) {
        if (pattern.test(text)) {
          matches.push({ category, pattern: pattern.toString() });
          score += 0.4; // Each hate speech match is significant
        }
      }
    }

    const confidence = Math.min(score, 1);

    return { confidence, matches, category: 'hateSpeech' };
  },

  /**
   * Get weight for different phishing categories
   */
  getCategoryWeight(category) {
    const weights = {
      urgentLanguage: 0.15,
      fakeRewards: 0.25,
      financialScams: 0.3,
      credentialHarvesting: 0.35,
      suspiciousLinks: 0.1,
    };
    return weights[category] || 0.1;
  },

  /**
   * Check for excessive capitalization (shouting)
   */
  hasExcessiveCapitalization(text) {
    const words = text.split(/\s+/).filter(w => w.length > 3);
    if (words.length < 5) return false;

    const capsWords = words.filter(w => w === w.toUpperCase() && /[A-Z]/.test(w));
    return capsWords.length / words.length > 0.3;
  },

  /**
   * Check for excessive exclamation marks
   */
  hasExcessiveExclamation(text) {
    const exclamations = (text.match(/!/g) || []).length;
    const sentences = text.split(/[.!?]+/).length;
    return exclamations > sentences * 0.5 && exclamations > 3;
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
    // Generic selectors for unknown sites
    return ['article', '.post', '.message', '.content', '[role="article"]'];
  },

  /**
   * Determine behavior for harmful content on this site
   */
  getBehavior(hostname) {
    const { config } = this.getSiteType(hostname);
    return config?.behavior || 'warn';
  },
};

// Export for use in content script
if (typeof window !== 'undefined') {
  window.HarmfulContentDetector = HarmfulContentDetector;
}
