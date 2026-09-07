/**
 * Lays the static export down at the repository root.
 *
 * RUN BY CI ONLY (.github/workflows/deploy-pages.yml). Running it locally and
 * committing the result puts you in a tug-of-war with the workflow's own
 * publish commit — every push then needs a rebase. Change the source, push,
 * and let the workflow republish.
 *
 * GitHub Pages is configured as "Deploy from a branch → main / (root)", which
 * serves whatever is at the root of main. So the deploy workflow builds the
 * app and then commits the output here, next to the source. `.nojekyll` (part
 * of the export) stops GitHub's Jekyll step from hiding the `_next/` folder.
 *
 * Every published entry is recorded in `.published` so the next run can remove
 * stale files (hashed chunks change names on every build) before copying.
 */
import { cp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const out = resolve(root, "out");
const ledger = resolve(root, ".published");

// 1. Remove what the previous publish put here.
try {
  const previous = (await readFile(ledger, "utf8")).split("\n").filter(Boolean);
  for (const entry of previous) {
    await rm(resolve(root, entry), { recursive: true, force: true });
  }
} catch {
  // First publish — nothing to clean up.
}

// 2. Copy the fresh build, refusing to clobber anything that is not ours.
const RESERVED = new Set([
  ".git", ".github", "node_modules", "src", "public", "scripts", "supabase",
  "out", ".next", "package.json", "package-lock.json", "README.md",
  "DEPLOYMENT.md", "next.config.ts", "tsconfig.json", "postcss.config.mjs",
  "eslint.config.mjs", "render.yaml", ".gitignore", ".gitattributes",
  ".env.example", ".published",
]);

const entries = (await readdir(out)).sort();
for (const entry of entries) {
  if (RESERVED.has(entry)) {
    throw new Error(`Refusing to overwrite ${entry} with build output.`);
  }
  await cp(resolve(out, entry), resolve(root, entry), { recursive: true, force: true });
}

// 3. Record it for next time.
await writeFile(ledger, entries.join("\n") + "\n", "utf8");
console.log(`✓ published ${entries.length} entries to the repository root`);
