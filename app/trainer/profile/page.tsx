import { LogOut, Users } from "lucide-react";

import { logout } from "@/app/actions/auth";
import { requireUser } from "@/app/lib/dal";
import { InvitePanel } from "@/app/(user)/profile/invite-panel";
import { prisma } from "@/lib/prisma";
import { listActiveTrainerInvitations } from "@/server/trainers/connection.service";

export const metadata = { title: "내 정보 | FitNote" };

/**
 * 트레이너 내 정보.
 *
 * 회원용 `/profile` 로 보내지 않고 따로 둔 이유는, 거기서 트레이너에게 쓸모
 * 있는 건 초대 코드 하나뿐인데 그 하나가 화면 맨 아래에 있기 때문이다.
 * 회원을 늘리는 게 트레이너가 이 화면에 오는 거의 유일한 이유라, 초대 코드를
 * 맨 위로 올린다.
 *
 * 한 계정은 회원이거나 트레이너 중 하나라 회원 화면으로 넘어가는 길은 없다.
 */
export default async function TrainerProfilePage() {
  const user = await requireUser();

  const [profile, invitations, memberCount] = await Promise.all([
    prisma.trainerProfile.findUnique({
      where: { userId: user.id },
      select: { displayName: true },
    }),
    listActiveTrainerInvitations(user.id),
    prisma.trainerMemberConnection.count({
      where: {
        trainerProfile: { userId: user.id },
        status: "ACTIVE",
      },
    }),
  ]);

  return (
    <main className="px-5 pt-6 pb-16">
      <header className="mb-6">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-brand-strong">
          MY PROFILE
        </p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">내 정보</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          트레이너 계정과 회원 초대를 관리해요.
        </p>
      </header>

      <section className="rounded-3xl border border-border/70 bg-card p-5 shadow-card">
        <div className="flex items-start gap-4">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-accent text-lg font-bold text-brand-strong">
            {(profile?.displayName ?? user.name)?.charAt(0) ?? "T"}
          </div>

          <div className="min-w-0 flex-1">
            <p className="truncate text-lg font-bold tracking-tight">
              {profile?.displayName ?? user.name}
            </p>
            <p className="mt-1 break-all text-sm text-muted-foreground">
              {user.email}
            </p>
          </div>
        </div>

        <div className="mt-5 flex items-center justify-between rounded-2xl bg-secondary/70 px-4 py-3.5">
          <span className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Users className="size-4" aria-hidden />
            담당 회원
          </span>

          <span className="text-xl font-bold tabular-nums">
            {memberCount}
            <span className="ml-1 text-sm font-medium">명</span>
          </span>
        </div>
      </section>

      <div className="mt-4">
        <InvitePanel invitations={invitations} />
      </div>

      <form action={logout} className="mt-3">
        <button
          type="submit"
          className="flex h-11 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          <LogOut className="size-4" aria-hidden />
          로그아웃
        </button>
      </form>
    </main>
  );
}
