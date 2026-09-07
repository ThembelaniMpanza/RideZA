import * as Sentry from "@sentry/react-native";
import * as Application from "expo-application";
import * as Updates from "expo-updates";
import PostHog from "posthog-react-native";
import { Platform } from "react-native";
import {
  normalizeRouteTemplate,
  redactTelemetryValue,
  sanitizeTelemetryProperties,
  type TelemetryProperties,
} from "./privacy";
import { getTelemetryRuntimeConfig } from "./runtimeConfig";

export type AnalyticsEventName =
  | "analytics_consent_changed"
  | "app_session_started"
  | "authentication_completed"
  | "destination_selected"
  | "fare_quote_viewed"
  | "onboarding_completed"
  | "payment_completed"
  | "payment_started"
  | "realtime_connection_changed"
  | "ride_cancelled"
  | "ride_matched"
  | "ride_requested"
  | "ride_search_started"
  | "screen_viewed"
  | "trip_completed"
  | "trip_review_submitted";

export type PerformanceMetric =
  | "api_request"
  | "app_start"
  | "fare_quote"
  | "location_initial_fix"
  | "map_interaction"
  | "realtime_connect"
  | "route_calculation"
  | "ride_request";

export const PERFORMANCE_BUDGETS_MS: Record<PerformanceMetric, number> = {
  api_request: 2_500,
  app_start: 3_000,
  fare_quote: 2_500,
  location_initial_fix: 5_000,
  map_interaction: 250,
  realtime_connect: 5_000,
  route_calculation: 3_000,
  ride_request: 4_000,
};

const config = getTelemetryRuntimeConfig();
const nativeBuild = Application.nativeBuildVersion ?? "development";
const updateSuffix = Updates.updateId ? `:${Updates.updateId.slice(0, 8)}` : "";
const runtimeRelease = `${config.release}+${nativeBuild}${updateSuffix}`;
const appStartedAt = Date.now();
let appStartRecorded = false;
let analyticsEnabled = false;
let posthog: PostHog | null = null;

function sanitizeProviderPayload<T>(event: T): T {
  const sanitized = redactTelemetryValue(event) as T;
  if (sanitized && typeof sanitized === "object") {
    const record = sanitized as Record<string, unknown>;
    delete record.user;
    if (record.exception && typeof record.exception === "object") {
      const exception = record.exception as { values?: unknown[] };
      if (Array.isArray(exception.values)) {
        exception.values = exception.values.map(value => {
          if (!value || typeof value !== "object") return value;
          const safeValue = value as Record<string, unknown>;
          return {
            ...safeValue,
            value: typeof safeValue.type === "string"
              ? `${safeValue.type} (details filtered)`
              : "Application error (details filtered)",
          };
        });
      }
    }
    if (record.request && typeof record.request === "object") {
      const request = record.request as Record<string, unknown>;
      delete request.cookies;
      delete request.data;
      delete request.headers;
      if (typeof request.url === "string") {
        request.url = normalizeRouteTemplate(request.url);
      }
    }
  }
  return sanitized;
}

export function initializeTelemetry() {
  Sentry.init({
    dsn: config.sentryDsn || undefined,
    enabled: Boolean(config.sentryDsn),
    environment: config.environment,
    release: runtimeRelease,
    dist: nativeBuild,
    tracesSampleRate: config.tracesSampleRate,
    sendDefaultPii: false,
    attachStacktrace: true,
    enableAutoSessionTracking: true,
    enableAppStartTracking: true,
    enableNativeFramesTracking: true,
    enableStallTracking: true,
    maxBreadcrumbs: 50,
    beforeSend: event => sanitizeProviderPayload(event),
    beforeSendTransaction: event => sanitizeProviderPayload(event),
    beforeBreadcrumb: breadcrumb => sanitizeProviderPayload(breadcrumb),
  });

  Sentry.setUser(null);
  Sentry.setTags({
    "deployment.environment": config.environment,
    release: runtimeRelease,
  });

  if (config.posthogApiKey) {
    posthog = new PostHog(config.posthogApiKey, {
      host: config.posthogHost,
      defaultOptIn: false,
      disableGeoip: true,
      captureAppLifecycleEvents: false,
      disableRemoteFeatureFlags: true,
      preloadFeatureFlags: false,
      sendFeatureFlagEvent: false,
      enableSessionReplay: false,
      setDefaultPersonProperties: false,
      capturePushNotificationSubscriptions: false,
      capturePushNotificationOpened: false,
      personProfiles: "never",
      customAppProperties: properties => ({
        $app_build: properties.$app_build,
        $app_name: properties.$app_name,
        $app_namespace: properties.$app_namespace,
        $app_version: properties.$app_version,
        $device_type: properties.$device_type,
        $is_emulator: properties.$is_emulator,
        $os_name: properties.$os_name,
        $os_version: properties.$os_version,
      }),
      before_send: event => sanitizeProviderPayload(event),
    });
  }
}

initializeTelemetry();

export function getTelemetryConfiguration() {
  return {
    analyticsConfigured: Boolean(config.posthogApiKey),
    crashReportingConfigured: Boolean(config.sentryDsn),
    environment: config.environment,
    release: runtimeRelease,
    allowCrashDetails: config.allowCrashDetails,
  };
}

export async function setAnalyticsConsent(granted: boolean) {
  analyticsEnabled = granted && Boolean(posthog);
  if (!posthog) return;

  await posthog.ready();
  if (granted) {
    await posthog.optIn();
    posthog.capture(
      "analytics_consent_changed",
      sanitizeTelemetryProperties({
        environment: config.environment,
        outcome: "granted",
        release: runtimeRelease,
      }),
    );
  } else {
    posthog.capture(
      "analytics_consent_changed",
      sanitizeTelemetryProperties({
        environment: config.environment,
        outcome: "revoked",
        release: runtimeRelease,
      }),
    );
    await posthog.flush().catch(() => undefined);
    await posthog.optOut();
  }
}

export function trackAnalyticsEvent(
  event: AnalyticsEventName,
  properties: TelemetryProperties = {},
) {
  const safeProperties = sanitizeTelemetryProperties({
    ...properties,
    environment: config.environment,
    release: runtimeRelease,
  });
  if (analyticsEnabled) posthog?.capture(event, safeProperties);
}

export function trackScreen(pathname: string) {
  trackAnalyticsEvent("screen_viewed", {
    screen: normalizeRouteTemplate(pathname || "/"),
  });
}

export function captureOperationalError(
  error: unknown,
  properties: TelemetryProperties = {},
) {
  const safeProperties = sanitizeTelemetryProperties(properties);
  const sourceError = error instanceof Error ? error : null;
  const safeError = new Error(
    `${sourceError?.name ?? "ApplicationError"} (details filtered)`,
  );
  safeError.name = sourceError?.name ?? "ApplicationError";
  if (sourceError?.stack) {
    safeError.stack = [safeError.toString(), ...sourceError.stack.split("\n").slice(1)].join("\n");
  }
  Sentry.withScope(scope => {
    scope.setTag("rideza.error_source", String(safeProperties.source ?? "app"));
    scope.setExtras(safeProperties);
    Sentry.captureException(safeError);
  });
}

export function startPerformanceMeasurement(
  metric: PerformanceMetric,
  properties: TelemetryProperties = {},
) {
  const startedAt = Date.now();
  const budgetMs = PERFORMANCE_BUDGETS_MS[metric];
  const safeProperties = sanitizeTelemetryProperties(properties);
  const spanAttributes = Object.fromEntries(
    Object.entries(safeProperties).filter(([, value]) => value !== null),
  ) as Record<string, string | number | boolean>;
  const span = Sentry.startInactiveSpan({
    name: `rideza.${metric}`,
    op: `app.${metric}`,
    attributes: spanAttributes,
  });
  let ended = false;

  return {
    end(outcome: "success" | "failure" | "fallback" | "cancelled" = "success") {
      if (ended) return;
      ended = true;
      const durationMs = Math.max(0, Date.now() - startedAt);
      const exceeded = durationMs > budgetMs;
      span.setAttributes({
        "rideza.duration_ms": durationMs,
        "rideza.budget_ms": budgetMs,
        "rideza.budget_exceeded": exceeded,
        "rideza.outcome": outcome,
      });
      span.setStatus({ code: outcome === "failure" ? 2 : 1 });
      span.end();

      const performanceProperties = sanitizeTelemetryProperties({
        ...properties,
        budget_ms: budgetMs,
        duration_bucket:
          durationMs > 10_000 ? "10000+" : `${Math.ceil(durationMs / 250) * 250}`,
        duration_ms: durationMs,
        exceeded,
        metric,
        outcome,
      });
      Sentry.addBreadcrumb({
        category: "performance",
        message: metric,
        level: exceeded ? "warning" : "info",
        data: performanceProperties,
      });
      if (analyticsEnabled) posthog?.capture("performance_measured", performanceProperties);
    },
  };
}

export function recordAppStart() {
  if (appStartRecorded) return;
  appStartRecorded = true;
  const durationMs = Math.max(0, Date.now() - appStartedAt);
  const budgetMs = PERFORMANCE_BUDGETS_MS.app_start;
  Sentry.addBreadcrumb({
    category: "performance",
    message: "app_start",
    level: durationMs > budgetMs ? "warning" : "info",
    data: { duration_ms: durationMs, budget_ms: budgetMs },
  });
  if (analyticsEnabled) {
    posthog?.capture("performance_measured", sanitizeTelemetryProperties({
      budget_ms: budgetMs,
      duration_bucket:
        durationMs > 10_000 ? "10000+" : `${Math.ceil(durationMs / 250) * 250}`,
      duration_ms: durationMs,
      exceeded: durationMs > budgetMs,
      metric: "app_start",
      outcome: "success",
    }));
  }
  trackAnalyticsEvent("app_session_started", { source: Platform.OS });
}

export async function flushTelemetry() {
  await Promise.allSettled([
    Sentry.flush(),
    posthog?.flush() ?? Promise.resolve(),
  ]);
}
