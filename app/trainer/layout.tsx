import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeftRight } from "lucide-react";

import { requireUser } from "@/app/lib/dal";
import { TrainerBottomNav } from "@/components/layout/trainer-bottom-nav";

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

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-md items-center justify-between px-5 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-bold">
              {user.trainerDisplayName ?? user.name}
            </p>

            <p className="text-xs text-muted-foreground">
              트레이너
            </p>
          </div>

          {user.isMember ? (
            <Link
              href="/home"
              className="flex shrink-0 items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-semibold"
            >
              <ArrowLeftRight
                className="size-3.5"
                aria-hidden
              />
              회원 화면
            </Link>
          ) : null}
        </div>
      </header>

      <div
        className="mx-auto w-full max-w-md flex-1"
        style={{
          paddingBottom:
            "calc(4.25rem + env(safe-area-inset-bottom))",
        }}
      >
        {children}
      </div>

      <TrainerBottomNav />
    </div>
  );
}