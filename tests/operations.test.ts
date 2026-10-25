import test from "node:test";
import assert from "node:assert/strict";
import { validateEnvironment } from "../lib/environment";
import { securityHeaders } from "../next.config";
import { spawnSync } from "node:child_process";

test("admin tooling rejects invalid raw usernames before touching DB and never echoes malformed secrets", () => {
  for (const username of [" Admin ", "ADMIN", 123, null, "ab"]) {
    const result = spawnSync(process.execPath, ["scripts/set-admin-login.cjs"], { input: JSON.stringify({ username, password: "private-password-marker" }), encoding: "utf8" });
    assert.equal(result.status, 1);
    assert.ok(result.stderr.includes("Username"));
    assert.equal(result.stderr.includes("private-password-marker"), false);
  }
  const invalid = spawnSync(process.execPath, ["scripts/set-admin-login.cjs"], { input: '{"password":"private-password-marker"', encoding: "utf8" });
  assert.equal(invalid.status, 1);
  assert.equal(invalid.stderr.includes("private-password-marker"), false);
});

const base = { DATABASE_URL: "file:./test.db", ADMIN_SESSION_SECRET: "x".repeat(32), APP_URL: "https://example.com", MIDTRANS_SERVER_KEY: "test", NEXT_PUBLIC_MIDTRANS_CLIENT_KEY: "test" };
test("env diagnostics contain only field names; production requires HTTPS", () => {
  assert.deepEqual(validateEnvironment(base, true), []);
  const errors = validateEnvironment({ ...base, APP_URL: "http://example.com", ADMIN_SESSION_SECRET: "secret" }, true);
  assert.ok(errors.some(e => e.includes("HTTPS")));
  assert.ok(errors.some(e => e.includes("ADMIN_SESSION_SECRET")));
  assert.equal(errors.join(" ").includes("secret"), false);
});
test("CSP permits Leaflet tiles and hosted Midtrans sources without claiming inline safety", () => {
  const headers = securityHeaders(true);
  const csp = headers.find(h => h.key === "Content-Security-Policy")?.value || "";
  for (const part of ["frame-ancestors 'none'", "https://*.tile.openstreetmap.org", "https://app.sandbox.midtrans.com", "https://app.midtrans.com", "'unsafe-inline'"]) assert.ok(csp.includes(part));
  assert.equal(csp.includes("'unsafe-eval'"), false);
  assert.ok(headers.some(h => h.key === "Referrer-Policy" && h.value === "no-referrer"));
  assert.equal(securityHeaders(false).some(h => h.key === "Strict-Transport-Security"), false);
});
