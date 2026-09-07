import Constants from "expo-constants";

export type AppEnvironment = "development" | "staging" | "production";

export type TelemetryRuntimeConfig = {
  environment: AppEnvironment;
  release: string;
  sentryDsn: string;
  posthogApiKey: string;
  posthogHost: string;
  tracesSampleRate: number;
  allowCrashDetails: boolean;
};

const fallback: TelemetryRuntimeConfig = {
  environment: "development",
  release: `rideza@${Constants.expoConfig?.version ?? "0.0.0"}`,
  sentryDsn: "",
  posthogApiKey: "",
  posthogHost: "https://eu.i.posthog.com",
  tracesSampleRate: 1,
  allowCrashDetails: false,
};

export function getTelemetryRuntimeConfig(): TelemetryRuntimeConfig {
  const configured = Constants.expoConfig?.extra?.telemetry as
    | Partial<TelemetryRuntimeConfig>
    | undefined;

  return {
    environment:
      configured?.environment === "staging" ||
      configured?.environment === "production"
        ? configured.environment
        : "development",
    release:
      typeof configured?.release === "string" ? configured.release : fallback.release,
    sentryDsn:
      typeof configured?.sentryDsn === "string" ? configured.sentryDsn : "",
    posthogApiKey:
      typeof configured?.posthogApiKey === "string" ? configured.posthogApiKey : "",
    posthogHost:
      typeof configured?.posthogHost === "string"
        ? configured.posthogHost
        : fallback.posthogHost,
    tracesSampleRate:
      typeof configured?.tracesSampleRate === "number"
        ? Math.min(1, Math.max(0, configured.tracesSampleRate))
        : fallback.tracesSampleRate,
    allowCrashDetails:
      configured?.environment !== "production" && configured?.allowCrashDetails === true,
  };
}
