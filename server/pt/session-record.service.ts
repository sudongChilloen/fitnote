import "server-only";

import {
  JournalStatus,
  PTSessionStatus,
  WorkoutEntryMode,
  WorkoutSessionStatus,
} from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { requireTrainerProfile } from "@/server/trainers/trainer.service";
import { addRecords, getSessionById } from "@/server/workouts/workout.service";

import { PTError } from "./pt.service";

/**
 * 수업 중에 쓰는 화면의 뒷단.
 *
 * 트레이너가 수업하면서 하려는 일은 하나다 — 방금 든 무게를 적는 것. 글은
 * 수업이 끝나고 쓴다. 그래서 "수업 중 기록" 과 "수업 후 기록" 을 갈라 놓고,
 * 이 파일은 앞쪽만 맡는다.
 *
 * 앞서는 운동 기록을 알림장을 통해 열었다. 그러면 무게만 적으려 해도 알림장
 * 초안이 먼저 생긴다. 안 쓰고 나가면 빈 초안이 "쓰는 중" 으로 할 일에 남고,
 * 초안을 지우면 운동 기록까지 딸려 나간다. 운동과 글은 서로 붙잡을 이유가
 * 없는 사이다.
 *
 * 그래서 운동 기록을 `PTSession` 에 직접 맨다. `WorkoutSession.ptSessionId` 가
 * 이미 unique 라 스키마는 그대로다. 바뀐 건 누구를 거쳐 여느냐뿐이다.
 *
 *   PTSession ─┬─ WorkoutSession ─ WorkoutRecord ─ WorkoutSet
 *              └─ Journal
 *
 * 기록의 주인은 언제나 회원이다(`WorkoutSession.userId`). 트레이너는
 * `recordedByUserId` 에만 남는다. 그래야 회원의 캘린더 · 그래프 · 최고 중량에
 * 그대로 합류한다.
 */

const recordSelect = {
  id: true,
  scheduledAt: true,
  durationMinutes: true,
  status: true,
  sessionNumber: true,
  memberUserId: true,
  memberUser: { select: { name: true } },
  contractId: true,
  contract: {
    select: {
      id: true,
      totalSessions: true,
      usedSessions: true,
      title: true,
    },
  },
  workoutSession: { select: { id: true } },
  journals: {
    orderBy: { createdAt: "desc" },
    take: 1,
    select: { id: true, status: true },
  },
} as const;

/**
 * 내 수업인가.
 *
 * 연결이 끊긴 회원의 지난 수업도 열려야 한다. 회원이 떠났다고 해서 그날 무엇을
 * 시켰는지가 사라지면 안 된다. 다만 쓰기는 `assertWritable` 이 따로 막는다.
 */
async function requireMySession(userId: string, ptSessionId: string) {
  const trainer = await requireTrainerProfile(userId);

  const session = await prisma.pTSession.findFirst({
    where: { id: ptSessionId, trainerProfileId: trainer.id },
    select: recordSelect,
  });

  if (!session) {
    throw new PTError("NOT_FOUND", "수업을 찾을 수 없어요.");
  }

  return { trainer, session };
}

export interface SessionRecordView {
  id: string;
  scheduledAt: Date;
  durationMinutes: number;
  status: PTSessionStatus;
  sessionNumber: number;
  memberUserId: string;
  memberName: string;
  /** 트레이너 화면의 회원 식별자. 연결이 끊겼으면 null 이라 링크를 걸지 않는다. */
  connectionId: string | null;
  contractId: string;
  contractTitle: string | null;
  totalSessions: number;
  usedSessions: number;
  /** 이 수업에 붙은 알림장. 아직 없으면 null. */
  journalId: string | null;
  journalStatus: JournalStatus | null;
  /** 운동 기록 세션 id. 아직 안 열었으면 null. */
  workoutSessionId: string | null;
}

/** 수업 기록 화면이 필요한 것 전부. */
export async function getSessionRecord(
  userId: string,
  ptSessionId: string,
): Promise<SessionRecordView> {
  const { trainer, session } = await requireMySession(userId, ptSessionId);

  const connection = await prisma.trainerMemberConnection.findFirst({
    where: {
      trainerProfileId: trainer.id,
      memberUserId: session.memberUserId,
      status: "ACTIVE",
    },
    select: { id: true },
  });

  const journal = session.journals[0] ?? null;

  return {
    id: session.id,
    scheduledAt: session.scheduledAt,
    durationMinutes: session.durationMinutes,
    status: session.status,
    sessionNumber: session.sessionNumber,
    memberUserId: session.memberUserId,
    memberName: session.memberUser.name,
    connectionId: connection?.id ?? null,
    contractId: session.contractId,
    contractTitle: session.contract.title,
    totalSessions: session.contract.totalSessions,
    usedSessions: session.contract.usedSessions,
    journalId: journal?.id ?? null,
    journalStatus: journal?.status ?? null,
    workoutSessionId: session.workoutSession?.id ?? null,
  };
}

/**
 * 취소한 수업에는 운동을 적지 않는다.
 *
 * 노쇼는 막지 않는다. 회원이 늦게라도 와서 절반만 했는데 트레이너가 노쇼로
 * 눌러 둔 경우가 있고, 그때 적을 길이 없으면 상태를 되돌리러 가야 한다.
 */
function assertWritable(session: { status: PTSessionStatus }) {
  if (session.status === PTSessionStatus.CANCELLED) {
    throw new PTError("INVALID", "취소한 수업에는 운동을 적을 수 없어요.");
  }
}

/**
 * 운동 기록을 연다. 이미 있으면 그걸 준다.
 *
 * 처음부터 COMPLETED 로 만든다. 회원이 지금 하고 있는 운동이 아니라 트레이너가
 * 눈앞에서 본 것을 옮겨 적는 것이라 "진행 중" 인 순간이 없다. 진행 중으로 두면
 * 회원의 기록 목록에 끝나지 않은 운동이 하나 걸려 있게 된다.
 *
 * 시간은 수업 시간을 그대로 쓴다. 회원이 직접 몰아서 적을 때는 소요 시간을
 * 비워 두지만, 여기서는 수업이 몇 분짜리였는지 우리가 이미 알고 있다.
 */
export async function openSessionWorkout(userId: string, ptSessionId: string) {
  const { trainer, session } = await requireMySession(userId, ptSessionId);

  assertWritable(session);

  if (session.workoutSession) {
    return session.workoutSession.id;
  }

  const durationSec = session.durationMinutes * 60;

  const created = await prisma.workoutSession.create({
    data: {
      userId: session.memberUserId,
      ptSessionId: session.id,
      recordedByUserId: trainer.userId,
      startedAt: session.scheduledAt,
      endedAt: new Date(session.scheduledAt.getTime() + durationSec * 1000),
      durationSec,
      entryMode: WorkoutEntryMode.MANUAL,
      status: WorkoutSessionStatus.COMPLETED,
    },
    select: { id: true },
  });

  return created.id;
}

/** 화면에 뿌릴 운동 기록. 아직 안 열었으면 null. */
export async function getSessionWorkout(userId: string, ptSessionId: string) {
  const { session } = await requireMySession(userId, ptSessionId);

  if (!session.workoutSession) return null;

  return getSessionById(userId, session.workoutSession.id);
}

/**
 * 운동 기록을 통째로 지운다.
 *
 * 수업을 잘못 골라 들어갔을 때 되돌릴 길이 필요하다. 다만 회원이 이미 본 것을
 * 소리 없이 없애면 안 되므로, 알림장을 게시한 수업의 기록은 지키고 세트를
 * 하나씩 고치는 것만 남긴다.
 */
export async function deleteSessionWorkout(
  userId: string,
  ptSessionId: string,
) {
  const { session } = await requireMySession(userId, ptSessionId);

  assertWritable(session);

  if (session.journals[0]?.status === JournalStatus.PUBLISHED) {
    throw new PTError(
      "INVALID",
      "알림장을 게시한 수업이라 운동 기록을 통째로 지울 수 없어요. 세트는 고칠 수 있어요.",
    );
  }

  if (!session.workoutSession) return false;

  await prisma.workoutSession.delete({
    where: { id: session.workoutSession.id },
  });

  return true;
}

// ---------------------------------------------------------------------------
// 수업 전 브리핑
// ---------------------------------------------------------------------------

export interface BriefingRecord {
  exerciseId: string;
  name: string;
  bodyPart: string;
  /** "60kg × 10 · 3세트" 로 쓸 재료. 세트가 없으면 null. */
  topWeight: number | null;
  topReps: number | null;
  setCount: number;
}

export interface SessionBriefing {
  performedAt: Date;
  sessionNumber: number | null;
  daysAgo: number;
  records: BriefingRecord[];
}

/**
 * 지난번에 뭘 했는지.
 *
 * 회원이 문을 열고 들어오는 순간 트레이너가 떠올려야 하는 건 하나다 —
 * "지난주에 뭐 했지." 오늘 어느 부위를 할지도, 몇 kg부터 시작할지도 거기서
 * 나온다. 지금은 그걸 회원 상세로 나갔다가 다시 들어와서 확인해야 한다.
 *
 * 그래서 수업 기록 화면 맨 위에 붙인다. 따로 펼치는 화면을 만들지 않는다 —
 * 이건 수업을 시작하기 직전에만 필요한 정보고, 그 시점에 트레이너가 이미
 * 와 있는 화면이 여기다.
 *
 * 이번 수업은 뺀다. 방금 적은 걸 "지난번" 이라고 보여주면 안 된다.
 * 취소한 수업도 뺀다. 안 한 수업이다.
 *
 * 세트가 하나도 없는 수업도 건너뛴다. 무게를 안 적은 수업은 "지난번에 몇
 * kg" 의 답이 되지 못한다.
 *
 * 개인 운동은 여기 안 섞는다. 브리핑은 "지난 수업" 이지 "최근 운동" 이
 * 아니다. 둘을 섞으면 회원이 혼자 한 걸 내가 시킨 걸로 착각하고 무게를
 * 올리게 된다.
 */
export async function getSessionBriefing(
  userId: string,
  ptSessionId: string,
): Promise<SessionBriefing | null> {
  const { trainer, session } = await requireMySession(userId, ptSessionId);

  const previous = await prisma.pTSession.findFirst({
    where: {
      memberUserId: session.memberUserId,
      trainerProfileId: trainer.id,
      id: { not: session.id },
      scheduledAt: { lt: session.scheduledAt },
      status: { not: PTSessionStatus.CANCELLED },
      /*
        세트가 하나도 없는 수업은 건너뛴다.

        운동 이름만 담아 두고 무게를 안 적은 수업이 있다. 그걸 브리핑으로
        띄우면 "0세트" 만 줄줄이 나열되고, 정작 알고 싶은 "지난번에 몇 kg" 은
        그 뒤에 묻힌 수업에 있다. 브리핑은 최근 순서가 아니라 답이 있는
        쪽을 골라야 한다.
      */
      workoutSession: { records: { some: { sets: { some: {} } } } },
    },
    orderBy: { scheduledAt: "desc" },
    select: {
      scheduledAt: true,
      sessionNumber: true,
      workoutSession: {
        select: {
          records: {
            orderBy: { orderIndex: "asc" },
            select: {
              exerciseId: true,
              exercise: { select: { name: true, bodyPart: true } },
              sets: {
                orderBy: { setNumber: "asc" },
                select: { weight: true, reps: true },
              },
            },
          },
        },
      },
    },
  });

  if (!previous?.workoutSession) return null;

  const records = previous.workoutSession.records.map((record) => {
    /*
      대표 세트는 가장 무거웠던 것으로 고른다.

      평균은 워밍업 세트에 끌려 내려가서 "지난주에 얼마 들었지" 의 답이 되지
      못한다. 첫 세트도 마찬가지다. 오늘 얼마부터 시작할지를 정하는 기준은
      지난번에 닿은 가장 높은 지점이다.
    */
    let topWeight: number | null = null;
    let topReps: number | null = null;

    for (const set of record.sets) {
      if (set.weight === null) continue;
      const weight = Number(set.weight);
      if (topWeight === null || weight > topWeight) {
        topWeight = weight;
        topReps = set.reps;
      }
    }

    return {
      exerciseId: record.exerciseId,
      name: record.exercise.name,
      bodyPart: record.exercise.bodyPart,
      topWeight,
      topReps,
      setCount: record.sets.length,
    };
  });

  const daysAgo = Math.max(
    0,
    Math.floor(
      (session.scheduledAt.getTime() - previous.scheduledAt.getTime()) /
        86_400_000,
    ),
  );

  return {
    performedAt: previous.scheduledAt,
    sessionNumber: previous.sessionNumber,
    daysAgo,
    records,
  };
}

/**
 * 지난 수업에 한 운동을 그대로 담는다. 세트는 담지 않는다.
 *
 * 세트까지 넣지 않는 게 중요하다. 같은 부위를 하더라도 종목은 바꾸고,
 * 무게는 오늘 컨디션에 따라 달라진다. 다섯 종목 × 세 세트를 통째로 넣어
 * 두면 열다섯 줄이 전부 "했다" 고 주장하는 상태로 시작하고, 그중 몇 줄은
 * 결국 안 한 채로 회원 기록에 남는다.
 *
 * 운동만 담으면 세트가 0이라 아직 아무 주장도 하지 않는다. 무게는 각
 * 카드에서 "지난 기록 그대로 담기" 로 하나씩 확인하며 넣으면 된다.
 *
 * 이미 담은 운동은 건너뛴다. `addRecords` 는 같은 운동을 두 번 담는 걸
 * 막지 않는데(한 수업에서 스쿼트를 앞뒤로 두 번 하는 일이 있다), 여기서는
 * 그게 아니라 실수다. 화면이 느려서 두 번 눌렀을 뿐인데 운동이 네 개로
 * 늘어나면 지우는 데 더 오래 걸린다.
 */
export async function copyPreviousExercises(
  userId: string,
  ptSessionId: string,
) {
  const briefing = await getSessionBriefing(userId, ptSessionId);

  if (!briefing || briefing.records.length === 0) return null;

  const workoutId = await openSessionWorkout(userId, ptSessionId);

  if (!workoutId) return null;

  const already = new Set(
    (
      await prisma.workoutRecord.findMany({
        where: { sessionId: workoutId },
        select: { exerciseId: true },
      })
    ).map((record) => record.exerciseId),
  );

  const missing = briefing.records
    .map((record) => record.exerciseId)
    .filter((exerciseId) => !already.has(exerciseId));

  if (missing.length === 0) return null;

  return addRecords(userId, workoutId, missing);
}
