/**
 * Renders the AGS icon set from the same crest geometry the React <LogoMark>
 * uses, so the app icon and the in-app logo never drift apart.
 *
 * Run with `npm run icons` after changing the mark. Requires the Playfair
 * Display Bold font to be installed locally; if it is missing the wordmark
 * falls back to the system serif and the icons will look slightly different.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = resolve(root, "public/icons");

const NAVY = "#1E3A73";
const GOLD = "#F5B324";
const SKY = "#5A9BD5";

function burst() {
  return Array.from({ length: 9 }, (_, index) => {
    const angle = (-74 + index * 18.5) * (Math.PI / 180);
    const radius = 104;
    const size = index === 4 ? 25 : index % 2 === 0 ? 21 : 17;
    const x = 226 + Math.sin(angle) * radius;
    const y = 236 - Math.cos(angle) * radius;
    const fill = [1, 5].includes(index) ? GOLD : [3, 7].includes(index) ? SKY : NAVY;
    return `<rect x="${x - size / 2}" y="${y - size / 2}" width="${size}" height="${size}" rx="2"
      fill="${fill}" transform="rotate(${(angle * 180) / Math.PI + 45} ${x} ${y})"/>`;
  }).join("\n    ");
}

function diamonds() {
  return [0, 1, 2]
    .map((index) => {
      const x = 380 + (index === 1 ? 22 : 0);
      const y = 252 + index * 46;
      return `<rect x="${x}" y="${y}" width="27" height="27" rx="2" fill="${NAVY}"
        transform="rotate(45 ${x + 13.5} ${y + 13.5})"/>`;
    })
    .join("\n    ");
}

/** `inset` leaves the safe area a maskable icon needs. */
function crestSvg({ size, inset = 0, ring = true }) {
  const inner = size - inset * 2;
  const scale = inner / 512;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="#ffffff"/>
  <g transform="translate(${inset} ${inset}) scale(${scale})">
    ${ring ? `<circle cx="256" cy="256" r="233" fill="none" stroke="${NAVY}" stroke-width="30"/>` : ""}
    ${burst()}
    <path d="M72 344 C 142 400, 282 392, 366 288" fill="none" stroke="${GOLD}"
      stroke-width="26" stroke-linecap="round"/>
    <text x="88" y="350" fill="${NAVY}"
      font-family="Playfair Display, Georgia, DejaVu Serif, serif"
      font-size="140" font-weight="700">AGS</text>
    ${diamonds()}
  </g>
</svg>`;
}

await mkdir(outDir, { recursive: true });

const targets = [
  { file: "icon-192.png", size: 192, inset: 6 },
  { file: "icon-512.png", size: 512, inset: 16 },
  { file: "apple-touch-icon.png", size: 180, inset: 6 },
  // Maskable icons need ~20% clear on every edge, and no ring to clip.
  { file: "maskable-512.png", size: 512, inset: 104, ring: false },
];

for (const target of targets) {
  await sharp(Buffer.from(crestSvg(target)))
    .png({ compressionLevel: 9 })
    .toFile(resolve(outDir, target.file));
  console.log(`✓ ${target.file}`);
}

// A 32px favicon keeps the browser tab legible; the crest ring is dropped at
// that size because it would collapse into a smudge.
await sharp(Buffer.from(crestSvg({ size: 64, inset: 2, ring: false })))
  .resize(32, 32)
  .png({ compressionLevel: 9 })
  .toFile(resolve(root, "public/favicon.png"));
console.log("✓ favicon.png");

await writeFile(resolve(root, "public/icon.svg"), crestSvg({ size: 512, inset: 0 }), "utf8");
console.log("✓ icon.svg");
