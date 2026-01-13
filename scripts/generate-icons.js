/**
 * Icon Generation Script for SlopBlocker
 *
 * Run this script with Node.js to generate PNG icons.
 * Requires: npm install canvas
 *
 * Usage: node scripts/generate-icons.js
 */

const fs = require('fs');
const path = require('path');

// Try to use canvas if available, otherwise create placeholder icons
async function generateIcons() {
  const sizes = [16, 48, 128];
  const iconsDir = path.join(__dirname, '..', 'icons');

  // Ensure icons directory exists
  if (!fs.existsSync(iconsDir)) {
    fs.mkdirSync(iconsDir, { recursive: true });
  }

  try {
    // Try to use canvas
    const { createCanvas } = require('canvas');

    for (const size of sizes) {
      const canvas = createCanvas(size, size);
      const ctx = canvas.getContext('2d');

      // Create gradient background
      const gradient = ctx.createLinearGradient(0, 0, size, size);
      gradient.addColorStop(0, '#00d9ff');
      gradient.addColorStop(1, '#e94560');

      // Draw shield shape
      ctx.fillStyle = gradient;
      ctx.beginPath();
      const centerX = size / 2;
      const topY = size * 0.05;
      const bottomY = size * 0.95;
      const width = size * 0.8;

      ctx.moveTo(centerX, topY);
      ctx.lineTo(centerX + width / 2, size * 0.2);
      ctx.lineTo(centerX + width / 2, size * 0.5);
      ctx.quadraticCurveTo(centerX + width / 2, size * 0.8, centerX, bottomY);
      ctx.quadraticCurveTo(centerX - width / 2, size * 0.8, centerX - width / 2, size * 0.5);
      ctx.lineTo(centerX - width / 2, size * 0.2);
      ctx.closePath();
      ctx.fill();

      // Add inner circle
      ctx.fillStyle = '#0f0f1a';
      ctx.beginPath();
      ctx.arc(centerX, size * 0.4, size * 0.15, 0, Math.PI * 2);
      ctx.fill();

      // Save PNG
      const buffer = canvas.toBuffer('image/png');
      fs.writeFileSync(path.join(iconsDir, `icon${size}.png`), buffer);
      console.log(`Generated icon${size}.png`);
    }

    console.log('All icons generated successfully!');
  } catch (e) {
    console.log('Canvas not available, creating placeholder icons...');
    console.log('To generate proper icons, run: npm install canvas && node scripts/generate-icons.js');

    // Create minimal valid PNG files (1x1 cyan pixel, expanded)
    // This is a minimal valid PNG header with a cyan pixel
    const minimalPng = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, // PNG signature
      0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52, // IHDR chunk
      0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
      0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
      0xde, 0x00, 0x00, 0x00, 0x0c, 0x49, 0x44, 0x41, // IDAT chunk
      0x54, 0x08, 0xd7, 0x63, 0x90, 0xfb, 0xcf, 0x00,
      0x00, 0x02, 0x01, 0x01, 0x00, 0x18, 0xdd, 0x8d,
      0xb4, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, // IEND chunk
      0x44, 0xae, 0x42, 0x60, 0x82
    ]);

    for (const size of sizes) {
      fs.writeFileSync(path.join(iconsDir, `icon${size}.png`), minimalPng);
      console.log(`Created placeholder icon${size}.png`);
    }

    console.log('\nPlaceholder icons created. For proper icons:');
    console.log('1. Install canvas: npm install canvas');
    console.log('2. Re-run: node scripts/generate-icons.js');
    console.log('\nOr replace icons manually with your own PNG files.');
  }
}

generateIcons().catch(console.error);
