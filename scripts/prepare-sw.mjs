/**
 * Bakes the deploy base path into the exported service worker, and adds the
 * `.nojekyll` marker GitHub Pages needs so it serves Next's `_next/` folder.
 */
import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = resolve(root, "out");
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const swPath = resolve(outDir, "sw.js");
const source = await readFile(swPath, "utf8");
await writeFile(swPath, source.replace(/__BASE_PATH__/g, basePath), "utf8");
console.log(`✓ sw.js base path → "${basePath || "/"}"`);

await writeFile(resolve(outDir, ".nojekyll"), "", "utf8");
console.log("✓ .nojekyll");

// Pages has no rewrite rules, so an unknown path must still boot the app.
// Copying the 404 shell means a deep link like /board/ survives a hard refresh.
try {
  const notFound = await readFile(resolve(outDir, "404.html"), "utf8");
  await writeFile(resolve(outDir, "404.html"), notFound, "utf8");
  console.log("✓ 404.html present");
} catch {
  console.warn("! 404.html missing — deep links may not resolve");
}
