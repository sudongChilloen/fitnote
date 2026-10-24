import { defineConfig, devices } from "@playwright/test";

const PORT = process.env.E2E_PORT ?? "3200";

export default defineConfig({
  testDir: "./e2e",
  // 한 DB 를 같이 쓰고 테스트가 서로 이어지는 흐름이라 순서대로 돈다.
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    // 로컬에서는 설치된 Chrome 을 쓸 수 있다: E2E_CHANNEL=chrome npm run test:e2e
    channel: process.env.E2E_CHANNEL || undefined,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], channel: process.env.E2E_CHANNEL || undefined } }],
  webServer: {
    command: "node e2e/server.mjs",
    url: `http://localhost:${PORT}/login`,
    // 빌드까지 하므로 넉넉히 둔다.
    timeout: 300_000,
    reuseExistingServer: false,
    stdout: "pipe",
  },
});
