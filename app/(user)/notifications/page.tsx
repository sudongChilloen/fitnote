import { Bell, CheckCheck, ChevronRight } from "lucide-react";

import { requireUser } from "@/app/lib/dal";
import { formatKstDateLabel, formatKstTimeLabel } from "@/lib/date";
import {
  getNotifications,
  getNotificationUnreadCount,
} from "@/server/notifications/notification.service";

import {
  markAllNotificationsReadAction,
  openNotificationAction,
} from "./actions";

export const metadata = {
  title: "알림 | FitNote",
};

export default async function NotificationsPage() {
  const user = await requireUser();
  const [notifications, unreadCount] = await Promise.all([
    getNotifications(user.id),
    getNotificationUnreadCount(user.id),
  ]);

  return (
    <main className="flex flex-col px-5 pt-8 pb-8">
      <header className="flex items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Bell className="size-5 text-brand-strong" aria-hidden />
            <h1 className="text-2xl font-bold tracking-tight">알림</h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {unreadCount > 0 ? `읽지 않은 알림 ${unreadCount}개` : "새로운 알림이 없어요"}
          </p>
        </div>

        {unreadCount > 0 ? (
          <form action={markAllNotificationsReadAction}>
            <button
              type="submit"
              className="inline-flex h-9 items-center gap-1.5 rounded-xl px-2.5 text-xs font-semibold text-muted-foreground hover:bg-secondary"
            >
              <CheckCheck className="size-4" aria-hidden />
              모두 읽음
            </button>
          </form>
        ) : null}
      </header>

      {notifications.length === 0 ? (
        <div className="mt-10 flex flex-col items-center rounded-2xl border border-border bg-card px-6 py-12 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-secondary text-muted-foreground">
            <Bell className="size-5" aria-hidden />
          </span>
          <h2 className="mt-4 text-sm font-bold">아직 알림이 없어요</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            알림장, 식단 피드백, 수업 변경 소식이 여기에 쌓여요.
          </p>
        </div>
      ) : (
        <ul className="mt-5 flex flex-col gap-2">
          {notifications.map((notification) => {
            return (
              <li key={notification.id}>
                <form action={openNotificationAction}>
                  <input
                    type="hidden"
                    name="notificationId"
                    value={notification.id}
                  />

                  <button
                    type="submit"
                    className={`flex w-full items-start gap-3 rounded-2xl border p-4 text-left transition-colors hover:bg-secondary ${
                      notification.isRead
                        ? "border-border bg-card"
                        : "border-brand/30 bg-accent/30"
                    }`}
                  >
                    <span
                      className={`mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl ${
                        notification.isRead
                          ? "bg-secondary text-muted-foreground"
                          : "bg-brand text-brand-foreground"
                      }`}
                    >
                      <Bell className="size-4" aria-hidden />
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5">
                        <span className="text-sm font-bold">{notification.title}</span>
                        {!notification.isRead ? (
                          <span className="size-1.5 shrink-0 rounded-full bg-brand" aria-label="읽지 않음" />
                        ) : null}
                      </span>

                      <span className="mt-1 block text-sm leading-relaxed text-foreground/85">
                        {notification.message}
                      </span>

                      <span className="mt-2 block text-xs text-muted-foreground">
                        {formatKstDateLabel(notification.createdAt)} · {formatKstTimeLabel(notification.createdAt)}
                      </span>
                    </span>

                    <ChevronRight className="mt-1 size-4 shrink-0 text-muted-foreground" aria-hidden />
                  </button>
                </form>

              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
