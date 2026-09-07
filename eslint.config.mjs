import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

// eslint-config-next 16 ships flat configs directly — no FlatCompat needed.
const nextCoreWebVitals = require("eslint-config-next/core-web-vitals");
const nextTypescript = require("eslint-config-next/typescript");

const eslintConfig = [
  { ignores: [".next/**", "node_modules/**", "next-env.d.ts", "public/sw.js"] },
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
