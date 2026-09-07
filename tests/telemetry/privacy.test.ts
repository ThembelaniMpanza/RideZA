import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeRouteTemplate,
  redactTelemetryText,
  redactTelemetryValue,
  sanitizeTelemetryProperties,
} from "../../src/telemetry/privacy";

test("redacts tokens, email addresses, phone numbers, and coordinates", () => {
  const value = redactTelemetryText(
    "Bearer secret-token rider@example.com +27821234567 -26.20410,28.04730 eyJaaa.bbb.ccc",
  );
  assert.equal(value.includes("secret-token"), false);
  assert.equal(value.includes("rider@example.com"), false);
  assert.equal(value.includes("+27821234567"), false);
  assert.equal(value.includes("-26.20410"), false);
  assert.equal(value.includes("eyJaaa.bbb.ccc"), false);
});

test("only permits the approved analytics property vocabulary", () => {
  assert.deepEqual(
    sanitizeTelemetryProperties({
      outcome: "success",
      ride_class: "standard",
      email: "rider@example.com",
      latitude: -26.2041,
      message: "call me",
    }),
    { outcome: "success", ride_class: "standard" },
  );
});

test("deep redaction filters sensitive object keys", () => {
  const value = redactTelemetryValue({
    authorization: "Bearer abc",
    nested: { destination: "home", status: "ok" },
  }) as Record<string, unknown>;
  assert.equal(value.authorization, "[Filtered]");
  assert.deepEqual(value.nested, { destination: "[Filtered]", status: "ok" });
});

test("normalizes resource identifiers and removes query strings", () => {
  assert.equal(
    normalizeRouteTemplate("/api/trips/7f20e35a-e51b-4ff7-8114-9f067ca5526c/state?token=secret"),
    "/api/trips/:id/state",
  );
});
