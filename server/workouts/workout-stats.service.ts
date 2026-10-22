import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { WorkoutSessionStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import {
  toNumber,
  setSelect,
  sessionInclude,
  toSetDto,
  toSessionDto,
} from "./workout-shared";

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
