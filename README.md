# SlopBlocker

A Chrome extension that automatically detects and removes harmful content from web pages, similar to how an ad blocker removes ads.

## Features

- **Phishing Detection**: Identifies phishing attempts in emails with warning overlays
- **Hate Speech Removal**: Automatically removes harmful content from social media feeds
- **Smart Behavior**: Different actions based on context:
  - **Email sites** (Gmail, Outlook, Yahoo Mail, ProtonMail): Shows warning overlays so users can review flagged content
  - **Social feeds** (Twitter/X, Facebook, Reddit, Instagram, TikTok): Removes harmful posts entirely
- **Real-time Scanning**: Continuously monitors dynamically loaded content
- **Statistics Tracking**: See how much harmful content has been blocked

## Installation

### From Source (Developer Mode)

1. Clone or download this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top right corner
4. Click "Load unpacked" and select the extension directory
5. The SlopBlocker icon should appear in your extensions toolbar

### Building Icons (Optional)

If you want to generate proper shield icons:

```bash
npm install canvas
node scripts/generate-icons.js
```

## How It Works

### Email Protection Mode
When you're on an email site (Gmail, Outlook, etc.), SlopBlocker scans email content for phishing indicators:
- Urgent language ("Your account will be suspended")
- Fake rewards ("You've won!")
- Financial scams (wire transfer requests)
- Credential harvesting attempts

When detected, a warning overlay appears allowing you to:
- Hide the content
- View it anyway (not recommended)

### Social Feed Protection Mode
When you're on social media, SlopBlocker scans posts for:
- Hate speech patterns
- Targeted harassment
- Threats

Harmful content is automatically removed and replaced with a placeholder. You can undo this action if needed.

## Detection Patterns

### Phishing Detection
- Urgent language requiring immediate action
- Fake prize/reward notifications
- Financial scam patterns (Nigerian prince, inheritance, etc.)
- Credential harvesting requests
- Suspicious shortened links
- Excessive capitalization and punctuation

### Hate Speech Detection
- Targeted harassment
- Threats of violence
- Dehumanizing language

## Configuration

Click the SlopBlocker icon to:
- Toggle protection on/off
- View statistics for the current page
- Manually rescan the page
- See current protection mode

## Supported Sites

### Email (Warning Mode)
- Gmail (mail.google.com)
- Outlook (outlook.live.com, outlook.office.com)
- Yahoo Mail (mail.yahoo.com)
- ProtonMail (proton.me, protonmail.com)

### Social Media (Removal Mode)
- Twitter/X (twitter.com, x.com)
- Facebook (facebook.com)
- Reddit (reddit.com)
- Instagram (instagram.com)
- TikTok (tiktok.com)

### Other Sites
All other sites use warning mode by default.

## Privacy

SlopBlocker:
- Does NOT send your data to external servers
- Runs entirely in your browser
- Uses pattern matching locally
- Does NOT collect or transmit personal information

## Limitations

- Detection is based on pattern matching and heuristics
- May produce false positives/negatives
- Not a replacement for security awareness training
- Social media selectors may need updates as sites change their HTML structure

## Development

### File Structure
```
slopblocker/
├── manifest.json          # Extension manifest
├── background/
│   └── service-worker.js  # Background service worker
├── content/
│   ├── detector.js        # Harmful content detection logic
│   ├── content.js         # Main content script
│   └── content.css        # Styles for overlays
├── popup/
│   ├── popup.html         # Extension popup UI
│   ├── popup.js           # Popup logic
│   └── popup.css          # Popup styles
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── scripts/
    └── generate-icons.js  # Icon generation script
```

### Adding New Detection Patterns

Edit `content/detector.js` to add new patterns:

```javascript
// Add to phishingPatterns or hateSpeechPatterns
urgentLanguage: [
  /your pattern here/i,
  // ...
],
```

### Adding New Site Support

Edit the `siteConfigs` object in `content/detector.js`:

```javascript
siteConfigs: {
  newSiteType: {
    hostPatterns: [/example\.com/],
    contentSelectors: ['.post-content'],
    behavior: 'warn' // or 'remove'
  }
}
```

## License

MIT License
