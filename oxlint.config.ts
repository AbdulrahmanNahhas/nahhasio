import { defineConfig } from "oxlint";

export default defineConfig({
  ignorePatterns: [
    "apps/linux/ui/src/routeTree.gen.ts",
    // Vendored shadcn output, replaced wholesale by the shadcn CLI — hand-edits would be lost.
    "apps/linux/ui/src/components/ui/**",
    "tools/oxlint/anti-slop/**",
    ".agents/**",
    ".claude/**",
    ".codex/**",
    ".tmp/**",
    "target/**",
  ],
  plugins: ["typescript", "unicorn", "oxc", "import", "vitest", "promise", "node", "react"],
  jsPlugins: [
    { name: "anti-slop", specifier: "./tools/oxlint/anti-slop/index.ts" },
    "@shadcn/lint",
  ],
  categories: {
    correctness: "error",
    suspicious: "error",
    perf: "warn",
  },
  rules: {
    "unicorn/filename-case": "off",
    "react/react-in-jsx-scope": "off",
    "react/jsx-key": "error",
    "import/no-unassigned-import": ["error", { allow: ["**/*.css"] }],
    // Sequential awaits inside SQL transactions and the v1 import scripts are deliberate: row
    // order and foreign keys depend on the previous statement having committed.
    "no-await-in-loop": "off",
    // `.map((x) => ({ ...x, y }))` is the immutable idiom this codebase prefers; the in-place
    // mutation the rule suggests is a micro-optimisation that would hide aliasing bugs.
    "oxc/no-map-spread": "off",

    "anti-slop/no-chained-type-assertions": "error",
    "anti-slop/no-conditional-empty-object-spread": "error",
    "anti-slop/no-known-value-widening": "error",
    "anti-slop/no-module-mocking": "error",
    "anti-slop/no-object-parameters": "error",
    "anti-slop/no-reflect-apply": "error",
    "anti-slop/no-reflect-get": "error",
    "anti-slop/no-runtime-typeof": ["error", { allowInTypeGuards: true }],
    "anti-slop/no-shape-in-symbol-names": "error",
    "anti-slop/no-unknown-parameters": "error",
    "anti-slop/no-unknown-returns": "error",
    "anti-slop/no-unknown-type-aliases": "error",
    "anti-slop/no-unsafe-dictionary-type": "error",
    "anti-slop/no-widen-then-assert": "error",
    "anti-slop/require-safety-comment-for-type-assertion": "error",
  },
  overrides: [
    {
      // Legacy modules retained for administration and recovery. Their untyped-row idiom
      // (`Record<string, unknown>` SQL rows, v1 shape
      // adapters, draft-sync effects) is what the split rewrites, so the anti-slop rules are
      // relaxed here instead of being satisfied twice. The list may only shrink: remove a file
      // the moment its replacement lands, and never add one.
      files: [
        "packages/contracts/src/index.ts",
        "packages/database/src/import-v1-knowledge.ts",
        "packages/database/src/import-v1.ts",
        "packages/database/src/consolidate-v1-franchises.ts",
      ],
      rules: {
        "anti-slop/no-known-value-widening": "off",
        "anti-slop/no-runtime-typeof": "off",
        "anti-slop/no-unknown-parameters": "off",
        "anti-slop/no-unknown-returns": "off",
        "anti-slop/no-unsafe-dictionary-type": "off",
        "anti-slop/no-conditional-empty-object-spread": "off",
        "anti-slop/no-chained-type-assertions": "off",
        "anti-slop/no-shape-in-symbol-names": "off",
        "anti-slop/require-safety-comment-for-type-assertion": "off",
        "react/set-state-in-effect": "off",
      },
    },
  ],
});
