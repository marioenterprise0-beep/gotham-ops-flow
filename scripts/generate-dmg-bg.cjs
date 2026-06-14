"use strict";
const sharp = require("sharp");
const path = require("path");

// 540x380 DMG background — dark with subtle gold accent
const SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="540" height="380">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#141414"/>
      <stop offset="100%" style="stop-color:#0A0A0A"/>
    </linearGradient>
  </defs>
  <rect width="540" height="380" fill="url(#bg)"/>
  <!-- Subtle gold divider line -->
  <line x1="270" y1="60" x2="270" y2="320" stroke="#D4A853" stroke-width="1" opacity="0.15"/>
  <!-- "Drag to Applications" hint text -->
  <text x="150" y="350" font-family="'DM Sans', Arial, sans-serif" font-size="11" fill="#D4A853" opacity="0.4" text-anchor="middle">Gothamhalal Dash</text>
  <text x="390" y="350" font-family="'DM Sans', Arial, sans-serif" font-size="11" fill="#D4A853" opacity="0.4" text-anchor="middle">Applications</text>
  <!-- Arrow -->
  <text x="270" y="200" font-family="Arial" font-size="28" fill="#D4A853" opacity="0.25" text-anchor="middle">→</text>
</svg>`;

async function main() {
  const out = path.join(__dirname, "..", "electron", "build", "dmg-background.png");
  await sharp(Buffer.from(SVG)).resize(540, 380).png().toFile(out);
  console.log("✓ DMG background generated");
}

main().catch(console.error);
