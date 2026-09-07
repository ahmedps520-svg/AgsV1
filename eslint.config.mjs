import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";

const require = createRequire(import.meta.url);

// eslint-config-next 16 ships flat configs directly — no FlatCompat needed.
const nextCoreWebVitals = require("eslint-config-next/core-web-vitals");
const nextTypescript = require("eslint-config-next/typescript");

/**
 * GitHub Pages serves the root of `main`, so the built site is committed
 * alongside the source. `.published` lists exactly what the deploy workflow
 * put there — ignore all of it rather than linting minified bundles.
 */
function publishedPaths() {
  if (!existsSync(".published")) return [];
  return readFileSync(".published", "utf8")
    .split("\n")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .flatMap((entry) => [entry, `${entry}/**`]);
}

const eslintConfig = [
  {
    ignores: [
      ".next/**",
      "out/**",
      "node_modules/**",
      "next-env.d.ts",
      "public/sw.js",
      ...publishedPaths(),
    ],
  },
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
];

export default eslintConfig;
