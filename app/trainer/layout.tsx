import Link from "next/link";
import { redirect } from "next/navigation";

import { ArrowLeftRight } from "lucide-react";

import { requireUser } from "@/app/lib/dal";
import {
  canActAsTrainer,
  getCurrentMembership,
} from "@/server/centers/center.service";

/**
 * 트레이너 화면 셸.
 *
 * 담당이 아닌 사람이 들어오면 회원 홈으로 돌려보낸다. 여기서 막는 건 화면을
 * 숨기는 용도일 뿐이고, 실제 차단은 서비스 함수마다 다시 확인한다. 주소만 알면
 * 들어올 수 있는 화면이라 한 곳에서만 막으면 언젠가 새어 나간다.
 */
export default async function TrainerLayout({
  children,
}: LayoutProps<"/trainer">) {
  const user = await requireUser();
  const membership = await getCurrentMembership(user.id);

  if (!membership || !canActAsTrainer(membership)) {
    redirect("/home");
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-md items-center justify-between px-5 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-bold">
              {membership.center.name}
            </p>
            <p className="text-xs text-muted-foreground">
              {membership.role === "CENTER_ADMIN" ? "관리자" : "트레이너"} ·{" "}
              {user.name}
            </p>
          </div>

          <Link
            href="/home"
            className="flex shrink-0 items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-semibold"
          >
            <ArrowLeftRight className="size-3.5" aria-hidden />
            회원 화면
          </Link>
        </div>
      </header>

      <div className="mx-auto w-full max-w-md flex-1">{children}</div>
    </div>
  );
}
