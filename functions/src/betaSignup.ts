import { createHash } from "node:crypto";
import { getDatabase } from "firebase-admin/database";

const INTERESTS = ["Rider", "Driver", "Both"] as const;
const DEVICES = ["Android", "iOS"] as const;
const ALLOWED_WEB_ORIGINS = new Set([
  "https://ride-za.com",
  "https://www.ride-za.com",
  "https://staging.ride-za.com",
]);

type BetaInterest = (typeof INTERESTS)[number];
type BetaDevice = (typeof DEVICES)[number];

export type BetaSignupRequest = {
  fullName: string;
  email: string;
  mobile: string;
  city: string;
  interest: BetaInterest;
  device: BetaDevice;
  consent: true;
  company: string;
};

type StoredBetaSignup = {
  fullName: string;
  email: string;
  mobile: string;
  mobileNormalized: string;
  city: string;
  interest: BetaInterest;
  device: BetaDevice;
  consent: true;
  consentAt: number;
  consentVersion: "beta-v1";
  source: "website";
  sourceHost: string;
  createdAt: number;
  updatedAt: number;
  submissionCount: number;
};

export class BetaSignupError extends Error {
  constructor(
    readonly status: 400 | 403,
    message: string,
  ) {
    super(message);
    this.name = "BetaSignupError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requiredString(
  body: Record<string, unknown>,
  key: string,
  minLength: number,
  maxLength: number,
): string {
  const value = body[key];
  if (typeof value !== "string") {
    throw new BetaSignupError(400, `${key} must be a string.`);
  }

  const trimmed = value.trim();
  if (trimmed.length < minLength || trimmed.length > maxLength) {
    throw new BetaSignupError(
      400,
      `${key} must be between ${minLength} and ${maxLength} characters.`,
    );
  }

  return trimmed;
}

function enumValue<T extends readonly string[]>(
  body: Record<string, unknown>,
  key: string,
  allowed: T,
): T[number] {
  const value = body[key];
  if (typeof value !== "string" || !allowed.includes(value)) {
    throw new BetaSignupError(
      400,
      `${key} must be one of: ${allowed.join(", ")}.`,
    );
  }

  return value as T[number];
}

function normalizeMobile(value: string): string {
  const hasLeadingPlus = value.trim().startsWith("+");
  const digits = value.replace(/\D/g, "");
  if (digits.length < 8 || digits.length > 15) {
    throw new BetaSignupError(400, "mobile must contain 8 to 15 digits.");
  }

  return `${hasLeadingPlus ? "+" : ""}${digits}`;
}

function isLocalDevelopmentOrigin(origin: string): boolean {
  try {
    const url = new URL(origin);
    return (
      url.protocol === "http:" &&
      (url.hostname === "localhost" || url.hostname === "127.0.0.1")
    );
  } catch {
    return false;
  }
}

export function requireBetaSignupOrigin(origin: string | undefined): string {
  if (
    !origin ||
    (!ALLOWED_WEB_ORIGINS.has(origin) && !isLocalDevelopmentOrigin(origin))
  ) {
    throw new BetaSignupError(403, "This origin is not allowed.");
  }

  return new URL(origin).host;
}

export function parseBetaSignupRequest(body: unknown): BetaSignupRequest {
  if (!isRecord(body)) {
    throw new BetaSignupError(400, "The request body must be a JSON object.");
  }

  const allowedKeys = new Set([
    "fullName",
    "email",
    "mobile",
    "city",
    "interest",
    "device",
    "consent",
    "company",
  ]);
  if (Object.keys(body).some(key => !allowedKeys.has(key))) {
    throw new BetaSignupError(400, "The request body has unknown fields.");
  }

  const email = requiredString(body, "email", 3, 255).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new BetaSignupError(400, "email must be valid.");
  }

  if (body.consent !== true) {
    throw new BetaSignupError(400, "consent must be accepted.");
  }

  const company = body.company;
  if (company !== undefined && typeof company !== "string") {
    throw new BetaSignupError(400, "company must be a string when supplied.");
  }

  return {
    fullName: requiredString(body, "fullName", 2, 100),
    email,
    mobile: requiredString(body, "mobile", 8, 20),
    city: requiredString(body, "city", 2, 80),
    interest: enumValue(body, "interest", INTERESTS),
    device: enumValue(body, "device", DEVICES),
    consent: true,
    company: company?.trim().slice(0, 200) ?? "",
  };
}

export async function saveBetaSignup(
  request: BetaSignupRequest,
  sourceHost: string,
): Promise<void> {
  const mobileNormalized = normalizeMobile(request.mobile);
  const signupId = createHash("sha256")
    .update(request.email)
    .digest("hex")
    .slice(0, 40);
  const signupRef = getDatabase().ref(`betaSignups/${signupId}`);
  const now = Date.now();

  const result = await signupRef.transaction(
    currentValue => {
      const current = isRecord(currentValue) ? currentValue : null;
      const createdAt =
        current && typeof current.createdAt === "number"
          ? current.createdAt
          : now;
      const submissionCount =
        current && typeof current.submissionCount === "number"
          ? current.submissionCount + 1
          : 1;

      const nextValue: StoredBetaSignup = {
        fullName: request.fullName,
        email: request.email,
        mobile: request.mobile,
        mobileNormalized,
        city: request.city,
        interest: request.interest,
        device: request.device,
        consent: true,
        consentAt: now,
        consentVersion: "beta-v1",
        source: "website",
        sourceHost,
        createdAt,
        updatedAt: now,
        submissionCount,
      };

      return nextValue;
    },
    undefined,
    false,
  );

  if (!result.committed) {
    throw new Error("The beta signup was not committed.");
  }
}

export async function listBetaSignups(): Promise<Record<string, unknown>[]> {
  const snapshot = await getDatabase().ref("betaSignups").get();
  const value = snapshot.val();

  if (!isRecord(value)) return [];

  return Object.entries(value)
    .filter((entry): entry is [string, Record<string, unknown>] =>
      isRecord(entry[1]),
    )
    .map(([id, signup]): Record<string, unknown> => ({ id, ...signup }))
    .sort((left, right) => {
      const leftCreatedAt =
        typeof left["createdAt"] === "number" ? left["createdAt"] : 0;
      const rightCreatedAt =
        typeof right["createdAt"] === "number" ? right["createdAt"] : 0;
      return rightCreatedAt - leftCreatedAt;
    });
}
