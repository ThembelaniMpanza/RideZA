import { getApps, initializeApp } from "firebase-admin/app";
import { logger } from "firebase-functions";
import { onRequest } from "firebase-functions/v2/https";
import { RequestAuthError, requireVerifiedUser } from "./auth";

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
