import { defineConfig, devices } from "@playwright/test";

// Never start the app against an ambient project database or .env credentials.
if (process.env.E2E_ISOLATED !== "true" || !process.env.E2E_TEMP_DB ||
    process.env.DATABASE_URL !== `file:${process.env.E2E_TEMP_DB}`) {
  throw new Error("Run E2E via node scripts/run-e2e-tests.cjs (isolated temporary database required)");
}

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 45_000,
  reporter: "list",
  use: { baseURL: "http://127.0.0.1:3101", trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "node node_modules/next/dist/bin/next dev -p 3101 -H 127.0.0.1",
    url: "http://127.0.0.1:3101/pesan",
    reuseExistingServer: false,
    stdout: "pipe",
    stderr: "pipe",
    timeout: 120_000,
    env: { ...process.env, DATABASE_URL: `file:${process.env.E2E_TEMP_DB}` },
  },
});
