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
import { createServer as createHttpServer } from "node:http";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";

import EmbeddedPostgres from "embedded-postgres";

const APP_PORT = process.env.E2E_PORT ?? "3200";
const STORAGE_PORT = process.env.E2E_STORAGE_PORT ?? "3201";
const BUCKET = "fitnote-photos";

/**
 * 가짜 Supabase Storage.
 *
 * 앱이 부르는 주소(lib/storage.ts)만 흉내 낸다. 올린 파일은 메모리에 두고,
 * 테스트가 GET /__objects 로 무엇이 남아 있는지 볼 수 있다.
 * 브라우저가 이 서버로 직접 PUT 하므로 CORS 를 열어 둔다.
 */
const objects = new Map();

function readBody(req) {
  return new Promise((resolve) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
  });
}

const storage = createHttpServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${STORAGE_PORT}`);
  const cors = {
    "access-control-allow-origin": "*",
    "access-control-allow-headers": "*",
    "access-control-allow-methods": "GET,PUT,POST,DELETE,OPTIONS",
  };
  const json = (status, body) => {
    res.writeHead(status, { ...cors, "content-type": "application/json" });
    res.end(JSON.stringify(body));
  };

  if (req.method === "OPTIONS") {
    res.writeHead(204, cors);
    return res.end();
  }

  const path = decodeURIComponent(url.pathname);
  const prefix = `/storage/v1`;

  if (path === "/__objects") return json(200, [...objects.keys()].sort());

  if (path === `${prefix}/bucket/${BUCKET}`) return json(200, { id: BUCKET });

  // 업로드 주소 만들기
  let m = path.match(new RegExp(`^${prefix}/object/upload/sign/${BUCKET}/(.+)$`));
  if (m && req.method === "POST") {
    return json(200, {
      url: `/object/upload/sign/${BUCKET}/${m[1]}?token=e2e`,
    });
  }

  // 올리기
  if (m && req.method === "PUT") {
    objects.set(m[1], await readBody(req));
    return json(200, { Key: `${BUCKET}/${m[1]}` });
  }

  // 읽기 주소 만들기
  if (path === `${prefix}/object/sign/${BUCKET}` && req.method === "POST") {
    const { paths = [] } = JSON.parse((await readBody(req)).toString() || "{}");
    return json(
      200,
      paths.map((p) =>
        objects.has(p)
          ? { path: p, signedURL: `/object/sign/${BUCKET}/${p}?token=e2e`, error: null }
          : { path: p, signedURL: null, error: "Object not found" },
      ),
    );
  }

  // 읽기
  m = path.match(new RegExp(`^${prefix}/object/sign/${BUCKET}/(.+)$`));
  if (m && req.method === "GET") {
    const body = objects.get(m[1]);
    if (!body) return json(404, { error: "not_found" });
    res.writeHead(200, { ...cors, "content-type": "image/webp" });
    return res.end(body);
  }

  // 지우기
  if (path === `${prefix}/object/${BUCKET}` && req.method === "DELETE") {
    const { prefixes = [] } = JSON.parse((await readBody(req)).toString() || "{}");
    for (const p of prefixes) objects.delete(p);
    return json(200, []);
  }

  return json(404, { error: `unhandled ${req.method} ${path}` });
});

await new Promise((resolve) => storage.listen(Number(STORAGE_PORT), resolve));

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
  SUPABASE_URL: `http://localhost:${STORAGE_PORT}`,
  SUPABASE_SERVICE_ROLE_KEY: "e2e-service-key",
  SUPABASE_PHOTO_BUCKET: BUCKET,
  NEXT_PUBLIC_FIREBASE_API_KEY: "",
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: "",
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: "",
  NEXT_PUBLIC_FIREBASE_APP_ID: "",
  NEXT_PUBLIC_FIREBASE_VAPID_KEY: "",
};

execFileSync("npx", ["prisma", "migrate", "deploy"], { env, stdio: "pipe" });
// 운동 라이브러리. 운동 기록 화면이 이 목록에서 고른다.
execFileSync("npx", ["prisma", "db", "seed"], { env, stdio: "pipe" });
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
  storage.close();
  await pg.stop().catch(() => {});
  rmSync(dir, { recursive: true, force: true });
  process.exit(code);
}

process.on("SIGINT", () => stop());
process.on("SIGTERM", () => stop());
app.on("exit", (code) => stop(code ?? 0));
