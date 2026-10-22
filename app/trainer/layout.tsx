import { redirect } from "next/navigation";

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
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="sticky top-0 z-40 border-b border-border/70 bg-background/95 shadow-[0_2px_12px_rgba(0,0,0,0.025)] backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-md items-center justify-between gap-3 px-5 py-3.5">
          <div className="min-w-0">
            <p className="truncate text-sm font-bold">
              {user.trainerDisplayName ?? user.name}
            </p>

            <p className="text-xs text-muted-foreground">트레이너</p>
          </div>
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
