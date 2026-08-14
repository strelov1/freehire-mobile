// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    // Build output and generated native projects are Expo's own; .claude/worktrees
    // is an agent-harness scratch dir (gitignored) that can hold stale copies of
    // source files. A config object carrying only `ignores` is a global ignore —
    // adding any other key here would scope it to this object instead.
    ignores: [
      "dist/*",
      ".expo/**",
      "web-build/**",
      "coverage/**",
      "ios/**",
      "android/**",
      ".claude/worktrees/**",
    ],
  }
]);
