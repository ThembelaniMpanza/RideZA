export type TelemetryPrimitive = string | number | boolean | null;
export type TelemetryProperties = Record<string, TelemetryPrimitive | undefined>;

const ALLOWED_PROPERTY_NAMES = new Set([
  "app_state", "auth_method", "budget_ms", "correlation_id",
  "duration_bucket", "duration_ms", "environment", "event_type",
  "exceeded", "http_status", "metric", "outcome", "payment_method",
  "rating_bucket", "reason_provided", "reconnect_attempt", "release",
  "ride_class", "route_template", "screen", "source", "status", "tipped",
]);

const SENSITIVE_KEY = /(authorization|cookie|credential|token|secret|password|email|phone|address|latitude|longitude|coordinate|message|note|card|bank|payment_details|document|pickup|destination|route_history|location)/i;
const EMAIL = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const BEARER_TOKEN = /\bBearer\s+[A-Za-z0-9._~+/=-]+/gi;
const JWT = /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g;
const COORDINATE_PAIR = /-?\d{1,3}\.\d{4,}\s*[,;]\s*-?\d{1,3}\.\d{4,}/g;
const PHONE = /(?:\+?27|0)[ -]?(?:\d[ -]?){9}\b/g;
const UUID = /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi;

export function redactTelemetryText(value: string) {
  return value
    .replace(BEARER_TOKEN, "[Filtered]")
    .replace(JWT, "[Filtered]")
    .replace(EMAIL, "[Filtered]")
    .replace(COORDINATE_PAIR, "[Filtered]")
    .replace(PHONE, "[Filtered]")
    .replace(/([?&](?:access_token|token|key|code)=)[^&#\s]+/gi, "$1[Filtered]");
}

export function normalizeRouteTemplate(path: string) {
  const pathOnly = path.split(/[?#]/, 1)[0];
  return pathOnly
    .replace(UUID, ":id")
    .replace(/\/\d+(?=\/|$)/g, "/:id")
    .slice(0, 160);
}

export function sanitizeTelemetryProperties(
  properties: TelemetryProperties = {},
): Record<string, TelemetryPrimitive> {
  const sanitized: Record<string, TelemetryPrimitive> = {};

  for (const [key, value] of Object.entries(properties)) {
    if (!ALLOWED_PROPERTY_NAMES.has(key) || value === undefined) continue;
    if (typeof value === "number") {
      if (Number.isFinite(value)) sanitized[key] = value;
      continue;
    }
    if (typeof value === "boolean" || value === null) {
      sanitized[key] = value;
      continue;
    }
    sanitized[key] = redactTelemetryText(value).slice(0, 160);
  }

  return sanitized;
}

export function redactTelemetryValue(
  value: unknown,
  key = "",
  depth = 0,
): unknown {
  if (SENSITIVE_KEY.test(key)) return "[Filtered]";
  if (depth > 6) return "[Truncated]";
  if (typeof value === "string") return redactTelemetryText(value).slice(0, 1000);
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "boolean" || value === null || value === undefined) return value;
  if (Array.isArray(value)) {
    return value.slice(0, 50).map(item => redactTelemetryValue(item, key, depth + 1));
  }
  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .slice(0, 100)
        .map(([childKey, childValue]) => [
          childKey,
          redactTelemetryValue(childValue, childKey, depth + 1),
        ]),
    );
  }
  return String(value).slice(0, 160);
}
