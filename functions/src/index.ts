import { getApps, initializeApp } from "firebase-admin/app";
import { logger } from "firebase-functions";
import { onRequest } from "firebase-functions/v2/https";
import { RequestAuthError, requireVerifiedUser } from "./auth";
import {
  DriverAvailabilityError,
  getDriverAvailability,
  parseAvailabilityRequest,
  setDriverAvailability,
} from "./driverAvailability";

if (getApps().length === 0) initializeApp();

export const verifySession = onRequest(
  {
    cors: true,
    invoker: "public",
    maxInstances: 20,
    region: "us-central1",
  },
  async (request, response) => {
    response.set("Cache-Control", "no-store");

    if (request.method !== "POST") {
      response.set("Allow", "POST");
      response.status(405).json({ error: "Method not allowed" });
      return;
    }

    try {
      const token = await requireVerifiedUser(request);
      response.status(200).json({
        uid: token.uid,
        email: typeof token.email === "string" ? token.email : null,
        expiresAt: new Date(token.exp * 1000).toISOString(),
      });
    } catch (error) {
      if (error instanceof RequestAuthError) {
        response.status(error.status).json({ error: error.message });
        return;
      }

      logger.error("Unexpected session verification error", error);
      response.status(500).json({ error: "Session verification failed" });
    }
  },
);

export const api = onRequest(
  {
    cors: true,
    invoker: "public",
    maxInstances: 100,
    region: "us-central1",
  },
  async (request, response) => {
    response.set("Cache-Control", "no-store");

    const path = request.path.replace(/\/+$/, "") || "/";
    if (path !== "/v1/drivers/me/availability") {
      response.status(404).json({ error: "Endpoint not found" });
      return;
    }

    if (request.method !== "GET" && request.method !== "PUT") {
      response.set("Allow", "GET, PUT");
      response.status(405).json({ error: "Method not allowed" });
      return;
    }

    try {
      const token = await requireVerifiedUser(request);
      const availability = request.method === "GET"
        ? await getDriverAvailability(token)
        : await setDriverAvailability(
            token,
            parseAvailabilityRequest(request.body),
          );

      response.status(200).json(availability);
    } catch (error) {
      if (
        error instanceof RequestAuthError ||
        error instanceof DriverAvailabilityError
      ) {
        response.status(error.status).json({ error: error.message });
        return;
      }

      logger.error("Unexpected driver availability error", error);
      response.status(500).json({ error: "Driver availability request failed" });
    }
  },
);
