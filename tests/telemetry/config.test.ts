import assert from "node:assert/strict";
import test from "node:test";

// The app configuration is intentionally CommonJS because Expo loads it in Node.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { buildTelemetryConfig } = require("../../config/telemetry-config");

const production = {
  EAS_BUILD: "true",
  EAS_BUILD_PROFILE: "production",
  EXPO_PUBLIC_APP_ENV: "production",
  EXPO_PUBLIC_SENTRY_DSN: "https://public@sentry.example.com/1",
  EXPO_PUBLIC_POSTHOG_API_KEY: "phc_public",
  EXPO_PUBLIC_POSTHOG_HOST: "https://eu.i.posthog.com",
  SENTRY_ORG: "rideza",
  SENTRY_PROJECT: "rider",
  SENTRY_AUTH_TOKEN: "build-only-token",
};

test("production rejects crash and test-account flags", () => {
  assert.throws(
    () => buildTelemetryConfig({
      ...production,
      EXPO_PUBLIC_ENABLE_CRASH_SCREEN: "1",
      EXPO_PUBLIC_SHOW_TEST_ACCOUNT: "true",
    }, "1.0.3"),
    /Production builds cannot enable development flags/,
  );
});

test("production EAS builds require provider and source-map configuration", () => {
  assert.throws(
    () => buildTelemetryConfig({
      EAS_BUILD: "true",
      EAS_BUILD_PROFILE: "production",
    }, "1.0.3"),
    /Production telemetry configuration is incomplete/,
  );
});

test("production defaults to ten percent tracing without exposing the auth token", () => {
  const result = buildTelemetryConfig(production, "1.0.3");
  assert.equal(result.publicConfig.environment, "production");
  assert.equal(result.publicConfig.tracesSampleRate, 0.1);
  assert.equal("sentryAuthToken" in result.publicConfig, false);
});

test("staging defaults to full tracing and permits explicit preview diagnostics", () => {
  const result = buildTelemetryConfig({
    EXPO_PUBLIC_APP_ENV: "staging",
    EXPO_PUBLIC_ENABLE_CRASH_SCREEN: "1",
  }, "1.0.3");
  assert.equal(result.publicConfig.tracesSampleRate, 1);
  assert.equal(result.publicConfig.allowCrashDetails, true);
});
