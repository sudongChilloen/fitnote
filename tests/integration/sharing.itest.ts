import { describe, expect, it } from "vitest";

import { prisma } from "@/lib/prisma";
import { createContract, scheduleSession } from "@/server/pt/pt.service";
import { openSessionWorkout } from "@/server/pt/session-record.service";
import {
  addRecord,
  addSet,
  copyPreviousSets,
  startSession,
} from "@/server/workouts/workout.service";

import { makePendingMember, makeTrainer, uniq } from "./helpers";

/**
 * 회원이 혼자 한 운동은 공유를 켜기 전에는 트레이너에게 새면 안 된다.
 *
 * ptOnly 는 서버 액션 인자라 클라이언트가 마음대로 보낼 수 있다. 막는 일은 화면이 넘겨 준
 * 값이 아니라 서비스가 회원의 공유 설정을 직접 보고 해야 한다.
 */
async function setup() {
  const trainer = await makeTrainer();
  const member = await makePendingMember(trainer.userId);

  const exercise = await prisma.exercise.create({
    data: {
      name: `데드리프트-${uniq()}`,
      bodyPart: "BACK",
      movementType: "HINGE",
      difficulty: "BEGINNER",
    },
    select: { id: true },
  });

  // 회원이 혼자 한 운동: 100kg × 5회
  const personal = await startSession(member.memberUserId, { mode: "new" });
  const personalRecord = await addRecord(
    member.memberUserId,
    personal.session!.id,
    { exerciseId: exercise.id },
  );
  await addSet(member.memberUserId, personalRecord!.record.id, {
    weight: 100,
    reps: 5,
    completed: true,
  });

  // 트레이너가 연 PT 수업의 빈 기록
  const contract = await createContract(trainer.userId, {
    connectionId: member.connectionId,
    totalSessions: 5,
    startedAt: new Date(),
  });
  const pt = await scheduleSession(trainer.userId, {
    contractId: contract.id,
    scheduledAt: new Date(Date.now() - 3_600_000),
  });
  const workoutId = await openSessionWorkout(trainer.userId, pt.id);
  const ptRecord = await addRecord(trainer.userId, workoutId, {
    exerciseId: exercise.id,
  });

  return { trainer, member, recordId: ptRecord!.record.id };
}

describe("지난 기록 담기와 개인 운동 공유", () => {
  it("공유를 끈 회원의 개인 운동 값은 클라이언트가 ptOnly=false 를 보내도 담기지 않는다", async () => {
    const { trainer, recordId } = await setup();

    const result = await copyPreviousSets(trainer.userId, recordId, {
      ptOnly: false,
    });

    expect(result).toBeNull();

    expect(await prisma.workoutSet.count({ where: { recordId } })).toBe(0);
  });

  it("옵션을 아예 안 보내도 담기지 않는다", async () => {
    const { trainer, recordId } = await setup();

    expect(await copyPreviousSets(trainer.userId, recordId)).toBeNull();
  });

  it("회원이 공유를 켜면 개인 운동 값을 담을 수 있다", async () => {
    const { trainer, member, recordId } = await setup();

    await prisma.trainerSharingSetting.upsert({
      where: { userId: member.memberUserId },
      create: { userId: member.memberUserId, sharePersonalWorkout: true },
      update: { sharePersonalWorkout: true },
    });

    const result = await copyPreviousSets(trainer.userId, recordId, {
      ptOnly: false,
    });

    expect(result?.sets).toHaveLength(1);
    expect(result?.sets[0]).toMatchObject({ weight: 100, reps: 5 });
  });
});
