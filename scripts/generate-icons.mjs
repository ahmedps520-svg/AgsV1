/**
 * Renders the PWA icon set from a single SVG source.
 * Run with `npm run icons` after changing the mark.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = resolve(root, "public/icons");

/** The mark: a rounded plate, a location pin, and a dismissal "call" pulse. */
function markSvg({ size, padding }) {
  const inner = size - padding * 2;
  const scale = inner / 512;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#6D5BE8"/>
      <stop offset="55%" stop-color="#4F3FD6"/>
      <stop offset="100%" stop-color="#3A2FB0"/>
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" rx="${size * 0.225}" fill="url(#bg)"/>
  <g transform="translate(${padding} ${padding}) scale(${scale})">
    <path d="M256 92c-79 0-143 62-143 139 0 100 122 197 137 209a10 10 0 0 0 12 0c15-12 137-109 137-209 0-77-64-139-143-139z"
          fill="#ffffff" opacity="0.97"/>
    <circle cx="256" cy="228" r="56" fill="#4F3FD6"/>
    <path d="M172 396c34 22 78 34 84 34s50-12 84-34" stroke="#ffffff" stroke-width="26"
          stroke-linecap="round" fill="none" opacity="0.55"/>
  </g>
</svg>`;
}

await mkdir(outDir, { recursive: true });

const targets = [
  { file: "icon-192.png", size: 192, padding: 20 },
  { file: "icon-512.png", size: 512, padding: 54 },
  { file: "apple-touch-icon.png", size: 180, padding: 18 },
  // Maskable icons need ~20% safe padding on every edge.
  { file: "maskable-512.png", size: 512, padding: 102 },
];

for (const target of targets) {
  const svg = markSvg(target);
  await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toFile(resolve(outDir, target.file));
  console.log(`✓ ${target.file}`);
}

await writeFile(resolve(root, "public/icon.svg"), markSvg({ size: 512, padding: 54 }), "utf8");
console.log("✓ icon.svg");
