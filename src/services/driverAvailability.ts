import { get, ref, serverTimestamp, set } from "firebase/database";
import {
  auth,
  database,
  isFirebaseDatabaseConfigured,
} from "./firebase";

const API_TIMEOUT_MS = 10_000;

export type DriverServiceType =
  | "economy"
  | "standard"
  | "premium"
  | "seven_seater";

export type DriverAvailability = {
  activeVehicleId: string | null;
  available: boolean;
  locationSessionId: string | null;
  serviceTypes: DriverServiceType[];
  status: "offline" | "online";
  updatedAt: string | null;
};

export type DriverLocation = {
  accuracy: number;
  heading?: number | null;
  latitude: number;
  longitude: number;
  speed?: number | null;
};

type ActiveLocationSession = {
  driverId: string;
  nextSequence: number;
  sessionId: string;
};

let activeLocationSession: ActiveLocationSession | null = null;

function getApiUrl() {
  const apiUrl = process.env.EXPO_PUBLIC_API_URL?.trim().replace(/\/+$/, "");
  if (!apiUrl) {
    throw new Error("EXPO_PUBLIC_API_URL is not configured.");
  }
  return apiUrl;
}

async function requestAvailability(
  method: "GET" | "PUT",
  body?: { available: boolean; serviceTypes?: DriverServiceType[] },
) {
  const user = auth.currentUser;
  if (!user) throw new Error("A signed-in driver is required.");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

  try {
    const idToken = await user.getIdToken();
    const response = await fetch(
      `${getApiUrl()}/v1/drivers/me/availability`,
      {
        method,
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${idToken}`,
          "Content-Type": "application/json",
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      },
    );
    const payload = (await response.json()) as
      | DriverAvailability
      | { error?: string };

    if (!response.ok) {
      throw new Error(
        "error" in payload && payload.error
          ? payload.error
          : `Availability request failed with status ${response.status}.`,
      );
    }

    return payload as DriverAvailability;
  } finally {
    clearTimeout(timeout);
  }
}

async function updateActiveSession(availability: DriverAvailability) {
  const user = auth.currentUser;
  if (
    !user ||
    !availability.available ||
    !availability.locationSessionId
  ) {
    activeLocationSession = null;
    return;
  }

  const isSameSession =
    activeLocationSession?.driverId === user.uid &&
    activeLocationSession.sessionId === availability.locationSessionId;
  const nextSequence = isSameSession
    ? activeLocationSession?.nextSequence ?? 1
    : 1;

  activeLocationSession = {
    driverId: user.uid,
    nextSequence,
    sessionId: availability.locationSessionId,
  };

  if (!isSameSession && isFirebaseDatabaseConfigured() && database) {
    const snapshot = await get(ref(database, `driverLocations/${user.uid}`));
    const currentLocation = snapshot.val() as {
      sequence?: unknown;
      sessionId?: unknown;
    } | null;

    if (
      activeLocationSession?.sessionId === availability.locationSessionId &&
      currentLocation?.sessionId === availability.locationSessionId &&
      typeof currentLocation.sequence === "number"
    ) {
      activeLocationSession.nextSequence = currentLocation.sequence + 1;
    }
  }
}

export async function getDriverAvailability() {
  const availability = await requestAvailability("GET");
  await updateActiveSession(availability);
  return availability;
}

export async function setDriverAvailability(
  available: boolean,
  serviceTypes?: DriverServiceType[],
) {
  const availability = await requestAvailability("PUT", {
    available,
    ...(serviceTypes ? { serviceTypes } : {}),
  });
  await updateActiveSession(availability);
  return availability;
}

export async function publishDriverLocation(location: DriverLocation) {
  const user = auth.currentUser;
  if (!user) throw new Error("A signed-in driver is required.");
  if (!isFirebaseDatabaseConfigured() || !database) {
    throw new Error("EXPO_PUBLIC_FIREBASE_DATABASE_URL is not configured.");
  }
  if (
    !activeLocationSession ||
    activeLocationSession.driverId !== user.uid
  ) {
    throw new Error("The driver must be online before publishing location.");
  }

  const numericValues = [
    location.latitude,
    location.longitude,
    location.accuracy,
    location.heading,
    location.speed,
  ].filter(value => value !== undefined && value !== null);
  if (!numericValues.every(value => Number.isFinite(value))) {
    throw new Error("Driver location values must be finite numbers.");
  }

  const sequence = activeLocationSession.nextSequence;
  activeLocationSession.nextSequence += 1;

  await set(ref(database, `driverLocations/${user.uid}`), {
    accuracy: location.accuracy,
    heading: location.heading ?? null,
    latitude: location.latitude,
    longitude: location.longitude,
    recordedAt: serverTimestamp(),
    sequence,
    sessionId: activeLocationSession.sessionId,
    speed: location.speed ?? null,
  });
}
