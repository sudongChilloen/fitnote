import { describe, expect, it } from "vitest";

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
      await addRecord(other.userId, sessionId, { exerciseId: other.exerciseId }),
    ).toBeNull();
  });
});
