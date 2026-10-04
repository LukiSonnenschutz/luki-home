import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/cloud-e2e",
  outputDir: "./test-results-cloud",
  workers: 1,
  timeout: 45000,
  use: {
    baseURL: "http://127.0.0.1:3102",
    headless: true,
    trace: "retain-on-failure",
  },
  webServer: [
    {
      command: `"${process.execPath}" tests/fixtures/supabase-server.mjs`,
      url: "http://127.0.0.1:54329/health",
      reuseExistingServer: false,
      timeout: 60000,
    },
    {
      command: `"${process.execPath}" node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port 3102`,
      url: "http://127.0.0.1:3102/login",
      reuseExistingServer: false,
      timeout: 60000,
      env: {
        LUKI_STORAGE: "supabase",
        APP_ORIGIN: "http://127.0.0.1:3102",
        NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54329",
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "fixture-only-publishable-key",
        LUKI_ALLOWED_EMAIL: "owner@example.invalid",
        NEXT_TELEMETRY_DISABLED: "1",
      },
    },
  ],
});
