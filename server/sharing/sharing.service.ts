import "server-only";

import { ConnectionStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import {
  requireMyMember,
  requireTrainerProfile,
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
 * 내 공유 설정.
 *
 * 담당 트레이너가 없어도 설정은 보여준다. 연결되기 전에 미리 정해 둘 수 있어야
 * 하고, 연결된 순간부터 바로 적용되기 때문이다. 설정을 센터가 아니라 사람에게
 * 매단 이유는, 센터를 옮겼다고 해서 무엇을 보여줄지에 대한 뜻이 초기화되면
 * 안 되기 때문이다.
 */
export async function getMySharing(userId: string) {
  const [row, connection] = await Promise.all([
    prisma.trainerSharingSetting.findUnique({
      where: { userId },
      select,
    }),
    prisma.trainerMemberConnection.findFirst({
      where: { memberUserId: userId, status: ConnectionStatus.ACTIVE },
      orderBy: { startedAt: "desc" },
      select: {
        id: true,
        trainerProfile: {
          select: { displayName: true, user: { select: { name: true } } },
        },
      },
    }),
  ]);

  return {
    connectionId: connection?.id ?? null,
    trainerName: connection
      ? (connection.trainerProfile.displayName ??
        connection.trainerProfile.user.name)
      : null,
    setting: toSetting(row),
  };
}

export async function updateMySharing(userId: string, next: SharingSetting) {
  const row = await prisma.trainerSharingSetting.upsert({
    where: { userId },
    create: { userId, ...next },
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
 *   1. 트레이너 프로필이 있는가
 *   2. 이 연결이 내 것인가
 *   3. 연결이 아직 살아 있는가 — requireMyMember 가 ACTIVE 만 찾는다
 *   4. 회원이 그 종류를 공유하기로 했는가
 *
 * 앞의 셋은 TrainerError 로 "없는 사람" 이라 답하고, 마지막 하나만 "회원이
 * 공유하지 않았다" 고 말한다. 담당 회원이라는 건 트레이너가 이미 아는 사실이라
 * 숨길 이유가 없지만, 담당이 아닌 회원은 존재 자체를 알려선 안 된다.
 *
 * 관계가 끝나면(ENDED) 3번에서 막힌다. 트레이너가 자기 손으로 쓴 알림장은
 * 계속 볼 수 있지만, 회원이 올린 것은 관계가 끝난 순간 닫힌다. 회원이 공유를
 * 켠 상대는 "지금 나를 봐 주는 트레이너" 이지 과거의 아무 트레이너가 아니다.
 *
 * since 는 이 관계가 시작된 날이다. 회원이 그 전에 남긴 기록은 이 트레이너를
 * 염두에 두고 쓴 것이 아니므로, 읽는 쪽에서 이 값으로 잘라야 한다.
 */
export async function assertTrainerCanView(
  trainerUserId: string,
  connectionId: string,
  kind: SharingKind,
) {
  const trainer = await requireTrainerProfile(trainerUserId);
  const member = await requireMyMember(trainer.id, connectionId);

  const row = await prisma.trainerSharingSetting.findUnique({
    where: { userId: member.memberUserId },
    select,
  });

  const setting = toSetting(row);

  if (!setting[FIELD[kind]]) {
    throw new SharingError(
      kind,
      `회원이 ${SHARING_LABEL[kind]}을(를) 공유하지 않았어요.`,
    );
  }

  return { trainer, member, setting, since: member.startedAt };
}

/**
 * 던지지 않고 물어본다.
 *
 * 회원 상세처럼 여러 종류를 한 화면에 늘어놓는 곳에서는 못 보는 칸 하나 때문에
 * 화면 전체가 죽으면 안 된다. 그런 곳은 이걸 쓰고 칸마다 안내를 그린다.
 */
export async function getSharingForTrainer(
  trainerUserId: string,
  connectionId: string,
): Promise<SharingSetting> {
  const trainer = await requireTrainerProfile(trainerUserId);
  const member = await requireMyMember(trainer.id, connectionId);

  const row = await prisma.trainerSharingSetting.findUnique({
    where: { userId: member.memberUserId },
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
  connectionId: string,
  limit = 5,
) {
  const { member, since } = await assertTrainerCanView(
    trainerUserId,
    connectionId,
    "PERSONAL_WORKOUT",
  );

  return getRecentSessions(member.memberUserId, limit, {
    personalOnly: true,
    since,
  });
}
