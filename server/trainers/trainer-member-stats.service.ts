import "server-only";

import { PTSessionStatus, WorkoutSessionStatus } from "@/generated/prisma/enums";
import type { WorkoutBodyPart } from "@/generated/prisma/enums";
import { kstDaysAgo, kstMonthRange, toKstDateKey } from "@/lib/date";
import { prisma } from "@/lib/prisma";

import { requireMyMember, requireTrainerProfile } from "./trainer-shared";

export interface MemberStats {
  /** 출석률. 완료 / (완료 + 노쇼). 아직 끝난 수업이 없으면 null. */
  attendanceRate: number | null;
  completedCount: number;
  noShowCount: number;
  /** 최근 4주 부위별 세트 수. 많이 한 순. */
  bodyPartSets: { bodyPart: WorkoutBodyPart; sets: number }[];
  /** 이번 달 개인 운동 횟수. 공유하지 않았으면 null. */
  personalThisMonth: number | null;
}

/**
 * 회원 상세 위쪽 숫자들.
 *
 * DB 에 새로 쌓는 값이 아니라 이미 있는 수업·운동 기록에서 그때그때 센다.
 *
 * 개인 운동은 회원이 공유를 켰을 때만 센다. 끈 회원의 개인 운동까지 부위 그림에
 * 섞으면 공유하지 않은 기록이 숫자로 새어 나간다. PT 수업 기록은 트레이너가 직접
 * 적은 것이라 늘 센다.
 */
export async function getMemberStats(
  userId: string,
  connectionId: string,
  includePersonal: boolean,
): Promise<MemberStats> {
  const trainer = await requireTrainerProfile(userId);
  const connection = await requireMyMember(trainer.id, connectionId);
  const memberUserId = connection.memberUserId;

  const { start: monthStart } = kstMonthRange(toKstDateKey(new Date()).slice(0, 7));

  const [statusCounts, sets, personalThisMonth] = await Promise.all([
    prisma.pTSession.groupBy({
      by: ["status"],
      where: {
        trainerProfileId: trainer.id,
        memberUserId,
        status: { in: [PTSessionStatus.COMPLETED, PTSessionStatus.NO_SHOW] },
      },
      _count: { _all: true },
    }),
    prisma.workoutSet.findMany({
      where: {
        record: {
          session: {
            userId: memberUserId,
            status: { not: WorkoutSessionStatus.CANCELLED },
            startedAt: { gte: kstDaysAgo(27) },
            ...(includePersonal ? {} : { ptSessionId: { not: null } }),
          },
        },
      },
      select: { record: { select: { exercise: { select: { bodyPart: true } } } } },
    }),
    includePersonal
      ? prisma.workoutSession.count({
          where: {
            userId: memberUserId,
            ptSessionId: null,
            status: { not: WorkoutSessionStatus.CANCELLED },
            startedAt: { gte: monthStart },
          },
        })
      : Promise.resolve(null),
  ]);

  const completedCount =
    statusCounts.find((row) => row.status === PTSessionStatus.COMPLETED)?._count._all ?? 0;
  const noShowCount =
    statusCounts.find((row) => row.status === PTSessionStatus.NO_SHOW)?._count._all ?? 0;
  const finished = completedCount + noShowCount;

  const byPart = new Map<WorkoutBodyPart, number>();
  for (const set of sets) {
    const part = set.record.exercise.bodyPart;
    byPart.set(part, (byPart.get(part) ?? 0) + 1);
  }

  return {
    attendanceRate: finished > 0 ? Math.round((completedCount / finished) * 100) : null,
    completedCount,
    noShowCount,
    bodyPartSets: [...byPart.entries()]
      .map(([bodyPart, count]) => ({ bodyPart, sets: count }))
      .sort((a, b) => b.sets - a.sets),
    personalThisMonth,
  };
}
