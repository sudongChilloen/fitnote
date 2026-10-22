import "server-only";

import { Prisma } from "@/generated/prisma/client";
import {
  WorkoutEntryMode,
  WorkoutSessionStatus,
} from "@/generated/prisma/enums";
import { kstDaysAgo, kstMonthRange, toKstDateKey } from "@/lib/date";
import { prisma } from "@/lib/prisma";
import {
  WorkoutError,
  sessionInclude,
  toSessionDto,
  serializableTransaction,
  lockWorkoutMutation,
  resolveReadContext,
  resolveOwner,
  assertWritable,
} from "./workout-shared";

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
  const access = await resolveReadContext(userId, sessionId);

  if (!access?.canRead) return null;

  const session = await prisma.workoutSession.findFirst({
    where: { id: sessionId, userId: access.ownerUserId },
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

  await serializableTransaction(async (tx) => {
    await lockWorkoutMutation(tx, sessionId);

    await tx.workoutSession.update({
      where: { id: sessionId },
      data: { memo },
    });
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
