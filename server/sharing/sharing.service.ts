import "server-only";

import { MembershipStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { getCurrentMembership } from "@/server/centers/center.service";
import {
  TrainerError,
  requireMyMember,
  requireTrainerMembership,
} from "@/server/trainers/trainer.service";
import { getRecentSessions } from "@/server/workouts/workout.service";

/**
 * 회원이 담당 트레이너에게 무엇까지 보여줄지.
 *
 * 트레이너 화면에서 회원의 기록을 읽는 곳은 전부 여기를 지나게 한다. 화면마다
 * 조건을 따로 적으면 언젠가 한 곳이 빠지고, 그 한 곳이 사고가 된다.
 */

export type SharingKind = "DIET" | "DIET_PHOTO" | "PERSONAL_WORKOUT" | "BODY";

export interface SharingSetting {
  shareDiet: boolean;
  shareDietPhoto: boolean;
  sharePersonalWorkout: boolean;
  shareBody: boolean;
}

/**
 * 설정을 만든 적이 없는 회원의 값.
 *
 * 스키마의 기본값과 같아야 한다. 여기만 고치면 이미 한 번 저장한 회원과 아직
 * 저장한 적 없는 회원의 동작이 갈린다.
 */
export const DEFAULT_SHARING: SharingSetting = {
  shareDiet: true,
  shareDietPhoto: true,
  sharePersonalWorkout: false,
  shareBody: false,
};

const FIELD: Record<SharingKind, keyof SharingSetting> = {
  DIET: "shareDiet",
  DIET_PHOTO: "shareDietPhoto",
  PERSONAL_WORKOUT: "sharePersonalWorkout",
  BODY: "shareBody",
};

export const SHARING_LABEL: Record<SharingKind, string> = {
  DIET: "식단",
  DIET_PHOTO: "식단 사진",
  PERSONAL_WORKOUT: "개인 운동 기록",
  BODY: "체중 · 체성분",
};

const select = {
  shareDiet: true,
  shareDietPhoto: true,
  sharePersonalWorkout: true,
  shareBody: true,
} as const;

function toSetting(row: SharingSetting | null): SharingSetting {
  return row
    ? {
        shareDiet: row.shareDiet,
        shareDietPhoto: row.shareDietPhoto,
        sharePersonalWorkout: row.sharePersonalWorkout,
        shareBody: row.shareBody,
      }
    : { ...DEFAULT_SHARING };
}

/**
 * 내 공유 설정. 센터에 속하지 않았으면 null.
 *
 * 담당 트레이너가 없어도 설정은 보여준다. 배정을 기다리는 동안 미리 정해 둘 수
 * 있어야 하고, 배정된 순간부터 바로 적용되기 때문이다. 대신 화면에서 "아직 담당
 * 트레이너가 없다" 고 알려 준다.
 */
export async function getMySharing(userId: string) {
  const membership = await getCurrentMembership(userId);

  if (!membership) return null;

  const row = await prisma.trainerSharingSetting.findUnique({
    where: { membershipId: membership.id },
    select,
  });

  return {
    membershipId: membership.id,
    centerName: membership.center.name,
    trainerName: membership.assignedTrainerMembership?.user.name ?? null,
    setting: toSetting(row),
  };
}

export async function updateMySharing(userId: string, next: SharingSetting) {
  const membership = await getCurrentMembership(userId);

  if (!membership) {
    throw new TrainerError("NOT_FOUND", "소속된 센터가 없어요.");
  }

  const row = await prisma.trainerSharingSetting.upsert({
    where: { membershipId: membership.id },
    create: { membershipId: membership.id, ...next },
    update: next,
    select,
  });

  return toSetting(row);
}

export class SharingError extends Error {
  constructor(
    readonly kind: SharingKind,
    message: string,
  ) {
    super(message);
    this.name = "SharingError";
  }
}

/**
 * 트레이너가 이 회원의 이 기록을 볼 수 있는가. 못 보면 던진다.
 *
 * 네 단계를 모두 지나야 한다.
 *   1. 트레이너로 활동 중인 소속인가
 *   2. 이 회원이 내 담당인가 (관리자도 예외 없음)
 *   3. 회원이 아직 이 센터에 있는가 — requireMyMember 가 ACTIVE 만 찾는다
 *   4. 회원이 그 종류를 공유하기로 했는가
 *
 * 앞의 셋은 TrainerError 로 "없는 사람" 이라 답하고, 마지막 하나만 "회원이
 * 공유하지 않았다" 고 말한다. 담당 회원이라는 건 트레이너가 이미 아는 사실이라
 * 숨길 이유가 없지만, 담당이 아닌 회원은 존재 자체를 알려선 안 된다.
 */
export async function assertTrainerCanView(
  trainerUserId: string,
  memberMembershipId: string,
  kind: SharingKind,
) {
  const trainer = await requireTrainerMembership(trainerUserId);
  const member = await requireMyMember(trainer.id, memberMembershipId);

  const row = await prisma.trainerSharingSetting.findUnique({
    where: { membershipId: memberMembershipId },
    select,
  });

  const setting = toSetting(row);

  if (!setting[FIELD[kind]]) {
    throw new SharingError(
      kind,
      `회원이 ${SHARING_LABEL[kind]}을(를) 공유하지 않았어요.`,
    );
  }

  return { trainer, member, setting };
}

/**
 * 던지지 않고 물어본다.
 *
 * 회원 상세처럼 여러 종류를 한 화면에 늘어놓는 곳에서는 못 보는 칸 하나 때문에
 * 화면 전체가 죽으면 안 된다. 그런 곳은 이걸 쓰고 칸마다 안내를 그린다.
 */
export async function getSharingForTrainer(
  trainerUserId: string,
  memberMembershipId: string,
): Promise<SharingSetting> {
  const trainer = await requireTrainerMembership(trainerUserId);

  const member = await prisma.centerMembership.findFirst({
    where: {
      id: memberMembershipId,
      assignedTrainerMembershipId: trainer.id,
      status: MembershipStatus.ACTIVE,
    },
    select: { id: true },
  });

  if (!member) {
    throw new TrainerError("NOT_MY_MEMBER", "담당 회원이 아니에요.");
  }

  const row = await prisma.trainerSharingSetting.findUnique({
    where: { membershipId: memberMembershipId },
    select,
  });

  return toSetting(row);
}

/**
 * 회원이 혼자 한 운동. 공유를 켜지 않았으면 던진다.
 *
 * 화면에서 이미 설정을 확인하더라도 여기서 한 번 더 막는다. 남의 기록을 읽는
 * 통로는 화면의 조건문이 아니라 서비스가 지켜야 한다.
 */
export async function getMemberPersonalWorkouts(
  trainerUserId: string,
  memberMembershipId: string,
  limit = 5,
) {
  const { member } = await assertTrainerCanView(
    trainerUserId,
    memberMembershipId,
    "PERSONAL_WORKOUT",
  );

  return getRecentSessions(member.user.id, limit, { personalOnly: true });
}
