/**
 * E2E 테스트용 서버.
 *
 * 임시 Postgres 를 띄워 마이그레이션을 적용하고, 그 DB 를 바라보는 앱을 빌드해서
 * 띄운다. 운영 DB 에는 접속하지 않는다. 종료 신호를 받으면 앱과 DB 를 함께 내린다.
 *
 * Playwright 는 webServer 를 globalSetup 보다 먼저 띄운다. 그래서 DB 준비를 여기서 한다.
 */
import { execFileSync, spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";

import EmbeddedPostgres from "embedded-postgres";

const APP_PORT = process.env.E2E_PORT ?? "3200";

function freePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.listen(0, () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
    server.on("error", reject);
  });
}

const dir = mkdtempSync(path.join(tmpdir(), "fitnote-e2e-"));
const port = await freePort();

const pg = new EmbeddedPostgres({
  databaseDir: path.join(dir, "data"),
  user: "test",
  password: "test",
  port,
  persistent: false,
  onLog: () => {},
});

await pg.initialise();
await pg.start();
await pg.createDatabase("fitnote_e2e");

const url = `postgresql://test:test@localhost:${port}/fitnote_e2e`;

// .env 에 진짜 값이 있어도 이 서버는 쓰지 않는다. 빈 값으로 덮어 푸시를 끈다.
const env = {
  ...process.env,
  DATABASE_URL: url,
  DIRECT_URL: url,
  SESSION_SECRET: "e2e-only-secret-not-used-anywhere-else",
  FCM_PROJECT_ID: "",
  FCM_CLIENT_EMAIL: "",
  FCM_PRIVATE_KEY: "",
  CRON_SECRET: "",
  NEXT_PUBLIC_FIREBASE_API_KEY: "",
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: "",
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: "",
  NEXT_PUBLIC_FIREBASE_APP_ID: "",
  NEXT_PUBLIC_FIREBASE_VAPID_KEY: "",
};

execFileSync("npx", ["prisma", "migrate", "deploy"], { env, stdio: "pipe" });
execFileSync("npx", ["next", "build"], { env, stdio: "inherit" });

const app = spawn("npx", ["next", "start", "-p", APP_PORT], {
  env,
  stdio: "inherit",
});

let stopping = false;

async function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  app.kill("SIGTERM");
  await pg.stop().catch(() => {});
  rmSync(dir, { recursive: true, force: true });
  process.exit(code);
}

process.on("SIGINT", () => stop());
process.on("SIGTERM", () => stop());
app.on("exit", (code) => stop(code ?? 0));
