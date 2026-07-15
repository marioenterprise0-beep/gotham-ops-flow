// Generates all required PWA and Electron app icons from the SVG source.
// Run: node scripts/generate-icons.cjs
"use strict";
const sharp = require("sharp");
const fs = require("fs");
const path = require("path");

const GOLD = { r: 212, g: 168, b: 83, alpha: 1 };
const BLACK = { r: 10, g: 10, b: 10, alpha: 1 };

// SVG icon: black background, gold "GH" monogram
const ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#F0C55A;stop-opacity:1" />
      <stop offset="50%" style="stop-color:#D4A853;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#A87930;stop-opacity:1" />
    </linearGradient>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#141414;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#0A0A0A;stop-opacity:1" />
    </linearGradient>
  </defs>
  <!-- Background -->
  <rect width="512" height="512" rx="80" fill="url(#bgGrad)"/>
  <!-- Gold border ring -->
  <rect x="18" y="18" width="476" height="476" rx="66" fill="none" stroke="url(#goldGrad)" stroke-width="3" opacity="0.5"/>
  <!-- G letter -->
  <text
    x="118"
    y="340"
    font-family="'Black Han Sans', 'Arial Black', sans-serif"
    font-size="260"
    font-weight="900"
    fill="url(#goldGrad)"
    letter-spacing="-8"
  >GH</text>
  <!-- Bottom tagline -->
  <text
    x="256"
    y="450"
    font-family="'DM Sans', Arial, sans-serif"
    font-size="38"
    font-weight="500"
    fill="#D4A853"
    opacity="0.7"
    text-anchor="middle"
    letter-spacing="8"
  >DASH</text>
</svg>`;

// Maskable icon (less padding, fills more of the space)
const MASKABLE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#F0C55A;stop-opacity:1" />
      <stop offset="50%" style="stop-color:#D4A853;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#A87930;stop-opacity:1" />
    </linearGradient>
  </defs>
  <!-- Full bleed background for maskable -->
  <rect width="512" height="512" fill="#0A0A0A"/>
  <!-- GH centered with padding for safe zone -->
  <text
    x="118"
    y="330"
    font-family="'Arial Black', sans-serif"
    font-size="240"
    font-weight="900"
    fill="url(#goldGrad)"
    letter-spacing="-8"
  >GH</text>
  <text
    x="256"
    y="430"
    font-family="Arial, sans-serif"
    font-size="36"
    font-weight="500"
    fill="#D4A853"
    opacity="0.7"
    text-anchor="middle"
    letter-spacing="8"
  >DASH</text>
</svg>`;

const ICON_SIZES = [
  // PWA icons
  { size: 72, name: "icon-72x72.png", maskable: false },
  { size: 96, name: "icon-96x96.png", maskable: false },
  { size: 128, name: "icon-128x128.png", maskable: false },
  { size: 144, name: "icon-144x144.png", maskable: false },
  { size: 152, name: "icon-152x152.png", maskable: false },
  { size: 192, name: "icon-192x192.png", maskable: false },
  { size: 384, name: "icon-384x384.png", maskable: false },
  { size: 512, name: "icon-512x512.png", maskable: false },
  // Maskable variants
  { size: 192, name: "icon-192x192-maskable.png", maskable: true },
  { size: 512, name: "icon-512x512-maskable.png", maskable: true },
  // Apple touch icons
  { size: 120, name: "apple-touch-icon-120x120.png", maskable: false },
  { size: 152, name: "apple-touch-icon-152x152.png", maskable: false },
  { size: 167, name: "apple-touch-icon-167x167.png", maskable: false },
  { size: 180, name: "apple-touch-icon.png", maskable: false },
];

async function generateIcons() {
  const iconsDir = path.join(__dirname, "..", "public", "icons");
  const electronBuildDir = path.join(__dirname, "..", "electron", "build");

  fs.mkdirSync(iconsDir, { recursive: true });
  fs.mkdirSync(electronBuildDir, { recursive: true });

  // Generate PWA icons
  for (const { size, name, maskable } of ICON_SIZES) {
    const svg = Buffer.from(maskable ? MASKABLE_SVG : ICON_SVG);
    const outPath = path.join(iconsDir, name);
    await sharp(svg).resize(size, size).png({ compressionLevel: 9 }).toFile(outPath);
    console.log(`✓ Generated ${name} (${size}x${size})`);
  }

  // Generate 1024x1024 for Electron
  const electronIcon1024 = path.join(electronBuildDir, "icon.png");
  await sharp(Buffer.from(ICON_SVG)).resize(1024, 1024).png().toFile(electronIcon1024);
  console.log("✓ Generated electron/build/icon.png (1024x1024)");

  // Generate ICNS via iconset (macOS only)
  const iconsetDir = path.join(electronBuildDir, "icon.iconset");
  fs.mkdirSync(iconsetDir, { recursive: true });
  const icnsSizes = [16, 32, 64, 128, 256, 512, 1024];
  for (const s of icnsSizes) {
    const base = path.join(iconsetDir, `icon_${s}x${s}.png`);
    await sharp(Buffer.from(ICON_SVG)).resize(s, s).png().toFile(base);
    if (s <= 512) {
      const ret = path.join(iconsetDir, `icon_${s}x${s}@2x.png`);
      await sharp(Buffer.from(ICON_SVG))
        .resize(s * 2, s * 2)
        .png()
        .toFile(ret);
    }
    console.log(`✓ iconset ${s}x${s}`);
  }
  console.log("\nIconset ready. Run to create ICNS:");
  console.log(`  iconutil -c icns ${iconsetDir} -o ${path.join(electronBuildDir, "icon.icns")}`);
  console.log("\nAll icons generated successfully!");
}

generateIcons().catch((err) => {
  console.error(err);
  process.exit(1);
});
