import "server-only";

import { Prisma } from "@/generated/prisma/client";
import {
  ConnectionStatus,
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
  // PT 수업으로 한 운동인지, 누가 대신 적어 줬는지.
  // 세션 한 줄에 딸린 값이라 목록에서 함께 가져와도 비용이 없다.
  recordedBy: { select: { name: true } },
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
    /**
     * PT 수업으로 한 운동인지.
     *
     * 개인 기록으로 복사하지 않고 표시만 한다. 복사하면 같은 운동이 두 번
     * 남아서 이번 주 몇 번 했는지부터 어긋난다.
     */
    isPt: session.ptSessionId !== null,
    /** PT 라면 대신 적어 준 트레이너 이름. */
    recordedByName: session.recordedBy?.name ?? null,
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

/**
 * 이 세션에 손댈 수 있는 사람인가. 손댈 수 있으면 기록 주인의 userId 를 준다.
 *
 * 기록의 주인은 언제나 회원이다. 트레이너가 PT 수업에서 든 무게를 대신 적어
 * 줄 때도 `WorkoutRecord.userId` 는 회원이어야 한다. 여기에 트레이너를 넣으면
 * 회원의 운동 이력에서 하필 PT 수업만 통째로 빠진다.
 *
 * 그래서 "누가 눌렀나" 와 "누구의 기록인가" 를 나누고, 손댈 자격만 여기서
 * 한 번에 판단한다. 이 판단이 흩어지면 어느 한 곳에서 빠뜨렸을 때 남의 기록이
 * 고쳐진다.
 *
 * 트레이너는 자기가 가르친 PT 수업의 기록만 만질 수 있다. 개인 운동은 공유
 * 설정을 켜도 읽기만 한다 — 회원이 혼자 한 운동을 남이 고치는 건 다른 이야기다.
 */
async function resolveOwner(actorUserId: string, sessionId: string) {
  const session = await prisma.workoutSession.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      userId: true,
      status: true,
      ptSession: { select: { trainerProfileId: true } },
    },
  });

  if (!session) return null;

  if (session.userId === actorUserId) {
    /*
      회원 자신이라도 PT 수업 기록은 못 고친다.

      트레이너가 적어 준 무게를 회원이 바꾸면 두 사람이 서로 다른 숫자를 보게
      되고, 다음 수업에서 무엇을 기준으로 올릴지 알 수 없어진다. 화면에서도
      막지만 서버 액션은 화면 없이도 부를 수 있어 여기서 판단한다.
    */
    return {
      ownerUserId: session.userId,
      status: session.status,
      canWrite: session.ptSession === null,
    };
  }

  if (!session.ptSession) return null;

  const trainer = await prisma.trainerProfile.findUnique({
    where: { userId: actorUserId },
    select: { id: true },
  });

  if (!trainer || trainer.id !== session.ptSession.trainerProfileId) {
    return null;
  }

  // 담당이 끝난 뒤에는 못 고친다. 지난 트레이너가 기록을 바꾸면 회원은 지금
  // 담당이 아닌 사람이 남긴 변화를 보게 된다.
  const connection = await prisma.trainerMemberConnection.findUnique({
    where: {
      trainerProfileId_memberUserId: {
        trainerProfileId: trainer.id,
        memberUserId: session.userId,
      },
    },
    select: { status: true },
  });

  if (connection?.status !== ConnectionStatus.ACTIVE) return null;

  return {
    ownerUserId: session.userId,
    status: session.status,
    canWrite: true,
  };
}

/** 고칠 수 있는 사람인가. 아니면 왜 안 되는지 말해 준다. */
function assertWritable(owner: { canWrite: boolean }) {
  if (!owner.canWrite) {
    throw new WorkoutError(
      "PT_RECORD",
      "수업에서 트레이너가 적어 준 기록이라 고칠 수 없어요.",
    );
  }
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
  const owner = await resolveOwner(userId, sessionId);

  if (!owner) return null;

  const session = await prisma.workoutSession.findFirst({
    where: { id: sessionId, userId: owner.ownerUserId },
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
            Math.round(
              (endedAt.getTime() - session.startedAt.getTime()) / 1000,
            ),
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
  const owner = await resolveOwner(userId, sessionId);

  if (!owner) return null;

  assertWritable(owner);

  await prisma.workoutSession.update({
    where: { id: sessionId },
    data: { memo },
  });

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
 * 홈에 띄울 최근 운동 몇 개.
 *
 * listSessions 는 세트까지 전부 끌어오므로 홈에 쓰기엔 무겁다. 홈에서 필요한 건
 * "언제 · 무슨 운동 · 몇 세트" 뿐이라 이름과 개수만 센다.
 */
export async function getRecentSessions(
  userId: string,
  limit = 3,
  options?: {
    /**
     * PT 수업에서 트레이너가 적어 준 기록을 뺀다.
     *
     * 트레이너가 회원 기록을 볼 때 쓴다. 트레이너에게 자기가 적은 기록을 다시
     * 보여줄 이유가 없고, 무엇보다 회원이 공유하기로 한 건 "개인 운동" 뿐이라
     * 여기서 섞이면 공유 설정이 의미를 잃는다.
     */
    personalOnly?: boolean;

    /**
     * 이 시각 이후 기록만.
     *
     * 트레이너가 회원 기록을 볼 때 관계가 시작된 날을 넣는다. 회원이 그 전에
     * 혼자 남긴 기록은 이 트레이너에게 보여줄 생각으로 쓴 것이 아니다.
     */
    since?: Date;
  },
) {
  const sessions = await prisma.workoutSession.findMany({
    where: {
      userId,
      status: WorkoutSessionStatus.COMPLETED,
      ...(options?.personalOnly ? { ptSessionId: null } : {}),
      ...(options?.since ? { startedAt: { gte: options.since } } : {}),
    },
    orderBy: { startedAt: "desc" },
    take: limit,
    select: {
      id: true,
      startedAt: true,
      durationSec: true,
      ptSessionId: true,
      recordedBy: { select: { name: true } },
      records: {
        orderBy: { orderIndex: "asc" },
        select: {
          exercise: { select: { name: true } },
          _count: { select: { sets: true } },
        },
      },
    },
  });

  return sessions.map((session) => ({
    id: session.id,
    startedAt: session.startedAt,
    durationSec: session.durationSec,
    isPt: session.ptSessionId !== null,
    recordedByName: session.recordedBy?.name ?? null,
    exerciseNames: session.records.map((record) => record.exercise.name),
    totalSets: session.records.reduce(
      (sum, record) => sum + record._count.sets,
      0,
    ),
  }));
}

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
      ptSessionId: true,
      records: { select: { _count: { select: { sets: true } } } },
    },
  });

  const byDate = new Map<
    string,
    { sessions: number; sets: number; hasPt: boolean }
  >();

  for (const session of sessions) {
    const key = toKstDateKey(session.startedAt);
    const entry = byDate.get(key) ?? { sessions: 0, sets: 0, hasPt: false };

    entry.sessions += 1;
    entry.sets += session.records.reduce(
      (sum, record) => sum + record._count.sets,
      0,
    );
    // 하루에 PT 와 개인 운동을 둘 다 했으면 PT 쪽으로 센다.
    // 달력 칸 하나에 점을 두 개 찍으면 무슨 뜻인지 알 수 없다.
    entry.hasPt = entry.hasPt || session.ptSessionId !== null;

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
  options: { ptOnly?: boolean } = {},
) {
  const record = await prisma.workoutRecord.findFirst({
    where: {
      userId,
      exerciseId,
      ...(excludeSessionId ? { sessionId: { not: excludeSessionId } } : {}),
      /*
        트레이너가 볼 때는 자기 수업 기록만 참고하게 한다.

        "지난번 65kg" 같은 힌트는 회원이 혼자 한 운동에서 나올 수 있는데,
        개인 운동은 공유 설정을 켠 회원만 보여주기로 한 것이다. 힌트라고
        해서 게이트를 지나가면 안 된다.
      */
      ...(options.ptOnly ? { session: { ptSessionId: { not: null } } } : {}),
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

  const last = await prisma.workoutRecord.findFirst({
    where: { sessionId },
    orderBy: { orderIndex: "desc" },
    select: { orderIndex: true },
  });

  const record = await prisma.workoutRecord.create({
    data: {
      sessionId,
      userId: owner.ownerUserId,
      exerciseId,
      note,
      orderIndex: (last?.orderIndex ?? -1) + 1,
    },
    include: recordInclude,
  });

  return {
    record: toRecordDto(record),
    // 직전 기록을 함께 내려 클라이언트가 추가 호출 없이 값을 채울 수 있게 한다.
    previousRecord: await getLastRecord(
      owner.ownerUserId,
      exerciseId,
      sessionId,
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
      // 트레이너가 대신 담아도 기록의 주인은 회원이다.
      userId: owner.ownerUserId,
      exerciseId,
      orderIndex: base + index,
    })),
  });

  return {
    added: ordered.length,
    skipped: exerciseIds.length - ordered.length,
  };
}

export async function deleteRecord(userId: string, recordId: string) {
  const owner = await resolveOwnerByRecord(userId, recordId);

  if (!owner) return null;

  assertWritable(owner);
  assertEditable(owner.status);

  await prisma.workoutRecord.delete({ where: { id: recordId } });

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
    options,
  );

  if (!previous || previous.sets.length === 0) return null;

  return prisma.$transaction(async (tx) => {
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
  const owned = await resolveOwnerBySet(userId, setId);

  if (!owned) return null;

  assertWritable(owned);
  assertEditable(owned.status);

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

// ---------------------------------------------------------------------------
// 세션 요약
// ---------------------------------------------------------------------------

/**
 * 추정 1RM (Epley 공식).
 *
 * 고반복으로 갈수록 실제보다 크게 나오는 공식이라 12회까지만 계산한다.
 * 20회 한 세트를 1RM 으로 환산해 "신기록" 이라고 알려 주면 틀린 정보다.
 */
export function estimateOneRm(weight: number, reps: number): number | null {
  if (weight <= 0 || reps <= 0 || reps > 12) return null;
  if (reps === 1) return weight;

  return Math.round(weight * (1 + reps / 30) * 10) / 10;
}

type SetLike = {
  weight: number | null;
  reps: number | null;
  completed: boolean;
};

/** 볼륨과 같은 기준. 체크하지 않았거나 값이 빠진 세트는 기록으로 치지 않는다. */
function countsTowardRecord<T extends SetLike>(
  set: T,
): set is T & { weight: number; reps: number } {
  return set.completed && set.weight !== null && set.reps !== null;
}

/**
 * 운동 하나를 끝낸 뒤 보여줄 요약.
 *
 * 신기록 판정은 저장해 두지 않고 볼 때마다 계산한다. 완료한 기록도 나중에
 * 고칠 수 있기 때문에, 판정을 박아 두면 값을 고쳐도 배지가 그대로 남는다.
 */
export async function getSessionSummary(userId: string, sessionId: string) {
  const session = await prisma.workoutSession.findFirst({
    where: { id: sessionId, userId },
    include: sessionInclude,
  });

  if (!session) return null;

  const dto = toSessionDto(session);
  const exerciseIds = [
    ...new Set(dto.records.map((record) => record.exercise.id)),
  ];

  /**
   * 이 세션에 나온 운동들의 과거 최고 기록.
   *
   * 운동마다 따로 조회하면 열 번을 왕복하므로 한 번에 가져온다.
   * startedAt 이 이 세션보다 앞선 것만 본다. 지난 운동을 나중에 몰아서
   * 입력하면 나중에 만들어진 세션이 더 과거일 수 있어서, 만든 시각이 아니라
   * 운동한 시각을 기준으로 삼아야 한다.
   */
  const pastSets =
    exerciseIds.length === 0
      ? []
      : await prisma.workoutSet.findMany({
          where: {
            completed: true,
            weight: { not: null },
            reps: { not: null },
            record: {
              userId,
              exerciseId: { in: exerciseIds },
              session: {
                id: { not: sessionId },
                // 취소한 운동은 없던 일이므로 신기록의 근거가 될 수 없다.
                status: { not: WorkoutSessionStatus.CANCELLED },
                startedAt: { lt: session.startedAt },
              },
            },
          },
          select: {
            weight: true,
            reps: true,
            record: { select: { exerciseId: true } },
          },
        });

  const best = new Map<string, { weight: number; oneRm: number }>();

  for (const set of pastSets) {
    const weight = toNumber(set.weight) ?? 0;
    const reps = set.reps ?? 0;
    const exerciseId = set.record.exerciseId;
    const previous = best.get(exerciseId);

    best.set(exerciseId, {
      weight: Math.max(previous?.weight ?? 0, weight),
      oneRm: Math.max(previous?.oneRm ?? 0, estimateOneRm(weight, reps) ?? 0),
    });
  }

  const records = dto.records.map((record) => {
    const counted = record.sets.filter(countsTowardRecord);

    let topSet: { weight: number; reps: number } | null = null;
    let oneRm: number | null = null;

    for (const set of counted) {
      // 같은 중량이면 횟수가 많은 쪽이 더 좋은 세트다.
      if (
        !topSet ||
        set.weight > topSet.weight ||
        (set.weight === topSet.weight && set.reps > topSet.reps)
      ) {
        topSet = { weight: set.weight, reps: set.reps };
      }

      const estimate = estimateOneRm(set.weight, set.reps);
      if (estimate !== null && (oneRm === null || estimate > oneRm)) {
        oneRm = estimate;
      }
    }

    const history = best.get(record.exercise.id);

    return {
      ...record,
      countedSets: counted.length,
      skippedSets: record.sets.length - counted.length,
      topSet,
      oneRm,
      /**
       * 처음 해 본 운동은 신기록이라고 하지 않는다.
       * 전부 신기록이면 배지가 의미를 잃는다.
       */
      firstTime: !history,
      weightPr: Boolean(history && topSet && topSet.weight > history.weight),
      oneRmPr: Boolean(history && oneRm !== null && oneRm > history.oneRm),
      previousBestWeight: history?.weight ?? null,
    };
  });

  return {
    ...dto,
    records,
    countedSets: records.reduce((sum, record) => sum + record.countedSets, 0),
    skippedSets: records.reduce((sum, record) => sum + record.skippedSets, 0),
    prCount: records.filter((record) => record.weightPr || record.oneRmPr)
      .length,
  };
}

// ---------------------------------------------------------------------------
// 운동별 기록 추이
// ---------------------------------------------------------------------------

/**
 * 운동 하나를 시간순으로 모아 본다.
 *
 * 요약 화면은 한 번의 운동 안에서만 신기록을 알려 주기 때문에, 화면을 나가면
 * "내가 이 운동을 얼마나 올렸는지" 를 볼 곳이 없다.
 */
export async function getExerciseTrend(
  userId: string,
  exerciseId: string,
  limit = 12,
) {
  const where = {
    userId,
    exerciseId,
    // 취소한 운동은 없던 일이다.
    session: { status: { not: WorkoutSessionStatus.CANCELLED } },
    sets: { some: {} },
  } satisfies Prisma.WorkoutRecordWhereInput;

  const [records, totalCount] = await Promise.all([
    prisma.workoutRecord.findMany({
      where,
      // 만든 시각이 아니라 운동한 시각 기준이다. 지난 운동을 나중에 몰아서
      // 입력하면 두 순서가 어긋난다.
      orderBy: { session: { startedAt: "desc" } },
      take: limit,
      select: {
        id: true,
        totalVolume: true,
        sessionId: true,
        session: { select: { startedAt: true } },
        sets: { orderBy: { setNumber: "asc" }, select: setSelect },
      },
    }),
    prisma.workoutRecord.count({ where }),
  ]);

  if (records.length === 0) {
    return { entries: [], totalCount: 0, bestWeight: null, bestOneRm: null };
  }

  const oldestShown = records[records.length - 1].session.startedAt;

  /**
   * 이 운동의 전체 기록.
   *
   * 최고 기록은 화면에 보이는 구간이 아니라 전체를 기준으로 해야 한다.
   * 열두 번 전에 세운 기록을 못 보고 신기록이라고 하면 안 된다.
   *
   * 운동 하나에 딸린 세트만 가져오고 두 칸만 읽으므로, 몇 년을 모아도
   * 수백 행이다. 최고 중량과 추정 1RM 을 따로 물으면 기준이 어긋나기
   * 쉬워서 한 번에 가져와 함께 계산한다.
   */
  const allSets = await prisma.workoutSet.findMany({
    where: {
      completed: true,
      weight: { not: null },
      reps: { not: null },
      record: {
        userId,
        exerciseId,
        session: { status: { not: WorkoutSessionStatus.CANCELLED } },
      },
    },
    select: {
      weight: true,
      reps: true,
      record: { select: { session: { select: { startedAt: true } } } },
    },
  });

  let bestWeight: number | null = null;
  let bestOneRm: number | null = null;
  // 화면에 보이는 구간보다 앞선 최고 중량. 신기록 판정의 출발점이 된다.
  let runningBest = 0;
  // 이 구간보다 앞선 기록이 있었는지. 없으면 첫 줄이 "첫 기록" 이다.
  let seenAny = false;

  for (const set of allSets) {
    const weight = toNumber(set.weight) ?? 0;
    const reps = set.reps ?? 0;
    const oneRm = estimateOneRm(weight, reps);

    if (bestWeight === null || weight > bestWeight) bestWeight = weight;
    if (oneRm !== null && (bestOneRm === null || oneRm > bestOneRm)) {
      bestOneRm = oneRm;
    }
    if (set.record.session.startedAt < oldestShown) {
      runningBest = Math.max(runningBest, weight);
      seenAny = true;
    }
  }

  // 오래된 것부터 훑어야 "그 시점까지의 최고" 를 알 수 있다.
  const ascending = [...records].reverse().map((record) => {
    const counted = record.sets.map(toSetDto).filter(countsTowardRecord);

    let topSet: { weight: number; reps: number } | null = null;
    let oneRm: number | null = null;

    for (const set of counted) {
      if (
        !topSet ||
        set.weight > topSet.weight ||
        (set.weight === topSet.weight && set.reps > topSet.reps)
      ) {
        topSet = { weight: set.weight, reps: set.reps };
      }

      const estimate = estimateOneRm(set.weight, set.reps);
      if (estimate !== null && (oneRm === null || estimate > oneRm)) {
        oneRm = estimate;
      }
    }

    // 처음 해 본 날을 신기록이라고 하지 않는 것은 요약 화면과 같은 규칙이다.
    // 같은 기록을 두 화면이 다르게 부르면 안 된다.
    const firstTime = !seenAny;
    const isPr = Boolean(seenAny && topSet && topSet.weight > runningBest);

    if (topSet) {
      runningBest = Math.max(runningBest, topSet.weight);
    }
    if (counted.length > 0) {
      seenAny = true;
    }

    return {
      recordId: record.id,
      sessionId: record.sessionId,
      performedAt: record.session.startedAt,
      volume: toNumber(record.totalVolume) ?? 0,
      setCount: counted.length,
      topSet,
      oneRm,
      isPr,
      firstTime,
    };
  });

  return {
    // 화면에는 최근 것부터 보여준다.
    entries: ascending.reverse(),
    totalCount,
    bestWeight,
    bestOneRm,
  };
}
