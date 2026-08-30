import { randomUUID } from "node:crypto";
import { getDatabase } from "firebase-admin/database";
import type { DecodedIdToken } from "firebase-admin/auth";

const DRIVER_SERVICE_TYPES = [
  "economy",
  "standard",
  "premium",
  "seven_seater",
] as const;

type DriverServiceType = (typeof DRIVER_SERVICE_TYPES)[number];

type AvailabilityRequest = {
  available: boolean;
  serviceTypes: DriverServiceType[];
};

type DriverEligibility = {
  activeVehicleId: string;
  serviceTypes: DriverServiceType[];
};

type StoredAvailability = {
  activeVehicleId: string | null;
  locationSessionId: string | null;
  online: boolean;
  serviceTypes: Record<string, true>;
  status: "offline" | "online";
  updatedAt: number;
};

export type DriverAvailability = {
  activeVehicleId: string | null;
  available: boolean;
  locationSessionId: string | null;
  serviceTypes: DriverServiceType[];
  status: "offline" | "online";
  updatedAt: string | null;
};

export class DriverAvailabilityError extends Error {
  constructor(
    readonly status: 400 | 403 | 409,
    message: string,
  ) {
    super(message);
    this.name = "DriverAvailabilityError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isDriverServiceType(value: unknown): value is DriverServiceType {
  return (
    typeof value === "string" &&
    DRIVER_SERVICE_TYPES.includes(value as DriverServiceType)
  );
}

function hasDriverRole(token: DecodedIdToken) {
  const claims = token as DecodedIdToken & {
    driver?: unknown;
    role?: unknown;
    roles?: unknown;
  };

  if (claims.driver === true || claims.role === "driver") return true;
  if (Array.isArray(claims.roles)) return claims.roles.includes("driver");
  return isRecord(claims.roles) && claims.roles.driver === true;
}

function requireDriverRole(token: DecodedIdToken) {
  if (!hasDriverRole(token)) {
    throw new DriverAvailabilityError(403, "A driver account is required.");
  }
}

function parseServiceTypes(value: unknown): DriverServiceType[] {
  if (!Array.isArray(value)) {
    throw new DriverAvailabilityError(
      400,
      "serviceTypes must be an array when supplied.",
    );
  }

  const serviceTypes = [...new Set(value)];
  if (
    serviceTypes.length === 0 ||
    serviceTypes.length > DRIVER_SERVICE_TYPES.length ||
    !serviceTypes.every(isDriverServiceType)
  ) {
    throw new DriverAvailabilityError(
      400,
      `serviceTypes must contain one or more of: ${DRIVER_SERVICE_TYPES.join(", ")}.`,
    );
  }

  return serviceTypes;
}

export function parseAvailabilityRequest(body: unknown): AvailabilityRequest {
  if (!isRecord(body) || typeof body.available !== "boolean") {
    throw new DriverAvailabilityError(
      400,
      "The request body must contain an available boolean.",
    );
  }

  const allowedKeys = new Set(["available", "serviceTypes"]);
  if (Object.keys(body).some(key => !allowedKeys.has(key))) {
    throw new DriverAvailabilityError(400, "The request body has unknown fields.");
  }

  return {
    available: body.available,
    serviceTypes:
      body.serviceTypes === undefined ? [] : parseServiceTypes(body.serviceTypes),
  };
}

function normalizeStoredServiceTypes(value: unknown): DriverServiceType[] {
  if (!isRecord(value)) return [];
  return DRIVER_SERVICE_TYPES.filter(serviceType => value[serviceType] === true);
}

function serializeServiceTypes(serviceTypes: DriverServiceType[]) {
  return serviceTypes.reduce<Record<string, true>>((result, serviceType) => {
    result[serviceType] = true;
    return result;
  }, {});
}

function serializeAvailability(value: unknown): DriverAvailability {
  if (!isRecord(value) || value.online !== true) {
    const updatedAt = isRecord(value) && typeof value.updatedAt === "number"
      ? new Date(value.updatedAt).toISOString()
      : null;

    return {
      activeVehicleId: null,
      available: false,
      locationSessionId: null,
      serviceTypes: [],
      status: "offline",
      updatedAt,
    };
  }

  return {
    activeVehicleId:
      typeof value.activeVehicleId === "string" ? value.activeVehicleId : null,
    available: true,
    locationSessionId:
      typeof value.locationSessionId === "string"
        ? value.locationSessionId
        : null,
    serviceTypes: normalizeStoredServiceTypes(value.serviceTypes),
    status: "online",
    updatedAt:
      typeof value.updatedAt === "number"
        ? new Date(value.updatedAt).toISOString()
        : null,
  };
}

async function getDriverEligibility(
  driverId: string,
  requestedServiceTypes: DriverServiceType[],
): Promise<DriverEligibility> {
  const accessSnapshot = await getDatabase().ref(`driverAccess/${driverId}`).get();
  const access = accessSnapshot.val();

  if (!isRecord(access)) {
    throw new DriverAvailabilityError(
      409,
      "Complete driver onboarding before going online.",
    );
  }

  if (access.approved !== true) {
    throw new DriverAvailabilityError(
      409,
      "The driver account is not approved to go online.",
    );
  }

  const activeVehicleId = access.activeVehicleId;
  if (typeof activeVehicleId !== "string" || activeVehicleId.length === 0) {
    throw new DriverAvailabilityError(
      409,
      "Select an approved active vehicle before going online.",
    );
  }

  const vehicleServiceTypes = normalizeStoredServiceTypes(access.serviceTypes);
  const serviceTypes =
    requestedServiceTypes.length > 0
      ? requestedServiceTypes
      : vehicleServiceTypes;

  if (serviceTypes.length === 0) {
    throw new DriverAvailabilityError(
      409,
      "The active vehicle has no approved ride services in driver access.",
    );
  }

  if (
    serviceTypes.some(serviceType => !vehicleServiceTypes.includes(serviceType))
  ) {
    throw new DriverAvailabilityError(
      409,
      "The active vehicle is not approved for every requested ride service.",
    );
  }

  return { activeVehicleId, serviceTypes };
}

export async function getDriverAvailability(
  token: DecodedIdToken,
): Promise<DriverAvailability> {
  requireDriverRole(token);
  const snapshot = await getDatabase()
    .ref(`driverAvailability/${token.uid}`)
    .get();
  return serializeAvailability(snapshot.val());
}

export async function setDriverAvailability(
  token: DecodedIdToken,
  request: AvailabilityRequest,
): Promise<DriverAvailability> {
  requireDriverRole(token);

  const eligibility = request.available
    ? await getDriverEligibility(token.uid, request.serviceTypes)
    : null;
  const availabilityRef = getDatabase().ref(
    `driverAvailability/${token.uid}`,
  );
  const nextLocationSessionId = randomUUID();
  const updatedAt = Date.now();

  const result = await availabilityRef.transaction(
    currentValue => {
      const current = isRecord(currentValue) ? currentValue : null;
      const reuseSession =
        request.available &&
        current?.online === true &&
        typeof current.locationSessionId === "string";

      const nextValue: StoredAvailability = {
        activeVehicleId: eligibility?.activeVehicleId ?? null,
        locationSessionId: request.available
          ? reuseSession
            ? (current.locationSessionId as string)
            : nextLocationSessionId
          : null,
        online: request.available,
        serviceTypes: serializeServiceTypes(eligibility?.serviceTypes ?? []),
        status: request.available ? "online" : "offline",
        updatedAt,
      };

      return nextValue;
    },
    undefined,
    false,
  );

  if (!result.committed) {
    throw new Error("The availability update was not committed.");
  }

  if (!request.available) {
    await getDatabase().ref(`driverLocations/${token.uid}`).remove();
  }

  return serializeAvailability(result.snapshot.val());
}
