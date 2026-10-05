import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const repositoryRoot = resolve(import.meta.dirname, "../..");

test("local secrets and generated artifacts are not tracked", () => {
  const trackedPaths = execFileSync("git", ["ls-files", "-z"], {
    cwd: repositoryRoot,
    encoding: "utf8",
  }).split("\0").filter(Boolean);
  const prohibitedTrackedPaths = trackedPaths.filter(path =>
    existsSync(resolve(repositoryRoot, path)) && (
      path === ".env" ||
      path.startsWith(".idea/") ||
      path.startsWith(".expo-export-") ||
      path === "emulator-current.png" ||
      path === "gradle-build.log" ||
      path === "metro-debug.log" ||
      path === "log"
    ),
  );

  assert.deepEqual(prohibitedTrackedPaths, []);
});

test("the environment template contains placeholders only", () => {
  const template = readFileSync(resolve(repositoryRoot, ".env.example"), "utf8");

  assert.match(template, /^EXPO_PUBLIC_FIREBASE_API_KEY=your-firebase-api-key$/m);
  assert.match(template, /^GOOGLE_MAPS_ANDROID_API_KEY=your-android-google-maps-api-key$/m);
  assert.match(template, /^GOOGLE_MAPS_IOS_API_KEY=your-ios-google-maps-api-key$/m);
  assert.doesNotMatch(template, /^SENTRY_AUTH_TOKEN=.+$/m);
  assert.doesNotMatch(template, /AIza[0-9A-Za-z_-]{35}/);
  assert.doesNotMatch(template, /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/);
});

test("ignore rules protect local configuration and generated artifacts", () => {
  const ignoreRules = readFileSync(resolve(repositoryRoot, ".gitignore"), "utf8");

  for (const rule of [
    ".env*",
    "!.env.example",
    "/.idea/",
    "/.expo-export-*/",
    "*.log",
    "/log",
    "/emulator-*.png",
  ]) {
    assert.equal(
      ignoreRules.split(/\r?\n/).includes(rule),
      true,
      `.gitignore must contain ${rule}`,
    );
  }
});
