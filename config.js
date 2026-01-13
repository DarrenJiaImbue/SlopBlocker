/**
 * SlopBlocker Configuration
 * Enter your API key and content preferences here
 */

const SLOPBLOCKER_CONFIG = {
  // Your Anthropic API key - get one from https://console.anthropic.com/settings/keys
  apiKey: '',

  // Content you want to block - describe what you want to avoid
  // Be specific about topics, language, or content types you find harmful
  contentPreferences: `
- Phishing attempts and scam emails
- Hate speech and discriminatory language
- Violent or threatening content
- Misinformation about health topics
- Clickbait and sensationalized news
  `.trim(),

  // Sensitivity threshold (0.1 to 0.9)
  // Higher = more content blocked, Lower = less content blocked
  harmThreshold: 0.5,

  // Maximum concurrent API requests (default: 5)
  // Anthropic rate limits:
  //   - Free tier: ~5 requests/min
  //   - Build tier: ~50 requests/min
  //   - Scale tier: 1000+ requests/min
  // Set this based on your tier to avoid rate limiting
  maxConcurrentRequests: 5,

  // ===========================================
  // PRE-FILTER KEYWORDS (First-pass filter)
  // ===========================================
  // Content is ONLY sent to Claude if it matches one of these keywords/patterns.
  // This dramatically reduces API costs. Add keywords related to your content preferences.
  // Case-insensitive matching. Supports simple strings or regex patterns.

  preFilterKeywords: [
    // Phishing / Scam indicators
    'verify your account',
    'confirm your identity',
    'suspended',
    'unusual activity',
    'click here',
    'act now',
    'urgent',
    'limited time',
    'winner',
    'congratulations',
    'claim your',
    'wire transfer',
    'bitcoin',
    'crypto',

    // Hate speech indicators
    'kill yourself',
    'kys',
    'die',
    'subhuman',
    'go back to',

    // Violence
    'kill',
    'murder',
    'attack',
    'bomb',
    'shoot',

    // Misinformation common phrases
    'exposed',
    'they don\'t want you to know',
    'exposed',
    'exposed',
    'exposed',
    'mainstream media',
    'big pharma',
    'wake up',
    'sheeple',

    // Clickbait
    'you won\'t believe',
    'shocking',
    'jaw-dropping',
    'mind-blowing',
    'doctors hate',
    'one weird trick',
  ],

  // Set to false to skip pre-filter and send everything to Claude (expensive!)
  usePreFilter: true,
};
