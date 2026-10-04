import { defineConfig } from "@playwright/test";
import { resolve } from "node:path";
const database = resolve(`test-results/e2e-${Date.now()}.sqlite`);
export default defineConfig({
  testDir: "./tests/e2e",
  workers: 1,
  timeout: 45_000,
  use: {
    baseURL: "http://127.0.0.1:3101",
    headless: true,
    trace: "retain-on-failure",
  },
  webServer: {
    command: `"${process.execPath}" node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port 3101`,
    url: "http://127.0.0.1:3101/login",
    reuseExistingServer: false,
    env: {
      LUKI_DB_PATH: database,
      LUKI_STORAGE: "local",
      NEXT_TELEMETRY_DISABLED: "1",
    },
    timeout: 60_000,
  },
});
