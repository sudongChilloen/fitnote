import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";

import EmbeddedPostgres from "embedded-postgres";

/**
 * 통합 테스트용 Postgres.
 *
 * 운영 DB 에는 절대 접속하지 않는다. 임시 폴더에 진짜 Postgres 를 띄우고 마이그레이션을
 * 처음부터 적용하므로, 마이그레이션 이력이 빈 DB 에서 재생되는지도 함께 검증된다.
 * 행 잠금(FOR UPDATE)과 동시성은 진짜 Postgres 에서만 의미가 있어서 PGlite 같은
 * 단일 연결 대체품은 쓰지 않는다.
 */

function freePort() {
  return new Promise<number>((resolve, reject) => {
    const server = createServer();
    server.listen(0, () => {
      const { port } = server.address() as { port: number };
      server.close(() => resolve(port));
    });
    server.on("error", reject);
  });
}

export default async function setup() {
  const dir = mkdtempSync(path.join(tmpdir(), "fitnote-pg-"));
  const port = await freePort();

  const pg = new EmbeddedPostgres({
    databaseDir: path.join(dir, "data"),
    user: "test",
    password: "test",
    port,
    persistent: false,
    // Postgres 의 정상 로그가 테스트 출력을 덮지 않게 한다. 오류는 그대로 보인다.
    onLog: () => {},
  });

  await pg.initialise();
  await pg.start();
  await pg.createDatabase("fitnote_test");

  const url = `postgresql://test:test@localhost:${port}/fitnote_test`;

  execFileSync("npx", ["prisma", "migrate", "deploy"], {
    env: { ...process.env, DIRECT_URL: url },
    stdio: "pipe",
  });

  process.env.DATABASE_URL = url;

  return async () => {
    await pg.stop();
    rmSync(dir, { recursive: true, force: true });
  };
}
