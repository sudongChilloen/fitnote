import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { NotificationType } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";

import { getNotificationHref } from "./notification-href";
import { getNotificationAudience } from "./notification-audience";
import { queuePush } from "./push.service";

export { getNotificationHref };

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
  const created = await tx.notification.create({
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

  /*
    푸시는 앱 안 알림이 저장된 *뒤에* 응답이 끝나고 나서 보낸다.

    이 함수는 대부분 트랜잭션 안에서 불린다. 여기서 바로 보내면 아직 커밋되지 않은
    알림을 가리키게 되고, 트랜잭션이 되돌려져도 푸시는 이미 나간 뒤다. after() 는
    응답 뒤에 돌아서 커밋 이후가 보장되고, 롤백되면 행이 없어 보낼 것도 없다.
  */
  queuePush(created.id);

  return created;
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

  return getNotificationHref(
    notification,
    await getNotificationAudience(userId),
  );
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
