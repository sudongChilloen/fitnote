import { NotificationType } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";

import type { NotificationAudience } from "./notification-href";

/**
 * 푸시 설정 화면에 보여주는 알림 종류.
 *
 * 아직 만들어지지 않는 종류(수업 알림, 이용권 만료)는 뺐다. 켜고 끌 수 있어도
 * 받을 알림이 없으면 "이걸 왜 끄지" 만 남는다.
 */
export const PUSH_CATEGORIES: Record<
  NotificationAudience,
  { type: NotificationType; label: string; hint: string }[]
> = {
  MEMBER: [
    {
      type: NotificationType.JOURNAL_CREATED,
      label: "새 알림장",
      hint: "트레이너가 알림장을 남겼을 때",
    },
    {
      type: NotificationType.PT_SESSION_CHANGED,
      label: "수업 변경",
      hint: "수업 일정이 바뀌거나 취소됐을 때",
    },
    {
      type: NotificationType.GENERAL,
      label: "댓글",
      hint: "알림장에 댓글이 달렸을 때",
    },
  ],
  TRAINER: [
    {
      type: NotificationType.GENERAL,
      label: "댓글",
      hint: "회원이 알림장에 댓글을 남겼을 때",
    },
  ],
};

export class PreferenceError extends Error {}

/** 푸시를 끈 종류. 행이 없으면 켜진 것이다. */
export async function getDisabledPushTypes(
  userId: string,
): Promise<NotificationType[]> {
  const rows = await prisma.notificationPreference.findMany({
    where: { userId, pushEnabled: false },
    select: { type: true },
  });

  return rows.map((row) => row.type);
}

export async function isPushEnabledFor(
  userId: string,
  type: NotificationType,
): Promise<boolean> {
  const row = await prisma.notificationPreference.findUnique({
    where: { userId_type: { userId, type } },
    select: { pushEnabled: true },
  });

  return row?.pushEnabled ?? true;
}

export async function setPushPreference(
  userId: string,
  type: unknown,
  enabled: unknown,
) {
  // 서버 액션 인자는 누구나 바꿔 보낼 수 있다.
  if (
    typeof type !== "string" ||
    !(Object.values(NotificationType) as string[]).includes(type) ||
    typeof enabled !== "boolean"
  ) {
    throw new PreferenceError("알림 설정 값이 올바르지 않아요.");
  }

  const safeType = type as NotificationType;

  await prisma.notificationPreference.upsert({
    where: { userId_type: { userId, type: safeType } },
    create: { userId, type: safeType, pushEnabled: enabled },
    update: { pushEnabled: enabled },
    select: { id: true },
  });
}
