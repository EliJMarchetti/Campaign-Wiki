import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

const eslintConfig = [
  {
    ignores: [
      ".next/**",
      "dist/**",
      "node_modules/**",
      "coverage/**",
      "data/**",
      "playwright-report/**",
      "test-results/**"
    ]
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node
      }
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "off"
    }
  },
  {
    files: ["*.config.ts", "*.config.mjs"],
    languageOptions: {
      globals: {
        ...globals.node
      }
    }
  }
];

export default eslintConfig;
