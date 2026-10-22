import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { WorkoutSessionStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import {
  WorkoutError,
  toNumber,
  recordInclude,
  toSetDto,
  toRecordDto,
  serializableTransaction,
  lockWorkoutMutation,
  resolveOwner,
  assertWritable,
  assertEditable,
} from "./workout-shared";

/** 볼륨 = 중량 × 횟수. 완료한 세트만 합산한다. */
function calculateVolume(
  sets: {
    weight: Prisma.Decimal | null;
    reps: number | null;
    completed: boolean;
  }[],
) {
  return sets.reduce((sum, set) => {
    if (!set.completed || set.weight === null || set.reps === null) {
      return sum;
    }
    return sum + Number(set.weight) * set.reps;
  }, 0);
}

/**
 * 세트가 바뀌면 상위 기록의 totalVolume 을 다시 계산한다.
 * 세트 변경과 같은 트랜잭션에서 돌아야 통계가 어긋나지 않는다.
 */
async function recalculateVolume(
  tx: Prisma.TransactionClient,
  recordId: string,
) {
  const sets = await tx.workoutSet.findMany({
    where: { recordId },
    select: { weight: true, reps: true, completed: true },
  });

  await tx.workoutRecord.update({
    where: { id: recordId },
    data: { totalVolume: new Prisma.Decimal(calculateVolume(sets)) },
  });
}

/** 기록에서 출발할 때. 세션을 거쳐 같은 판단을 한다. */
async function resolveOwnerByRecord(actorUserId: string, recordId: string) {
  const record = await prisma.workoutRecord.findUnique({
    where: { id: recordId },
    select: { sessionId: true },
  });

  if (!record) return null;

  return resolveOwner(actorUserId, record.sessionId);
}

/** 세트에서 출발할 때. */
async function resolveOwnerBySet(actorUserId: string, setId: string) {
  const set = await prisma.workoutSet.findUnique({
    where: { id: setId },
    select: { recordId: true, record: { select: { sessionId: true } } },
  });

  if (!set) return null;

  const owner = await resolveOwner(actorUserId, set.record.sessionId);

  return owner === null ? null : { ...owner, recordId: set.recordId };
}

async function loadRecord(tx: Prisma.TransactionClient, recordId: string) {
  const record = await tx.workoutRecord.findUniqueOrThrow({
    where: { id: recordId },
    include: recordInclude,
  });

  return toRecordDto(record);
}

// ---------------------------------------------------------------------------
// 세션
// ---------------------------------------------------------------------------

/**
 * 해당 운동의 직전 기록.
 * WorkoutRecord.userId 비정규화 덕분에
 * [userId, exerciseId, createdAt DESC] 인덱스로 바로 찾는다.
 */
export async function getLastRecord(
  userId: string,
  exerciseId: string,
  excludeSessionId?: string,
  options: { ptOnly?: boolean; trainerProfileId?: string } = {},
) {
  const record = await prisma.workoutRecord.findFirst({
    where: {
      userId,
      exerciseId,
      ...(excludeSessionId ? { sessionId: { not: excludeSessionId } } : {}),
      /*
        트레이너가 볼 때는 PT 수업 기록만 참고하게 한다.

        trainerProfileId가 있으면 "아무 트레이너의 PT 기록"이 아니라
        현재 담당 트레이너가 진행한 PT 기록만 참고한다.
      */
      ...(options.ptOnly
        ? {
            session: {
              status: { not: WorkoutSessionStatus.CANCELLED },
              ptSession: {
                is: {
                  ...(options.trainerProfileId
                    ? { trainerProfileId: options.trainerProfileId }
                    : {}),
                },
              },
            },
          }
        : options.trainerProfileId
          ? {
              session: {
                status: { not: WorkoutSessionStatus.CANCELLED },
                OR: [
                  { ptSessionId: null },
                  {
                    ptSession: {
                      is: { trainerProfileId: options.trainerProfileId },
                    },
                  },
                ],
              },
            }
          : {
              session: {
                status: { not: WorkoutSessionStatus.CANCELLED },
              },
            }),
      // 세트가 없는 기록은 참고할 값이 없다.
      sets: { some: {} },
    },
    /*
      "직전 기록"은 DB에 입력된 시각이 아니라 실제 운동한 시각 기준이다.
      지난 운동을 나중에 몰아서 입력해도 시간순으로 올바른 기록을 가져온다.
    */
    orderBy: [{ session: { startedAt: "desc" } }, { createdAt: "desc" }],
    include: {
      ...recordInclude,
      session: { select: { id: true, startedAt: true } },
    },
  });

  if (!record) return null;

  const sets = record.sets.map(toSetDto);
  const weights = sets
    .map((set) => set.weight)
    .filter((weight): weight is number => weight !== null);

  return {
    recordId: record.id,
    performedAt: record.session.startedAt,
    totalVolume: toNumber(record.totalVolume),
    maxWeight: weights.length > 0 ? Math.max(...weights) : null,
    sets,
  };
}

// ---------------------------------------------------------------------------
// 기록(세션 안의 개별 운동)
// ---------------------------------------------------------------------------

export async function addRecord(
  userId: string,
  sessionId: string,
  { exerciseId, note }: { exerciseId: string; note?: string },
) {
  const owner = await resolveOwner(userId, sessionId);

  if (!owner) return null;

  assertWritable(owner);
  assertEditable(owner.status);

  const exercise = await prisma.exercise.findFirst({
    where: { id: exerciseId, isActive: true },
    select: { id: true },
  });

  if (!exercise) {
    throw new WorkoutError("EXERCISE_NOT_FOUND", "운동을 찾을 수 없습니다.");
  }

  const result = await serializableTransaction(async (tx) => {
    await lockWorkoutMutation(tx, sessionId);

    const last = await tx.workoutRecord.findFirst({
      where: { sessionId },
      orderBy: { orderIndex: "desc" },
      select: { orderIndex: true },
    });

    const record = await tx.workoutRecord.create({
      data: {
        sessionId,
        userId: owner.ownerUserId,
        exerciseId,
        note,
        orderIndex: (last?.orderIndex ?? -1) + 1,
      },
      include: recordInclude,
    });

    return toRecordDto(record);
  });

  return {
    record: result,
    // 직전 기록을 함께 내려 클라이언트가 추가 호출 없이 값을 채울 수 있게 한다.
    previousRecord: await getLastRecord(
      owner.ownerUserId,
      exerciseId,
      sessionId,
      owner.ptSessionId
        ? {
            trainerProfileId: owner.trainerProfileId ?? undefined,
            ptOnly: true,
          }
        : {},
    ),
  };
}

/**
 * 여러 운동을 한 번에 추가한다.
 *
 * 운동을 고를 때 사람들은 "오늘 가슴 3개" 처럼 묶어서 생각한다.
 * 하나 고를 때마다 목록이 닫히면 같은 작업을 세 번 반복하게 된다.
 *
 * orderIndex 를 각각 따로 계산하면 동시에 넣을 때 번호가 겹치므로
 * 마지막 번호를 한 번만 읽고 순서대로 이어 붙인다.
 */
export async function addRecords(
  userId: string,
  sessionId: string,
  exerciseIds: string[],
  options: { skipExisting?: boolean } = {},
) {
  const owner = await resolveOwner(userId, sessionId);

  if (!owner) return null;

  assertWritable(owner);
  assertEditable(owner.status);

  const found = await prisma.exercise.findMany({
    where: { id: { in: exerciseIds }, isActive: true },
    select: { id: true },
  });

  const valid = new Set(found.map((exercise) => exercise.id));

  /*
    일반 운동 추가에서는 같은 운동을 두 번 선택하는 것도 허용한다.
    "지난 수업 가져오기"에서만 skipExisting=true를 사용한다.
  */
  const ordered = exerciseIds.filter((id) => valid.has(id));

  if (ordered.length === 0) {
    throw new WorkoutError("EXERCISE_NOT_FOUND", "운동을 찾을 수 없습니다.");
  }

  return serializableTransaction(async (tx) => {
    /*
      같은 세션에 대한 orderIndex 계산과 "이미 존재하는 운동" 확인을
      하나의 transaction 안에서 수행한다.

      특히 copyPreviousExercises()가 동시에 두 번 실행되어도 두 요청 모두
      같은 시점의 빈 목록을 보고 지나가는 race를 막는다.
    */
    await lockWorkoutMutation(tx, sessionId);

    let toAdd = ordered;

    if (options.skipExisting) {
      const existing = await tx.workoutRecord.findMany({
        where: {
          sessionId,
          exerciseId: { in: [...new Set(ordered)] },
        },
        select: { exerciseId: true },
      });

      const existingIds = new Set(existing.map((record) => record.exerciseId));

      /*
        "지난 수업 가져오기"에서는 같은 운동을 요청 배열 안에서 두 번
        가지고 와도 한 번만 추가한다.
      */
      const requested = new Set<string>();
      toAdd = ordered.filter((exerciseId) => {
        if (existingIds.has(exerciseId)) return false;
        if (requested.has(exerciseId)) return false;

        requested.add(exerciseId);
        return true;
      });
    }

    if (toAdd.length === 0) {
      return {
        added: 0,
        skipped: ordered.length,
      };
    }

    const last = await tx.workoutRecord.findFirst({
      where: { sessionId },
      orderBy: { orderIndex: "desc" },
      select: { orderIndex: true },
    });

    const base = (last?.orderIndex ?? -1) + 1;

    await tx.workoutRecord.createMany({
      data: toAdd.map((exerciseId, index) => ({
        sessionId,
        // 트레이너가 대신 담아도 기록의 주인은 회원이다.
        userId: owner.ownerUserId,
        exerciseId,
        orderIndex: base + index,
      })),
    });

    return {
      added: toAdd.length,
      skipped: ordered.length - toAdd.length,
    };
  });
}

export async function deleteRecord(userId: string, recordId: string) {
  const owner = await resolveOwnerByRecord(userId, recordId);

  if (!owner) return null;

  assertWritable(owner);
  assertEditable(owner.status);

  await serializableTransaction(async (tx) => {
    await lockWorkoutMutation(tx, owner.sessionId);

    await tx.workoutRecord.delete({
      where: { id: recordId },
    });
  });

  return true;
}

// ---------------------------------------------------------------------------
// 세트
// ---------------------------------------------------------------------------

export interface SetInput {
  weight?: number | null;
  reps?: number | null;
  restSeconds?: number | null;
  completed?: boolean;
  rpe?: number | null;
  note?: string | null;
}

export async function addSet(
  userId: string,
  recordId: string,
  input: SetInput,
) {
  const owner = await resolveOwnerByRecord(userId, recordId);

  if (!owner) return null;

  assertWritable(owner);
  assertEditable(owner.status);

  return serializableTransaction(async (tx) => {
    await lockWorkoutMutation(tx, owner.sessionId);

    const last = await tx.workoutSet.findFirst({
      where: { recordId },
      orderBy: { setNumber: "desc" },
      select: { setNumber: true },
    });

    await tx.workoutSet.create({
      data: {
        recordId,
        setNumber: (last?.setNumber ?? 0) + 1,
        weight: input.weight == null ? null : new Prisma.Decimal(input.weight),
        reps: input.reps ?? null,
        restSeconds: input.restSeconds ?? null,
        completed: input.completed ?? true,
        rpe: input.rpe == null ? null : new Prisma.Decimal(input.rpe),
        note: input.note ?? null,
      },
    });

    await recalculateVolume(tx, recordId);

    return loadRecord(tx, recordId);
  });
}

/**
 * 지난번에 한 세트를 그대로 담는다.
 *
 * 수업 중에 가장 많이 하는 일이 이것이다. 지난주에 스쿼트를 60kg 8회씩 3세트
 * 했으면 이번 주도 대개 그 근처에서 시작한다. 그런데 지금은 "세트 추가" 를
 * 세 번 누르고 숫자 여섯 칸을 채워야 한다 — 운동 하나에 탭 열 번이 넘는다.
 * 수업하면서 그걸 하느니 안 적고 만다.
 *
 * 그래서 지난 기록을 통째로 넣어 주고 달라진 것만 고치게 한다. 4세트째만
 * 65kg 으로 올렸으면 그 칸 하나만 고치면 된다.
 *
 * 이미 적은 세트가 있으면 아무것도 하지 않는다. 눌러서 세트가 두 배가 되면
 * 지우는 데 더 오래 걸리고, 무엇보다 회원 기록에 안 한 운동이 남는다.
 *
 * `completed` 는 지난 기록을 따라가지 않고 항상 true 다. 지난번에 실패해서
 * 체크를 안 한 세트였더라도, 지금 담는 건 "이번에 이만큼 했다" 는 뜻이다.
 */
export async function copyPreviousSets(
  userId: string,
  recordId: string,
  options: { ptOnly?: boolean } = {},
) {
  const owner = await resolveOwnerByRecord(userId, recordId);

  if (!owner) return null;

  assertWritable(owner);
  assertEditable(owner.status);

  const record = await prisma.workoutRecord.findUnique({
    where: { id: recordId },
    select: {
      exerciseId: true,
      sessionId: true,
      _count: { select: { sets: true } },
    },
  });

  if (!record) return null;

  if (record._count.sets > 0) {
    throw new WorkoutError(
      "SET_EXISTS",
      "이미 적은 세트가 있어요. 지난 기록은 비어 있을 때만 담을 수 있어요.",
    );
  }

  const previous = await getLastRecord(
    owner.ownerUserId,
    record.exerciseId,
    record.sessionId,
    owner.ptSessionId
      ? {
          ...options,
          trainerProfileId: owner.trainerProfileId ?? undefined,
          ptOnly: options.ptOnly ?? true,
        }
      : options,
  );

  if (!previous || previous.sets.length === 0) return null;

  return serializableTransaction(async (tx) => {
    await lockWorkoutMutation(tx, owner.sessionId);

    const currentSetCount = await tx.workoutSet.count({
      where: { recordId },
    });

    if (currentSetCount > 0) {
      throw new WorkoutError(
        "SET_EXISTS",
        "이미 적은 세트가 있어요. 지난 기록은 비어 있을 때만 담을 수 있어요.",
      );
    }

    await tx.workoutSet.createMany({
      data: previous.sets.map((set, index) => ({
        recordId,
        setNumber: index + 1,
        weight: set.weight == null ? null : new Prisma.Decimal(set.weight),
        reps: set.reps ?? null,
        completed: true,
      })),
    });

    await recalculateVolume(tx, recordId);

    return loadRecord(tx, recordId);
  });
}

export async function updateSet(
  userId: string,
  setId: string,
  input: SetInput,
) {
  const owned = await resolveOwnerBySet(userId, setId);

  if (!owned) return null;

  assertWritable(owned);
  assertEditable(owned.status);

  return serializableTransaction(async (tx) => {
    await lockWorkoutMutation(tx, owned.sessionId);

    await tx.workoutSet.update({
      where: { id: setId },
      data: {
        ...(input.weight !== undefined
          ? {
              weight:
                input.weight === null ? null : new Prisma.Decimal(input.weight),
            }
          : {}),
        ...(input.reps !== undefined ? { reps: input.reps } : {}),
        ...(input.restSeconds !== undefined
          ? { restSeconds: input.restSeconds }
          : {}),
        ...(input.completed !== undefined
          ? { completed: input.completed }
          : {}),
        ...(input.rpe !== undefined
          ? { rpe: input.rpe === null ? null : new Prisma.Decimal(input.rpe) }
          : {}),
        ...(input.note !== undefined ? { note: input.note } : {}),
      },
    });

    await recalculateVolume(tx, owned.recordId);

    return loadRecord(tx, owned.recordId);
  });
}

export async function deleteSet(userId: string, setId: string) {
  const owned = await resolveOwnerBySet(userId, setId);

  if (!owned) return null;

  assertWritable(owned);
  assertEditable(owned.status);

  return serializableTransaction(async (tx) => {
    await lockWorkoutMutation(tx, owned.sessionId);

    await tx.workoutSet.delete({ where: { id: setId } });

    // (recordId, setNumber) 에 유니크 제약이 있어 삭제 후 번호를 다시 매긴다.
    // 오름차순으로 내려 쓰면 목표 번호가 항상 먼저 비므로 충돌하지 않는다.
    const remaining = await tx.workoutSet.findMany({
      where: { recordId: owned.recordId },
      orderBy: { setNumber: "asc" },
      select: { id: true, setNumber: true },
    });

    for (const [index, set] of remaining.entries()) {
      if (set.setNumber !== index + 1) {
        await tx.workoutSet.update({
          where: { id: set.id },
          data: { setNumber: index + 1 },
        });
      }
    }

    await recalculateVolume(tx, owned.recordId);

    return loadRecord(tx, owned.recordId);
  });
}

// ---------------------------------------------------------------------------
// 세션 요약
// ---------------------------------------------------------------------------
