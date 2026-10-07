import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { NotificationType } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";

export type NotificationTx = Prisma.TransactionClient;

export async function createNotification(
  tx: NotificationTx,
  input: {
    userId: string;
    type: NotificationType;
    title: string;
    message: string;
    relatedType?: string | null;
    relatedId?: string | null;
  },
) {
  return tx.notification.create({
    data: {
      userId: input.userId,
      type: input.type,
      title: input.title,
      message: input.message,
      relatedType: input.relatedType ?? null,
      relatedId: input.relatedId ?? null,
    },
    select: { id: true },
  });
}

export type NotificationRow = {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  relatedType: string | null;
  relatedId: string | null;
  isRead: boolean;
  readAt: Date | null;
  createdAt: Date;
};

/**
 * 알림의 실제 이동 경로를 한 곳에서 결정한다.
 *
 * 알림 DB에는 도메인 ID만 저장하고 URL은 화면 계층에서 만든다.
 * 그래야 나중에 경로가 바뀌어도 기존 알림 데이터를 다시 만들 필요가 없다.
 */
export function getNotificationHref(notification: {
  type: NotificationType;
  relatedType: string | null;
  relatedId: string | null;
}) {
  if (notification.relatedType === "DIET_RECORD" && notification.relatedId) {
    return `/diet/${notification.relatedId}`;
  }

  if (notification.relatedType === "JOURNAL" && notification.relatedId) {
    return `/journal/${notification.relatedId}`;
  }

  if (notification.relatedType === "PT_SESSION" && notification.relatedId) {
    return `/sessions`;
  }

  if (
    notification.type === NotificationType.JOURNAL_CREATED &&
    notification.relatedId
  ) {
    return `/journal/${notification.relatedId}`;
  }

  if (
    notification.type === NotificationType.PT_SESSION_CHANGED ||
    notification.type === NotificationType.PT_SESSION_REMINDER ||
    notification.type === NotificationType.PT_CONTRACT_EXPIRING
  ) {
    return "/sessions";
  }

  return "/notifications";
}

export async function getNotifications(
  userId: string,
  limit = 50,
): Promise<NotificationRow[]> {
  return prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      type: true,
      title: true,
      message: true,
      relatedType: true,
      relatedId: true,
      isRead: true,
      readAt: true,
      createdAt: true,
    },
  });
}

export async function getNotificationUnreadCount(userId: string) {
  return prisma.notification.count({
    where: {
      userId,
      isRead: false,
    },
  });
}

export async function markNotificationRead(
  userId: string,
  notificationId: string,
) {
  const notification = await prisma.notification.findFirst({
    where: {
      id: notificationId,
      userId,
    },
    select: {
      id: true,
      type: true,
      relatedType: true,
      relatedId: true,
      isRead: true,
    },
  });

  if (!notification) {
    throw new Error("알림을 찾을 수 없어요.");
  }

  if (!notification.isRead) {
    await prisma.notification.updateMany({
      where: {
        id: notification.id,
        userId,
        isRead: false,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });
  }

  return getNotificationHref(notification);
}

export async function markAllNotificationsRead(userId: string) {
  await prisma.notification.updateMany({
    where: {
      userId,
      isRead: false,
    },
    data: {
      isRead: true,
      readAt: new Date(),
    },
  });
}
