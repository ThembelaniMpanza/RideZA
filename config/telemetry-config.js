const APP_ENVIRONMENTS = new Set(["development", "staging", "production"]);
const TRUE_VALUES = new Set(["1", "true", "yes", "on"]);

function isEnabled(value) {
  return TRUE_VALUES.has(String(value ?? "").trim().toLowerCase());
}

function resolveAppEnvironment(env) {
  const raw = String(
    env.EXPO_PUBLIC_APP_ENV ?? env.EAS_BUILD_PROFILE ?? "development",
  ).trim().toLowerCase();
  const value = raw === "preview" ? "staging" : raw;

  if (!APP_ENVIRONMENTS.has(value)) {
    throw new Error(
      `EXPO_PUBLIC_APP_ENV must be development, staging, or production; received ${raw}.`,
    );
  }

  return value;
}

function parseSampleRate(value, fallback) {
  if (value === undefined || String(value).trim() === "") return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1) {
    throw new Error("EXPO_PUBLIC_TELEMETRY_SAMPLE_RATE must be between 0 and 1.");
  }
  return parsed;
}

function optionalHttpsUrl(value, name) {
  const normalized = String(value ?? "").trim();
  if (!normalized) return "";

  let url;
  try {
    url = new URL(normalized);
  } catch {
    throw new Error(`${name} must be a valid HTTPS URL.`);
  }

  if (url.protocol !== "https:") {
    throw new Error(`${name} must use HTTPS.`);
  }

  return normalized.replace(/\/+$/, "");
}

function assertProductionSafety(env, environment) {
  if (environment !== "production") return;

  const forbiddenFlags = [
    "EXPO_PUBLIC_ENABLE_CRASH_SCREEN",
    "EXPO_PUBLIC_SHOW_TEST_ACCOUNT",
    "EXPO_PUBLIC_RESET_ONBOARDING",
  ].filter(name => isEnabled(env[name]));

  if (forbiddenFlags.length > 0) {
    throw new Error(
      `Production builds cannot enable development flags: ${forbiddenFlags.join(", ")}.`,
    );
  }

  if (!isEnabled(env.EAS_BUILD)) return;

  const required = [
    "EXPO_PUBLIC_SENTRY_DSN",
    "EXPO_PUBLIC_POSTHOG_API_KEY",
    "SENTRY_ORG",
    "SENTRY_PROJECT",
    "SENTRY_AUTH_TOKEN",
  ].filter(name => !String(env[name] ?? "").trim());

  if (required.length > 0) {
    throw new Error(
      `Production telemetry configuration is incomplete: ${required.join(", ")}.`,
    );
  }
}

function buildTelemetryConfig(env = process.env, version = "0.0.0") {
  const environment = resolveAppEnvironment(env);
  assertProductionSafety(env, environment);

  const sentryDsn = optionalHttpsUrl(
    env.EXPO_PUBLIC_SENTRY_DSN,
    "EXPO_PUBLIC_SENTRY_DSN",
  );
  const posthogHost = optionalHttpsUrl(
    env.EXPO_PUBLIC_POSTHOG_HOST || "https://eu.i.posthog.com",
    "EXPO_PUBLIC_POSTHOG_HOST",
  );
  const posthogApiKey = String(env.EXPO_PUBLIC_POSTHOG_API_KEY ?? "").trim();
  const defaultSampleRate = environment === "production" ? 0.1 : 1;

  return {
    publicConfig: {
      environment,
      release: `rideza@${version}`,
      sentryDsn,
      posthogApiKey,
      posthogHost,
      tracesSampleRate: parseSampleRate(
        env.EXPO_PUBLIC_TELEMETRY_SAMPLE_RATE,
        defaultSampleRate,
      ),
      allowCrashDetails:
        environment !== "production" &&
        isEnabled(env.EXPO_PUBLIC_ENABLE_CRASH_SCREEN),
    },
    sentryPlugin:
      String(env.SENTRY_ORG ?? "").trim() &&
      String(env.SENTRY_PROJECT ?? "").trim()
        ? [
            "@sentry/react-native/expo",
            {
              organization: String(env.SENTRY_ORG).trim(),
              project: String(env.SENTRY_PROJECT).trim(),
              url: "https://sentry.io/",
            },
          ]
        : null,
  };
}

module.exports = {
  assertProductionSafety,
  buildTelemetryConfig,
  isEnabled,
  parseSampleRate,
  resolveAppEnvironment,
};
