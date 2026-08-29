import { getAuth, type DecodedIdToken } from "firebase-admin/auth";

type AuthorizationRequest = {
  get(name: string): string | undefined;
};

export class RequestAuthError extends Error {
  constructor(
    readonly status: 401 | 403,
    message: string,
  ) {
    super(message);
    this.name = "RequestAuthError";
  }
}

export async function requireVerifiedUser(
  request: AuthorizationRequest,
): Promise<DecodedIdToken> {
  const authorization = request.get("authorization");
  const match = authorization?.match(/^Bearer\s+(.+)$/i);

  if (!match?.[1]) {
    throw new RequestAuthError(401, "A Firebase bearer token is required.");
  }

  try {
    return await getAuth().verifyIdToken(match[1], true);
  } catch {
    throw new RequestAuthError(401, "The Firebase session is invalid or revoked.");
  }
}
