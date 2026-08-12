// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    // dist/* is Expo's own build output. .claude/worktrees is an agent-harness
    // scratch dir (gitignored) that can hold stale copies of source files.
    ignores: ["dist/*", ".claude/worktrees/**"],
  }
]);
