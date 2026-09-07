// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: [
      'dist/*',
      // The app uses Expo Router through package.json; this legacy entry is not bundled.
      'app.js',
    ],
  },
]);
