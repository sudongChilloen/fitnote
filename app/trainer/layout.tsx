import Link from "next/link";
import { redirect } from "next/navigation";

import { ArrowLeftRight } from "lucide-react";

import { requireUser } from "@/app/lib/dal";
import { prisma } from "@/lib/prisma";

/**
 * 트레이너 화면 셸.
 *
 * 트레이너 프로필이 없으면 회원 홈으로 돌려보낸다. 센터 소속은 보지 않는다 —
 * 혼자 하는 트레이너도 여기서 회원을 관리하기 때문이다. 여기서 막는 건 화면을
 * 숨기는 용도일 뿐이고, 실제 차단은 서비스 함수마다 다시 확인한다. 주소만 알면
 * 들어올 수 있는 화면이라 한 곳에서만 막으면 언젠가 새어 나간다.
 */
export default async function TrainerLayout({
  children,
}: LayoutProps<"/trainer">) {
  const user = await requireUser();
  const profile = await prisma.trainerProfile.findUnique({
    where: { userId: user.id },
    select: { displayName: true },
  });

  if (!profile) {
    redirect("/home");
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-md items-center justify-between px-5 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-bold">
              {profile.displayName ?? user.name}
            </p>
            <p className="text-xs text-muted-foreground">트레이너</p>
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
