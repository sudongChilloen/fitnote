import { prisma } from "@/lib/prisma";

import type { NotificationAudience } from "./notification-href";

/**
 * 알림을 받는 사람이 트레이너인지 회원인지.
 *
 * 한 계정은 하나의 역할만 가진다. 트레이너 프로필이 있으면 트레이너다.
 */
export async function getNotificationAudience(
  userId: string,
): Promise<NotificationAudience> {
  const trainer = await prisma.trainerProfile.findUnique({
    where: { userId },
    select: { id: true },
  });

  return trainer ? "TRAINER" : "MEMBER";
}
