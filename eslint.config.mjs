import { defineConfig } from 'eslint/config';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const expoConfig = require('eslint-config-expo/flat');

export default defineConfig([
  ...expoConfig,
  {
    ignores: ['.expo/**', 'dist/**', 'web-build/**', 'ios/**', 'android/**', 'coverage/**'],
    rules: {
      // Expo's web color-scheme shim intentionally flips its hydration flag once.
      'react-hooks/set-state-in-effect': 'off',
    },
  },
]);
