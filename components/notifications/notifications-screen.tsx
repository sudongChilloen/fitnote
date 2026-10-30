import {
  Bell,
  CalendarClock,
  CalendarDays,
  Clock,
  Megaphone,
  NotebookPen,
} from "lucide-react";

import { requireUser } from "@/app/lib/dal";
import { formatKstDateLabel, kstDaysAgo, toKstDateKey } from "@/lib/date";
import {
  getNotifications,
  getNotificationUnreadCount,
} from "@/server/notifications/notification.service";

import {
  markAllNotificationsReadAction,
  openNotificationAction,
} from "@/app/(user)/notifications/actions";

import {
  PUSH_CATEGORIES,
  getDisabledPushTypes,
} from "@/server/notifications/notification-preference.service";

import { BackButton } from "./back-button";
import { PushSettings } from "./push-settings";

const TYPE_ICON = {
  JOURNAL_CREATED: { Icon: NotebookPen, warn: false },
  PT_SESSION_REMINDER: { Icon: Clock, warn: false },
  PT_SESSION_CHANGED: { Icon: CalendarDays, warn: true },
  PT_CONTRACT_EXPIRING: { Icon: CalendarClock, warn: true },
  GENERAL: { Icon: Megaphone, warn: false },
} as const;

function iconOf(type: string) {
  return TYPE_ICON[type as keyof typeof TYPE_ICON] ?? { Icon: Bell, warn: false };
}

/** "10분 전" · "3시간 전" · "어제" · "10월 26일" */
function whenLabel(date: Date, now: Date) {
  const diff = now.getTime() - date.getTime();
  const todayKey = toKstDateKey(now);
  const key = toKstDateKey(date);
  if (key === todayKey) {
    if (diff < 60_000) return "방금";
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}분 전`;
    return `${Math.floor(diff / 3_600_000)}시간 전`;
  }
  if (key === toKstDateKey(kstDaysAgo(1, now))) return "어제";
  return formatKstDateLabel(date).replace(/ \(.\)$/, "");
}

function nowDate() {
  return new Date();
}

/** 회원·트레이너 화면이 함께 쓰는 알림 목록. 이동 경로는 서버가 역할에 맞게 정한다. */
export async function NotificationsScreen() {
  const user = await requireUser();
  const [notifications, unreadCount, disabledTypes] = await Promise.all([
    getNotifications(user.id),
    getNotificationUnreadCount(user.id),
    getDisabledPushTypes(user.id),
  ]);

  const categories = PUSH_CATEGORIES[user.isTrainer ? "TRAINER" : "MEMBER"];
  const now = nowDate();
  const todayKey = toKstDateKey(now);
  const groups = [
    { label: "오늘", items: notifications.filter((n) => toKstDateKey(n.createdAt) === todayKey) },
    { label: "이전", items: notifications.filter((n) => toKstDateKey(n.createdAt) !== todayKey) },
  ].filter((group) => group.items.length > 0);

  return (
    <main className="flex flex-col pb-8">
      <header className="flex items-center gap-2.5 px-4 pt-3.5 pb-2">
        <BackButton />
        <h1 className="min-w-0 flex-1 text-[1.0625rem] font-bold">
          알림
          {unreadCount > 0 ? (
            <span className="ml-1.5 text-[0.8125rem] font-semibold text-muted-foreground tabular-nums">
              {unreadCount}개 안 읽음
            </span>
          ) : null}
        </h1>
        {unreadCount > 0 ? (
          <form action={markAllNotificationsReadAction} className="shrink-0">
            <button type="submit" className="text-[0.8125rem] font-bold text-primary">
              모두 읽음
            </button>
          </form>
        ) : null}
      </header>

      <div className="flex flex-col px-4 pt-1">
        {notifications.length === 0 ? (
          <div className="mt-4 flex flex-col items-center rounded-[1.25rem] bg-[#f7f8f7] px-6 py-12 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-brand-muted text-primary">
              <Bell className="size-5" aria-hidden />
            </span>
            <h2 className="mt-4 text-sm font-bold">아직 알림이 없어요</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              알림장, 식단 피드백, 수업 변경 소식이 여기에 쌓여요.
            </p>
          </div>
        ) : (
          groups.map((group) => (
            <section key={group.label}>
              <h2 className="mx-1 mt-3 mb-0.5 text-[0.8125rem] font-bold text-muted-foreground">
                {group.label}
              </h2>
              <ul>
                {group.items.map((notification) => {
                  const { Icon, warn } = iconOf(notification.type);
                  return (
                    <li key={notification.id}>
                      <form action={openNotificationAction}>
                        <input type="hidden" name="notificationId" value={notification.id} />
                        <button
                          type="submit"
                          className="flex w-full gap-3 border-b border-line px-1 py-3 text-left"
                        >
                          <span
                            className={`flex size-9.5 shrink-0 items-center justify-center rounded-xl ${
                              warn ? "bg-status-urgent-bg text-status-urgent" : "bg-brand-muted text-primary"
                            }`}
                          >
                            <Icon className="size-4.5" strokeWidth={1.9} aria-hidden />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="flex items-center gap-1.5">
                              <b className="min-w-0 flex-1 truncate text-sm">{notification.title}</b>
                              <span className="shrink-0 text-[0.6875rem] text-faint">
                                {whenLabel(notification.createdAt, now)}
                              </span>
                            </span>
                            <span className="mt-0.5 block text-xs leading-normal text-muted-foreground">
                              {notification.message}
                            </span>
                          </span>
                          <span
                            className={`mt-1.5 size-1.75 shrink-0 rounded-full ${
                              notification.isRead ? "bg-transparent" : "bg-primary"
                            }`}
                            aria-label={notification.isRead ? undefined : "읽지 않음"}
                          />
                        </button>
                      </form>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))
        )}

        {/* 푸시 알림 설정. 목록을 먼저 보고 필요한 사람만 내려와서 바꾼다. */}
        <div className="mt-4">
          <PushSettings categories={categories} disabled={disabledTypes} />
        </div>
      </div>
    </main>
  );
}
