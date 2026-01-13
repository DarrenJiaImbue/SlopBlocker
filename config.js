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
};
