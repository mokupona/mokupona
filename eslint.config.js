import globals from "globals";

import siteText from "./eslint-rules/no-hardcoded-text.js";

/** @type {import('eslint').Linter.Config[]} */
export default [
  {
    ignores: [
      "**/node_modules/**",
      "**/build/**",
      "**/public/build**",
      "**/.react-router/**",
      "**/prisma/generated/**",
    ],
  },
  {
    plugins: {
      import: (await import("eslint-plugin-import-x")).default,
    },
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    rules: {
      "import/order": [
        "warn",
        {
          alphabetize: { caseInsensitive: true, order: "asc" },
          groups: ["builtin", "external", "internal", "parent", "sibling"],
          "newlines-between": "always",
        },
      ],
    },
  },
  {
    files: ["**/*.{js,jsx,ts,tsx}"],
    plugins: {
      react: (await import("eslint-plugin-react")).default,
    },
    languageOptions: {
      parser: (await import("typescript-eslint")).parser,
      parserOptions: {
        jsx: true,
      },
    },
    rules: {
      "react/jsx-no-leaked-render": ["warn", { validStrategies: ["ternary"] }],
    },
  },
  {
    files: ["**/*.{js,jsx,ts,tsx}"],
    plugins: {
      "react-hooks": (await import("eslint-plugin-react-hooks")).default,
    },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
    },
  },
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parser: (await import("typescript-eslint")).parser,
    },
    plugins: {
      "@typescript-eslint": (await import("typescript-eslint")).plugin,
    },
    rules: {
      "@typescript-eslint/consistent-type-imports": "error",
    },
  },
  {
    files: ["**/*.test.{js,jsx,ts,tsx}"],
    plugins: {
      "jest-dom": (await import("eslint-plugin-jest-dom")).default,
    },
    settings: {
      jest: {
        version: 28,
      },
    },
  },
  {
    files: ["cypress/**/*.ts"],
    plugins: {
      cypress: (await import("eslint-plugin-cypress")).default,
    },
  },
  {
    files: ["app/**/*.{js,jsx,ts,tsx}"],
    ignores: [
      "app/models/**",
      "app/db.server.ts",
      "app/features/auth/auth.server.ts",
      "**/*.test.{js,jsx,ts,tsx}",
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["~/db.server", "#prisma/generated/*"],
              message:
                "Only app/models/** may import the database layer. Use or add a model function instead.",
            },
          ],
        },
      ],
    },
  },
  {
    // Everything a visitor can read comes from the site-text registry, so
    // admins can edit it at /admin/texts (CLAUDE.md, "Public-facing text").
    // The admin area and code that never reaches a visitor are left out.
    files: ["app/**/*.{ts,tsx}"],
    ignores: [
      "**/*.test.{ts,tsx}",
      "app/routes/admin*",
      "app/routes/api.*",
      "app/routes/file.*",
      "app/routes/healthcheck.tsx",
      "app/components/admin-*",
      "app/components/section-nav.tsx",
      "app/components/signup-form-builder.tsx",
      "app/features/**/admin-*",
      "app/features/live-data/**",
      "app/features/site-text/**",
      // the statistics report's labels, which only /admin/stats shows
      "app/features/stats/report.ts",
      // copy that only the admin area shows: role pickers, the auth
      // switches, the event cover editor, photo framing, and the validation
      // of event, location, board-member, volunteer and signup-form-builder
      // forms
      "app/features/auth/auth-settings.ts",
      "app/features/auth/roles.ts",
      "app/features/board-members/schema.ts",
      "app/features/events/components/cover-photo-field.tsx",
      "app/features/events/event-schema.ts",
      "app/features/forms/fields/index.ts",
      "app/features/forms/fields/select/model.ts",
      "app/features/signup-form/builder.ts",
      "app/features/signup-form/schema.ts",
      "app/features/users/invite.shared.ts",
      "app/features/volunteers/schema.ts",
      "app/shared/image.ts",
      "app/shared/image-crop.ts",
      "app/utils/address-validation.ts",
      // the starting questions of a new event's signup form, which admins
      // then word per event in the form builder
      "app/features/signup-form/default-form.ts",
      // the spam trap: hidden from people, its labels are bait for bots
      "app/features/forms/honeypot-field.tsx",
      // the pre-form-builder signup schema, kept only for a parity test
      "app/utils/event-signup-validation.ts",
      "app/logger/**",
      "app/logger.server.ts",
      "app/models/**",
    ],
    plugins: { "site-text": siteText },
    rules: { "site-text/no-hardcoded-text": "error" },
  },
];
