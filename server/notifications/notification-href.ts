import { NotificationType } from "@/generated/prisma/enums";

/**
 * 알림의 실제 이동 경로를 한 곳에서 결정한다.
 *
 * 알림 DB에는 도메인 ID만 저장하고 URL은 화면 계층에서 만든다.
 * 그래야 나중에 경로가 바뀌어도 기존 알림 데이터를 다시 만들 필요가 없다.
 */
export type NotificationAudience = "MEMBER" | "TRAINER";

export function getNotificationHref(
  notification: {
    type: NotificationType;
    relatedType: string | null;
    relatedId: string | null;
  },
  audience: NotificationAudience = "MEMBER",
) {
  if (audience === "TRAINER") {
    return getTrainerNotificationHref(notification);
  }

  if (notification.relatedType === "DIET_RECORD" && notification.relatedId) {
    return `/diet/${notification.relatedId}`;
  }

  if (notification.relatedType === "JOURNAL" && notification.relatedId) {
    return `/journal/${notification.relatedId}`;
  }

  if (
    notification.relatedType === "JOURNAL_COMMENT" &&
    notification.relatedId
  ) {
    return `/trainer/journals/${notification.relatedId}`;
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

/** 트레이너는 회원 화면을 쓰지 않으므로 트레이너 화면 경로만 돌려준다. */
function getTrainerNotificationHref(notification: {
  relatedType: string | null;
  relatedId: string | null;
}) {
  if (
    notification.relatedType === "JOURNAL_COMMENT" &&
    notification.relatedId
  ) {
    return `/trainer/journals/${notification.relatedId}`;
  }

  if (notification.relatedType === "PT_SESSION") {
    return "/trainer/schedule";
  }

  if (notification.relatedType?.startsWith("PT_CONTRACT")) {
    return "/trainer/members";
  }

  return "/trainer/notifications";
}
