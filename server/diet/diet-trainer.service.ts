import "server-only";

import { prisma } from "@/lib/prisma";
import {
  assertTrainerCanView,
  type SharingSetting,
} from "@/server/sharing/sharing.service";

import {
  DietError,
  getDietDetailForTrainer,
  MAX_FEEDBACK,
  MEAL_ORDER,
  trimDietText,
  type DietRecordDto,
} from "./diet.service";

import { createSignedReadUrls } from "@/lib/storage";
import { toKstDateKey } from "@/lib/date";

/**
 * 트레이너가 보는 회원 식단.
 *
 * 식단과 식단 사진은 공유 스위치가 따로다. 무엇을 먹었는지는 보여주되 사진은
 * 부담스러운 사람이 있어서다. 그래서 사진은 켜져 있을 때만 서명 주소를 만든다 —
 * 주소를 만들어 두고 화면에서만 감추면 응답 어딘가에 주소가 남는다.
 */

const listSelect = {
  id: true,
  date: true,
  mealType: true,
  foodName: true,
  memo: true,
  imagePath: true,
  thumbnailPath: true,
  createdAt: true,
  _count: { select: { feedbacks: true } },
} as const;

export interface MemberDietDay {
  dateKey: string;
  records: DietRecordDto[];
}

/**
 * 회원 식단 목록. 공유가 꺼져 있으면 SharingError 를 던진다.
 *
 * 부르는 쪽에서 미리 설정을 보고 꺼져 있으면 부르지 않는 것이 보통이지만,
 * 여기서도 막는다. 남의 기록을 읽는 통로는 화면의 조건문이 아니라 서비스가
 * 지켜야 한다.
 */
export async function listMemberDiet(
  trainerUserId: string,
  memberMembershipId: string,
  limit = 12,
): Promise<{ days: MemberDietDay[]; setting: SharingSetting }> {
  const { member, setting } = await assertTrainerCanView(
    trainerUserId,
    memberMembershipId,
    "DIET",
  );

  const rows = await prisma.dietRecord.findMany({
    where: { userId: member.user.id },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    take: limit,
    select: listSelect,
  });

  const urls = setting.shareDietPhoto
    ? await createSignedReadUrls(
        rows
          .map((row) => row.thumbnailPath)
          .filter((path): path is string => path !== null),
      )
    : new Map<string, string>();

  const days = new Map<string, DietRecordDto[]>();

  for (const row of rows) {
    const dto: DietRecordDto = {
      id: row.id,
      date: row.date,
      mealType: row.mealType,
      foodName: row.foodName,
      memo: row.memo,
      imageUrl: null,
      thumbnailUrl:
        setting.shareDietPhoto && row.thumbnailPath
          ? (urls.get(row.thumbnailPath) ?? null)
          : null,
      hasPhoto: row.imagePath !== null,
      feedbackCount: row._count.feedbacks,
      createdAt: row.createdAt,
    };

    const key = toKstDateKey(row.date);
    const list = days.get(key);
    if (list) list.push(dto);
    else days.set(key, [dto]);
  }

  return {
    days: [...days.entries()].map(([dateKey, records]) => ({
      dateKey,
      records: records.sort(
        (a, b) =>
          MEAL_ORDER.indexOf(a.mealType) - MEAL_ORDER.indexOf(b.mealType),
      ),
    })),
    setting,
  };
}

export async function getMemberDietDetail(
  trainerUserId: string,
  memberMembershipId: string,
  dietId: string,
) {
  const { member, setting } = await assertTrainerCanView(
    trainerUserId,
    memberMembershipId,
    "DIET",
  );

  const detail = await getDietDetailForTrainer(
    member.user.id,
    dietId,
    setting.shareDietPhoto,
  );

  return { detail, member, setting };
}

/**
 * 식단에 피드백을 남긴다.
 *
 * 공유가 꺼지면 쓰지도 못한다. 못 보는 것에 답을 달 수는 없고, 회원이 껐다 켜는
 * 사이에 글이 끼어들면 회원 입장에서는 갑자기 없던 댓글이 나타난다.
 */
export async function addDietFeedback(
  trainerUserId: string,
  memberMembershipId: string,
  dietId: string,
  content: unknown,
) {
  const { trainer, member } = await assertTrainerCanView(
    trainerUserId,
    memberMembershipId,
    "DIET",
  );

  const text = trimDietText(content, MAX_FEEDBACK);

  if (!text) {
    throw new DietError("INVALID", "피드백 내용을 적어주세요.");
  }

  const diet = await prisma.dietRecord.findFirst({
    where: { id: dietId, userId: member.user.id },
    select: { id: true },
  });

  if (!diet) {
    throw new DietError("NOT_FOUND", "식단 기록을 찾을 수 없어요.");
  }

  return prisma.dietFeedback.create({
    data: {
      dietRecordId: diet.id,
      trainerMembershipId: trainer.id,
      content: text,
    },
    select: { id: true },
  });
}

/** 내가 쓴 피드백만 지운다. 회원의 글이 아니라 내 글이므로 회원은 못 지운다. */
export async function deleteDietFeedback(
  trainerUserId: string,
  memberMembershipId: string,
  feedbackId: string,
) {
  const { trainer } = await assertTrainerCanView(
    trainerUserId,
    memberMembershipId,
    "DIET",
  );

  const feedback = await prisma.dietFeedback.findFirst({
    where: { id: feedbackId, trainerMembershipId: trainer.id },
    select: { id: true },
  });

  if (!feedback) {
    throw new DietError("NOT_FOUND", "피드백을 찾을 수 없어요.");
  }

  await prisma.dietFeedback.delete({ where: { id: feedback.id } });
}

/** 회원 목록 화면에 쓸 요약. 공유가 꺼져 있으면 null. */
export async function getMemberDietSummary(
  memberUserId: string,
  shared: boolean,
) {
  if (!shared) return null;

  const [count, latest] = await Promise.all([
    prisma.dietRecord.count({ where: { userId: memberUserId } }),
    prisma.dietRecord.findFirst({
      where: { userId: memberUserId },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      select: { date: true },
    }),
  ]);

  return { count, latestDate: latest?.date ?? null };
}
