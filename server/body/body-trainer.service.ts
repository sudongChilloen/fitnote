import "server-only";

import { prisma } from "@/lib/prisma";
import { assertTrainerCanView } from "@/server/sharing/sharing.service";

import { getTrends, type BodyRow } from "./body.service";

/**
 * 트레이너가 보는 회원의 몸.
 *
 * 관계가 시작된 날부터만 보여준다. 그 전에 잰 몸무게는 이 트레이너를 염두에
 * 두고 적은 것이 아니다. 개인 운동 기록과 같은 기준이다.
 *
 * 메모는 빼고 숫자만 준다. 회원이 "생리 전이라 늘었음" 같은 것을 적어 두는
 * 칸이라 공유 대상이 아니다. 필요하면 회원이 알림장에 적는다.
 */
export async function getMemberBody(
  trainerUserId: string,
  connectionId: string,
  limit = 30,
) {
  const { member, since } = await assertTrainerCanView(
    trainerUserId,
    connectionId,
    "BODY",
  );

  const records = await prisma.bodyRecord.findMany({
    where: { userId: member.memberUserId, recordedAt: { gte: since } },
    orderBy: { recordedAt: "desc" },
    take: limit,
    select: {
      id: true,
      recordedAt: true,
      weightKg: true,
      bodyFatPercent: true,
      skeletalMuscleKg: true,
      waistCm: true,
    },
  });

  const rows: BodyRow[] = records.map((record) => ({
    id: record.id,
    recordedAt: record.recordedAt,
    dateKey: record.recordedAt.toISOString().slice(0, 10),
    weightKg: record.weightKg === null ? null : Number(record.weightKg),
    bodyFatPercent:
      record.bodyFatPercent === null ? null : Number(record.bodyFatPercent),
    skeletalMuscleKg:
      record.skeletalMuscleKg === null ? null : Number(record.skeletalMuscleKg),
    waistCm: record.waistCm === null ? null : Number(record.waistCm),
    memo: null,
  }));

  return { rows, trends: getTrends(rows), since };
}
