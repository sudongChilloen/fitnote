import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { prisma } from "@/lib/prisma";
import {
  addRecord,
  addSet,
  deleteSet,
  finishSession,
  getActiveSession,
  getSessionById,
  getSessionSummary,
  startSession,
} from "@/server/workouts/workout.service";

import { uniq } from "./helpers";

/**
 * 이 파일의 모든 테스트가 도는 동안 pg 경고를 모은다.
 *
 * pg 가 "이미 쿼리를 실행 중인 연결에 query() 를 불렀다" 고 경고하면 pg 9 에서는
 * 오류가 된다. 같은 경고는 프로세스에서 한 번만 뜨므로 테스트마다 따로 보면 앞선
 * 테스트가 가져가 버린다. 파일 전체에 걸어 두고 끝에서 한 번에 본다.
 */
const pgWarnings: string[] = [];
const collectWarning = (warning: Error) => {
  if (warning.message.includes("client.query()")) {
    pgWarnings.push(warning.message);
  }
};

beforeAll(() => {
  process.on("warning", collectWarning);
});

afterAll(async () => {
  // 경고는 비동기로 뜬다.
  await new Promise((resolve) => setTimeout(resolve, 200));
  process.off("warning", collectWarning);

  expect(pgWarnings).toEqual([]);
});

async function setup() {
  const user = await prisma.user.create({
    data: {
      name: `회원${uniq()}`,
      email: `w-${uniq()}@test.com`,
      passwordHash: "x",
      memberProfile: { create: {} },
    },
    select: { id: true },
  });

  const exercise = await prisma.exercise.create({
    data: {
      name: `벤치프레스-${uniq()}`,
      bodyPart: "CHEST",
      movementType: "PUSH",
      difficulty: "BEGINNER",
    },
    select: { id: true },
  });

  return { userId: user.id, exerciseId: exercise.id };
}

/**
 * 서비스를 파일로 나눈 뒤에도 운동 한 바퀴가 이어지는지 보는 스모크 테스트.
 * 시작 → 운동 담기 → 세트 기록 → 볼륨 계산 → 종료 → 요약.
 */
describe("운동 기록 한 바퀴", () => {
  it("시작부터 요약까지 이어지고 볼륨이 맞는다", async () => {
    const { userId, exerciseId } = await setup();

    const started = await startSession(userId, { mode: "new" });
    const sessionId = started.session!.id;

    expect((await getActiveSession(userId))?.id).toBe(sessionId);

    const record = await addRecord(userId, sessionId, { exerciseId });
    expect(record).not.toBeNull();

    const recordId = record!.record.id;

    await addSet(userId, recordId, { weight: 60, reps: 10, completed: true });
    await addSet(userId, recordId, { weight: 70, reps: 5, completed: true });

    const session = await getSessionById(userId, sessionId);
    expect(session?.totalVolume).toBe(60 * 10 + 70 * 5);

    await finishSession(userId, sessionId);
    expect(await getActiveSession(userId)).toBeNull();

    const summary = await getSessionSummary(userId, sessionId);
    expect(summary).not.toBeNull();
  });

  it("세트를 지우면 볼륨이 다시 계산된다", async () => {
    const { userId, exerciseId } = await setup();

    const started = await startSession(userId, { mode: "new" });
    const sessionId = started.session!.id;
    const record = await addRecord(userId, sessionId, { exerciseId });
    const recordId = record!.record.id;

    await addSet(userId, recordId, { weight: 50, reps: 10, completed: true });
    await addSet(userId, recordId, { weight: 100, reps: 10, completed: true });

    const set = await prisma.workoutSet.findFirstOrThrow({
      where: { recordId, weight: 100 },
      select: { id: true },
    });

    await deleteSet(userId, set.id);

    expect((await getSessionById(userId, sessionId))?.totalVolume).toBe(500);
  });

  it("남의 세션에는 접근할 수 없다", async () => {
    const mine = await setup();
    const other = await setup();

    const started = await startSession(mine.userId, { mode: "new" });
    const sessionId = started.session!.id;

    expect(await getSessionById(other.userId, sessionId)).toBeNull();
    expect(
      await addRecord(other.userId, sessionId, {
        exerciseId: other.exerciseId,
      }),
    ).toBeNull();
  });
});
