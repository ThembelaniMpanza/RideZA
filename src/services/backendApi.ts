import { auth } from "./firebase";
import {
  CORRELATION_HEADER,
  getRequestCorrelationId,
  getResponseCorrelationId,
} from "./correlation";
import {
  captureOperationalError,
  startPerformanceMeasurement,
} from "../telemetry/telemetry";
import { normalizeRouteTemplate } from "../telemetry/privacy";

const REQUEST_TIMEOUT_MS = 15_000;

export type BackendSession = {
  uid: string;
  email: string | null;
  expiresAt: string;
  platformUserId: string;
  phoneNumber: string | null;
  role: "rider" | "driver" | "admin";
  createdAtUtc: string;
};

export type GeoPoint = { latitude: number; longitude: number };

export type FarePlan = {
  id: string;
  code: string;
  displayName: string;
  currency: string;
  isActive: boolean;
};

export type FareEstimate = {
  amount: number;
  currency: string;
  surgeMultiplier: number;
  baseFare: number;
  distanceFare: number;
  timeFare: number;
};

export type TripState = {
  id: string;
  riderId: string;
  driverId: string | null;
  status: string;
  pickupLabel?: string;
  pickupLatitude?: number | null;
  pickupLongitude?: number | null;
  destinationLabel?: string;
  destinationLatitude?: number | null;
  destinationLongitude?: number | null;
  estimatedDistanceKm?: number | null;
  estimatedDurationMinutes?: number | null;
  totalFare?: number;
  currency?: string;
  updatedAtUtc: string;
};

export type TripMessage = {
  id: string;
  tripId: string;
  senderId: string;
  message: string;
  sentAtUtc: string;
};

export class BackendApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly details?: unknown,
    public readonly correlationId?: string,
  ) {
    super(message);
    this.name = "BackendApiError";
  }
}

export function getBackendBaseUrl() {
  const configured = process.env.EXPO_PUBLIC_API_URL?.trim().replace(/\/+$/, "");
  if (!configured) throw new Error("EXPO_PUBLIC_API_URL is not configured.");
  return configured;
}

async function parseBody(response: Response) {
  if (response.status === 204) return undefined;
  const contentType = response.headers.get("content-type") ?? "";
  return contentType.includes("application/json")
    ? response.json()
    : response.text();
}

async function send<T>(path: string, init: RequestInit, forceRefresh: boolean): Promise<T> {
  const routeTemplate = normalizeRouteTemplate(path);
  const measurement = startPerformanceMeasurement("api_request", {
    route_template: routeTemplate,
  });
  const user = auth.currentUser;
  if (!user) {
    measurement.end("failure");
    throw new BackendApiError(401, "Sign in before calling the RideZA API.");
  }

  const headers = new Headers(init.headers);
  const requestCorrelationId = getRequestCorrelationId(headers.get(CORRELATION_HEADER));
  headers.set(CORRELATION_HEADER, requestCorrelationId);
  headers.set("Accept", "application/json");
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    headers.set("Authorization", `Bearer ${await user.getIdToken(forceRefresh)}`);
    const response = await fetch(`${getBackendBaseUrl()}${path}`, {
      ...init,
      headers,
      signal: controller.signal,
    });
    const responseCorrelationId = getResponseCorrelationId(response, requestCorrelationId);

    if (response.status === 401 && !forceRefresh) {
      measurement.end("cancelled");
      return send<T>(path, { ...init, headers }, true);
    }

    const body = await parseBody(response);
    if (!response.ok) {
      const message = body && typeof body === "object" && "error" in body
        ? String(body.error)
        : `RideZA API request failed with status ${response.status}.`;
      throw new BackendApiError(response.status, message, body, responseCorrelationId);
    }
    measurement.end("success");
    return body as T;
  } catch (error) {
    measurement.end("failure");
    const apiError = error instanceof BackendApiError
      ? error
      : new BackendApiError(
        0,
        error instanceof Error ? error.message : "Network request failed.",
        undefined,
        requestCorrelationId,
      );
    if (apiError.status === 0 || apiError.status >= 500) {
      captureOperationalError(apiError, {
        correlation_id: apiError.correlationId ?? requestCorrelationId,
        http_status: apiError.status,
        route_template: routeTemplate,
        source: "backend_api",
      });
    }
    throw apiError;
  } finally {
    clearTimeout(timeout);
  }
}

export function apiRequest<T>(path: string, init: RequestInit = {}) {
  return send<T>(path, init, false);
}

export const riderApi = {
  openSession: () => apiRequest<BackendSession>("/api/identity/session", { method: "POST", body: "{}" }),
  farePlans: () => apiRequest<FarePlan[]>("/api/pricing/fare-plans"),
  estimateFare: (input: { distanceKm: number; durationMinutes: number; farePlanCode?: string }) =>
    apiRequest<FareEstimate>("/api/pricing/estimates", { method: "POST", body: JSON.stringify(input) }),
  requestTrip: (input: {
    farePlanId: string;
    pickup: GeoPoint;
    pickupLabel: string;
    destination: GeoPoint;
    destinationLabel: string;
    estimatedDistanceKm: number;
    estimatedDurationMinutes: number;
    currency?: string;
  }) => apiRequest<TripState & Record<string, unknown>>("/api/trips", {
    method: "POST",
    body: JSON.stringify({ riderId: "00000000-0000-0000-0000-000000000000", currency: "ZAR", ...input }),
  }),
  tripState: (tripId: string) => apiRequest<TripState>(`/api/trips/${tripId}/state`),
  cancelTrip: (tripId: string, reason?: string) => apiRequest<TripState>(`/api/trips/${tripId}/cancel`, {
    method: "POST",
    body: JSON.stringify({ reason: reason ?? null }),
  }),
  messages: (tripId: string, before?: string) => apiRequest<TripMessage[]>(
    `/api/trips/${tripId}/messages${before ? `?before=${encodeURIComponent(before)}` : ""}`,
  ),
  sendMessage: (tripId: string, message: string) => apiRequest<TripMessage>(`/api/trips/${tripId}/messages`, {
    method: "POST",
    body: JSON.stringify({ message }),
  }),
};
