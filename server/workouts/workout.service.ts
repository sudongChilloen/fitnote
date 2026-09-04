import "server-only";

import { Prisma } from "@/generated/prisma/client";
import {
  WorkoutEntryMode,
  WorkoutSessionStatus,
} from "@/generated/prisma/enums";
import { kstDaysAgo, kstMonthRange, toKstDateKey } from "@/lib/date";
import { prisma } from "@/lib/prisma";

/** 서비스 계층에서 의미 있는 실패를 구분하기 위한 에러 */
export class WorkoutError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = "WorkoutError";
  }
}

/**
 * Prisma Decimal 은 JSON 으로 나갈 때 문자열이 된다.
 * 프론트에서 숫자 연산이 문자열 결합으로 새는 것을 막기 위해 경계에서 변환한다.
 */
function toNumber(value: Prisma.Decimal | null): number | null {
  return value === null ? null : Number(value);
}

const setSelect = {
  id: true,
  setNumber: true,
  weight: true,
  reps: true,
  restSeconds: true,
  completed: true,
  rpe: true,
  note: true,
} satisfies Prisma.WorkoutSetSelect;

const recordInclude = {
  exercise: {
    select: {
      id: true,
      name: true,
      bodyPart: true,
      targetMuscle: true,
      movementType: true,
      difficulty: true,
    },
  },
  sets: {
    orderBy: { setNumber: "asc" },
    select: setSelect,
  },
} satisfies Prisma.WorkoutRecordInclude;

const sessionInclude = {
  records: {
    orderBy: { orderIndex: "asc" },
    include: recordInclude,
  },
} satisfies Prisma.WorkoutSessionInclude;

type SetPayload = Prisma.WorkoutSetGetPayload<{ select: typeof setSelect }>;
type RecordPayload = Prisma.WorkoutRecordGetPayload<{
  include: typeof recordInclude;
}>;
type SessionPayload = Prisma.WorkoutSessionGetPayload<{
  include: typeof sessionInclude;
}>;

function toSetDto(set: SetPayload) {
  return {
    id: set.id,
    setNumber: set.setNumber,
    weight: toNumber(set.weight),
    reps: set.reps,
    restSeconds: set.restSeconds,
    completed: set.completed,
    rpe: toNumber(set.rpe),
    note: set.note,
  };
}

function toRecordDto(record: RecordPayload) {
  return {
    id: record.id,
    orderIndex: record.orderIndex,
    recordType: record.recordType,
    note: record.note,
    totalVolume: toNumber(record.totalVolume),
    exercise: record.exercise,
    sets: record.sets.map(toSetDto),
  };
}

function toSessionDto(session: SessionPayload) {
  const records = session.records.map(toRecordDto);
  const until = session.endedAt ?? new Date();

  return {
    id: session.id,
    routineId: session.routineId,
    startedAt: session.startedAt,
    endedAt: session.endedAt,
    durationSec: session.durationSec,
    entryMode: session.entryMode,
    // 진행중 세션의 경과 시간. 서버에서 계산해 두면 화면이 첫 렌더부터
    // 올바른 값을 그릴 수 있고, 컴포넌트가 렌더 중 Date.now() 를 부르지 않아도 된다.
    //
    // 몰아서 입력하는 세션에는 흐르는 시간이 없다. 지난 날짜를 입력하는 중이라면
    // startedAt 이 며칠 전이라 "3일 12시간 경과" 같은 값이 나온다.
    elapsedSec:
      session.entryMode === WorkoutEntryMode.MANUAL
        ? null
        : Math.max(
            0,
            Math.floor((until.getTime() - session.startedAt.getTime()) / 1000),
          ),
    status: session.status,
    memo: session.memo,
    records,
    // 세션 전체 합계. 클라이언트가 매번 합산하지 않도록 서버에서 계산한다.
    totalVolume: records.reduce(
      (sum, record) => sum + (record.totalVolume ?? 0),
      0,
    ),
    totalSets: records.reduce((sum, record) => sum + record.sets.length, 0),
  };
}

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

/** 소유권 확인. 다른 사용자의 세트를 건드리지 못하게 한다. */
async function findOwnedSet(userId: string, setId: string) {
  return prisma.workoutSet.findFirst({
    where: { id: setId, record: { userId } },
    select: {
      id: true,
      recordId: true,
      record: { select: { session: { select: { status: true } } } },
    },
  });
}

/**
 * 기록을 고칠 수 있는 상태인가.
 *
 * "종료" 는 운동이 끝났다는 뜻이지 데이터가 굳었다는 뜻이 아니다.
 * 집에 와서 무게를 잘못 적은 걸 발견하는 일은 흔하다. 그래서 완료된
 * 세션도 고칠 수 있게 두고, 취소한 세션만 막는다.
 *
 * 이 검사는 한 곳에 모아 둔다. 예전에는 운동 추가만 막고 세트 수정은
 * 상태를 아예 보지 않아, 취소한 세션의 세트가 고쳐지고 있었다.
 */
function assertEditable(status: WorkoutSessionStatus) {
  if (status === WorkoutSessionStatus.CANCELLED) {
    throw new WorkoutError(
      "SESSION_CANCELLED",
      "취소한 기록은 수정할 수 없습니다.",
    );
  }
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

export async function getActiveSession(userId: string) {
  const session = await prisma.workoutSession.findFirst({
    // 몰아서 입력하는 중인 세션은 "진행중 운동" 이 아니다.
    // 어제 기록을 입력하는 중에 홈에 타이머가 뜨면 안 된다.
    where: {
      userId,
      status: WorkoutSessionStatus.IN_PROGRESS,
      entryMode: WorkoutEntryMode.LIVE,
    },
    orderBy: { startedAt: "desc" },
    include: sessionInclude,
  });

  return session ? toSessionDto(session) : null;
}

export async function getSessionById(userId: string, sessionId: string) {
  const session = await prisma.workoutSession.findFirst({
    where: { id: sessionId, userId },
    include: sessionInclude,
  });

  return session ? toSessionDto(session) : null;
}

export async function finishSession(
  userId: string,
  sessionId: string,
  status: WorkoutSessionStatus = WorkoutSessionStatus.COMPLETED,
) {
  const session = await prisma.workoutSession.findFirst({
    where: { id: sessionId, userId },
    select: { id: true, startedAt: true, status: true, entryMode: true },
  });

  if (!session) {
    return null;
  }

  if (session.status !== WorkoutSessionStatus.IN_PROGRESS) {
    throw new WorkoutError("SESSION_NOT_ACTIVE", "이미 종료된 세션입니다.");
  }

  const manual = session.entryMode === WorkoutEntryMode.MANUAL;

  // 몰아서 입력한 세션의 소요 시간을 벽시계로 재면, 입력하는 데 걸린 시간이
  // 운동 시간이 된다. 지난 날짜라면 며칠짜리 운동이 되어 버린다.
  // 사용자가 직접 적어 주기 전까지는 비워 둔다.
  const endedAt = manual ? session.startedAt : new Date();

  const updated = await prisma.workoutSession.update({
    where: { id: session.id },
    data: {
      endedAt,
      status,
      durationSec: manual
        ? null
        : Math.max(
            0,
            Math.round((endedAt.getTime() - session.startedAt.getTime()) / 1000),
          ),
    },
    include: sessionInclude,
  });

  return toSessionDto(updated);
}

export type StartSessionMode = "ask" | "resume" | "new";

/**
 * 운동 세션 시작.
 * 하루에 여러 번 운동할 수 있으므로 날짜 단위 제약은 두지 않는다.
 * 다만 끝내지 않은 세션이 쌓이지 않도록 진행중 세션을 먼저 확인한다.
 */
export async function startSession(
  userId: string,
  options: {
    routineId?: string;
    memo?: string;
    mode?: StartSessionMode;
  } = {},
) {
  const { routineId, memo, mode = "ask" } = options;

  const active = await prisma.workoutSession.findFirst({
    where: {
      userId,
      status: WorkoutSessionStatus.IN_PROGRESS,
      entryMode: WorkoutEntryMode.LIVE,
    },
    orderBy: { startedAt: "desc" },
    select: { id: true, _count: { select: { records: true } } },
  });

  if (active) {
    if (mode === "ask") {
      return {
        conflict: true as const,
        activeSession: await getActiveSession(userId),
      };
    }

    if (mode === "resume") {
      return {
        conflict: false as const,
        session: await getActiveSession(userId),
      };
    }

    // mode === "new": 기존 세션을 마감한다.
    // 기록이 없으면 취소로 정리해 빈 세션이 이력에 남지 않게 한다.
    await finishSession(
      userId,
      active.id,
      active._count.records > 0
        ? WorkoutSessionStatus.COMPLETED
        : WorkoutSessionStatus.CANCELLED,
    );
  }

  if (routineId) {
    const routine = await prisma.routine.findFirst({
      where: { id: routineId, userId },
      select: { id: true },
    });

    if (!routine) {
      throw new WorkoutError("ROUTINE_NOT_FOUND", "루틴을 찾을 수 없습니다.");
    }
  }

  const created = await prisma.workoutSession.create({
    data: { userId, routineId, memo, startedAt: new Date() },
    include: sessionInclude,
  });

  return { conflict: false as const, session: toSessionDto(created) };
}

export async function updateSessionMemo(
  userId: string,
  sessionId: string,
  memo: string | null,
) {
  const result = await prisma.workoutSession.updateMany({
    where: { id: sessionId, userId },
    data: { memo },
  });

  if (result.count === 0) return null;

  return getSessionById(userId, sessionId);
}

export async function listSessions(
  userId: string,
  {
    page = 1,
    limit = 20,
    from,
    to,
  }: { page?: number; limit?: number; from?: Date; to?: Date } = {},
) {
  const normalizedPage = Math.max(1, page);
  const normalizedLimit = Math.min(Math.max(1, limit), 100);

  const where: Prisma.WorkoutSessionWhereInput = {
    userId,
    ...(from || to
      ? {
          startedAt: {
            ...(from ? { gte: from } : {}),
            ...(to ? { lte: to } : {}),
          },
        }
      : {}),
  };

  const [sessions, total] = await Promise.all([
    prisma.workoutSession.findMany({
      where,
      orderBy: { startedAt: "desc" },
      skip: (normalizedPage - 1) * normalizedLimit,
      take: normalizedLimit,
      include: sessionInclude,
    }),
    prisma.workoutSession.count({ where }),
  ]);

  const totalPages = Math.ceil(total / normalizedLimit);

  return {
    data: sessions.map(toSessionDto),
    pagination: {
      page: normalizedPage,
      limit: normalizedLimit,
      total,
      totalPages,
      hasNextPage: normalizedPage < totalPages,
      hasPreviousPage: normalizedPage > 1,
    },
  };
}

// ---------------------------------------------------------------------------
// 이전 기록
// ---------------------------------------------------------------------------

/**
 * 최근 n 일간 운동한 날짜 목록. 홈 화면의 주간 스트립에 쓴다.
 *
 * 세트까지 끌어오면 홈을 열 때마다 불필요하게 무거워지므로
 * startedAt 만 select 해서 KST 기준 날짜로 접는다.
 */
export async function getRecentWorkoutDays(userId: string, days = 7) {
  const sessions = await prisma.workoutSession.findMany({
    where: {
      userId,
      status: { not: WorkoutSessionStatus.CANCELLED },
      startedAt: { gte: kstDaysAgo(days - 1) },
    },
    orderBy: { startedAt: "asc" },
    select: { startedAt: true },
  });

  return new Set(sessions.map((session) => toKstDateKey(session.startedAt)));
}

/**
 * 한 달치 날짜별 요약.
 *
 * 달력의 점을 찍는 용도라 세션 전체를 끌어올 필요가 없다.
 * 날짜와 세트 수만 있으면 되므로 sets 는 개수만 센다.
 */
export async function getMonthSummary(userId: string, monthKey: string) {
  const { start, end } = kstMonthRange(monthKey);

  if (Number.isNaN(start.getTime())) {
    throw new WorkoutError("INVALID_DATE", "날짜 형식이 올바르지 않습니다.");
  }

  const sessions = await prisma.workoutSession.findMany({
    where: {
      userId,
      status: { not: WorkoutSessionStatus.CANCELLED },
      startedAt: { gte: start, lt: end },
    },
    orderBy: { startedAt: "asc" },
    select: {
      startedAt: true,
      records: { select: { _count: { select: { sets: true } } } },
    },
  });

  const byDate = new Map<string, { sessions: number; sets: number }>();

  for (const session of sessions) {
    const key = toKstDateKey(session.startedAt);
    const entry = byDate.get(key) ?? { sessions: 0, sets: 0 };

    entry.sessions += 1;
    entry.sets += session.records.reduce(
      (sum, record) => sum + record._count.sets,
      0,
    );

    byDate.set(key, entry);
  }

  return byDate;
}

/**
 * 지난 날짜의 운동을 몰아서 입력하기 위한 세션을 연다.
 *
 * 실시간 세션과 달리 "진행중" 으로 잡히지 않으므로(entryMode=MANUAL),
 * 어제 기록을 입력하는 도중에도 오늘 운동을 새로 시작할 수 있다.
 *
 * 같은 날짜에 이미 작성 중인 세션이 있으면 그걸 다시 연다. 들어올 때마다
 * 새로 만들면 입력하다 나갔다 돌아온 사람에게 빈 세션이 쌓인다.
 * 반면 이미 마친(COMPLETED) 세션은 건드리지 않는다 — 하루에 두 번 운동한
 * 경우를 하나로 합쳐 버리면 안 된다.
 */
export async function openManualSession(
  userId: string,
  dateKey: string,
  options: { recordedByUserId?: string } = {},
) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
    throw new WorkoutError("INVALID_DATE", "날짜 형식이 올바르지 않습니다.");
  }

  const startedAt = new Date(`${dateKey}T00:00:00+09:00`);

  if (Number.isNaN(startedAt.getTime())) {
    throw new WorkoutError("INVALID_DATE", "날짜 형식이 올바르지 않습니다.");
  }

  // 아직 오지 않은 날의 운동을 기록할 수는 없다.
  if (dateKey > toKstDateKey(new Date())) {
    throw new WorkoutError("FUTURE_DATE", "미래 날짜는 기록할 수 없습니다.");
  }

  const dayEnd = new Date(startedAt.getTime() + 24 * 60 * 60 * 1000);

  const draft = await prisma.workoutSession.findFirst({
    where: {
      userId,
      status: WorkoutSessionStatus.IN_PROGRESS,
      entryMode: WorkoutEntryMode.MANUAL,
      startedAt: { gte: startedAt, lt: dayEnd },
    },
    orderBy: { startedAt: "desc" },
    include: sessionInclude,
  });

  if (draft) {
    return toSessionDto(draft);
  }

  const created = await prisma.workoutSession.create({
    data: {
      userId,
      startedAt,
      entryMode: WorkoutEntryMode.MANUAL,
      recordedByUserId: options.recordedByUserId,
    },
    include: sessionInclude,
  });

  return toSessionDto(created);
}

/**
 * 특정 날짜(KST)의 세션 목록.
 *
 * 하루에 두 번 운동하는 사람이 있으므로 항상 배열이다.
 * 취소된 세션은 이력에서 뺀다.
 */
export async function getSessionsByDate(userId: string, dateKey: string) {
  const start = new Date(`${dateKey}T00:00:00+09:00`);

  if (Number.isNaN(start.getTime())) {
    throw new WorkoutError("INVALID_DATE", "날짜 형식이 올바르지 않습니다.");
  }

  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);

  const sessions = await prisma.workoutSession.findMany({
    where: {
      userId,
      status: { not: WorkoutSessionStatus.CANCELLED },
      startedAt: { gte: start, lt: end },
    },
    orderBy: { startedAt: "asc" },
    include: sessionInclude,
  });

  return sessions.map(toSessionDto);
}

/**
 * 해당 운동의 직전 기록.
 * WorkoutRecord.userId 비정규화 덕분에
 * [userId, exerciseId, createdAt DESC] 인덱스로 바로 찾는다.
 */
export async function getLastRecord(
  userId: string,
  exerciseId: string,
  excludeSessionId?: string,
) {
  const record = await prisma.workoutRecord.findFirst({
    where: {
      userId,
      exerciseId,
      ...(excludeSessionId ? { sessionId: { not: excludeSessionId } } : {}),
      // 세트가 없는 기록은 참고할 값이 없다.
      sets: { some: {} },
    },
    orderBy: { createdAt: "desc" },
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
  const session = await prisma.workoutSession.findFirst({
    where: { id: sessionId, userId },
    select: { id: true, status: true },
  });

  if (!session) return null;

  assertEditable(session.status);

  const exercise = await prisma.exercise.findFirst({
    where: { id: exerciseId, isActive: true },
    select: { id: true },
  });

  if (!exercise) {
    throw new WorkoutError("EXERCISE_NOT_FOUND", "운동을 찾을 수 없습니다.");
  }

  const last = await prisma.workoutRecord.findFirst({
    where: { sessionId },
    orderBy: { orderIndex: "desc" },
    select: { orderIndex: true },
  });

  const record = await prisma.workoutRecord.create({
    data: {
      sessionId,
      userId,
      exerciseId,
      note,
      orderIndex: (last?.orderIndex ?? -1) + 1,
    },
    include: recordInclude,
  });

  return {
    record: toRecordDto(record),
    // 직전 기록을 함께 내려 클라이언트가 추가 호출 없이 값을 채울 수 있게 한다.
    previousRecord: await getLastRecord(userId, exerciseId, sessionId),
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
) {
  const session = await prisma.workoutSession.findFirst({
    where: { id: sessionId, userId },
    select: { id: true, status: true },
  });

  if (!session) return null;

  assertEditable(session.status);

  const found = await prisma.exercise.findMany({
    where: { id: { in: exerciseIds }, isActive: true },
    select: { id: true },
  });

  const valid = new Set(found.map((exercise) => exercise.id));
  // 사용자가 고른 순서를 유지한다.
  const ordered = exerciseIds.filter((id) => valid.has(id));

  if (ordered.length === 0) {
    throw new WorkoutError("EXERCISE_NOT_FOUND", "운동을 찾을 수 없습니다.");
  }

  const last = await prisma.workoutRecord.findFirst({
    where: { sessionId },
    orderBy: { orderIndex: "desc" },
    select: { orderIndex: true },
  });

  const base = (last?.orderIndex ?? -1) + 1;

  await prisma.workoutRecord.createMany({
    data: ordered.map((exerciseId, index) => ({
      sessionId,
      userId,
      exerciseId,
      orderIndex: base + index,
    })),
  });

  return { added: ordered.length, skipped: exerciseIds.length - ordered.length };
}

export async function deleteRecord(userId: string, recordId: string) {
  const record = await prisma.workoutRecord.findFirst({
    where: { id: recordId, userId },
    select: { id: true, session: { select: { status: true } } },
  });

  if (!record) return null;

  assertEditable(record.session.status);

  await prisma.workoutRecord.delete({ where: { id: record.id } });

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

export async function addSet(userId: string, recordId: string, input: SetInput) {
  const record = await prisma.workoutRecord.findFirst({
    where: { id: recordId, userId },
    select: { id: true, session: { select: { status: true } } },
  });

  if (!record) return null;

  assertEditable(record.session.status);

  return prisma.$transaction(async (tx) => {
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

export async function updateSet(
  userId: string,
  setId: string,
  input: SetInput,
) {
  const owned = await findOwnedSet(userId, setId);

  if (!owned) return null;

  assertEditable(owned.record.session.status);

  return prisma.$transaction(async (tx) => {
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
  const owned = await findOwnedSet(userId, setId);

  if (!owned) return null;

  assertEditable(owned.record.session.status);

  return prisma.$transaction(async (tx) => {
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
