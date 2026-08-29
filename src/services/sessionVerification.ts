import type { User } from "firebase/auth";

const VERIFY_TIMEOUT_MS = 10_000;

export type VerifiedSession = {
  uid: string;
  email: string | null;
  expiresAt: string;
};

export class SessionRejectedError extends Error {
  constructor(message = "The session is invalid or has been revoked.") {
    super(message);
    this.name = "SessionRejectedError";
  }
}

export class SessionVerificationUnavailableError extends Error {
  constructor(message = "The session verification service is unavailable.") {
    super(message);
    this.name = "SessionVerificationUnavailableError";
  }
}

export function isSessionVerificationConfigured() {
  return Boolean(process.env.EXPO_PUBLIC_AUTH_VERIFY_URL?.trim());
}

export async function verifySessionWithServer(
  user: User,
  forceRefresh = false,
): Promise<VerifiedSession | null> {
  const verifyUrl = process.env.EXPO_PUBLIC_AUTH_VERIFY_URL?.trim();
  if (!verifyUrl) return null;

  const idToken = await user.getIdToken(forceRefresh);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), VERIFY_TIMEOUT_MS);

  try {
    const response = await fetch(verifyUrl, {
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${idToken}`,
        "Content-Type": "application/json",
      },
      body: "{}",
      signal: controller.signal,
    });

    if (response.status === 401 || response.status === 403) {
      throw new SessionRejectedError();
    }

    if (!response.ok) {
      throw new SessionVerificationUnavailableError(
        `Session verification failed with status ${response.status}.`,
      );
    }

    const session = (await response.json()) as Partial<VerifiedSession>;
    if (
      session.uid !== user.uid ||
      typeof session.expiresAt !== "string" ||
      (session.email !== null && typeof session.email !== "string")
    ) {
      throw new SessionRejectedError("The verification response was invalid.");
    }

    return session as VerifiedSession;
  } catch (error) {
    if (
      error instanceof SessionRejectedError ||
      error instanceof SessionVerificationUnavailableError
    ) {
      throw error;
    }

    throw new SessionVerificationUnavailableError(
      error instanceof Error ? error.message : undefined,
    );
  } finally {
    clearTimeout(timeout);
  }
}
