import path from "node:path";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname),
      "server-only": path.resolve(import.meta.dirname, "tests/stubs/empty.ts"),
    },
  },
  test: {
    include: ["tests/integration/**/*.itest.ts"],
    environment: "node",
    globalSetup: ["tests/integration/global-setup.ts"],
    env: { SESSION_SECRET: "integration-test-secret" },
    // 같은 DB 를 쓰므로 파일끼리는 순서대로 돈다.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 120_000,
  },
});
