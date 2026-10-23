import Link from "next/link";
import { redirect } from "next/navigation";

import { Bell } from "lucide-react";

import { requireUser } from "@/app/lib/dal";
import { TrainerBottomNav } from "@/components/layout/trainer-bottom-nav";
import { getNotificationUnreadCount } from "@/server/notifications/notification.service";

export default async function TrainerLayout({
  children,
}: LayoutProps<"/trainer">) {
  const user = await requireUser();

  /**
   * /trainer는 TrainerProfile이 있는 계정만 사용할 수 있다.
   *
   * 일반 회원이 URL을 직접 입력해도 트레이너 화면에 들어오지 못한다.
   */
  if (!user.isTrainer) {
    redirect("/home");
  }

  const unreadCount = await getNotificationUnreadCount(user.id);

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="sticky top-0 z-40 border-b border-border/70 bg-background/95 shadow-[0_2px_12px_rgba(0,0,0,0.025)] backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-md items-center justify-between gap-3 px-5 py-3.5">
          <div className="min-w-0">
            <p className="truncate text-sm font-bold">
              {user.trainerDisplayName ?? user.name}
            </p>

            <p className="text-xs text-muted-foreground">트레이너</p>
          </div>

          <Link
            href="/trainer/notifications"
            aria-label={
              unreadCount > 0 ? `알림 ${unreadCount}개 읽지 않음` : "알림"
            }
            className="relative flex size-10 shrink-0 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-secondary"
          >
            <Bell className="size-5" aria-hidden />
            {unreadCount > 0 ? (
              <span className="absolute top-2 right-2 size-2 rounded-full bg-brand" />
            ) : null}
          </Link>
        </div>
      </header>

      <div
        className="mx-auto w-full max-w-md flex-1"
        style={{
          paddingBottom: "calc(6.25rem + env(safe-area-inset-bottom))",
        }}
      >
        {children}
      </div>

      <TrainerBottomNav />
    </div>
  );
}
