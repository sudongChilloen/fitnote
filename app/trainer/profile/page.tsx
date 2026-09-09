import Link from "next/link";

import { ArrowLeftRight, LogOut, Users } from "lucide-react";

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
 * 회원 화면으로 넘어가는 길은 남긴다. 트레이너도 자기 운동을 기록한다.
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
    <main className="px-5 pt-5 pb-16">
      <h1 className="text-xl font-bold">내 정보</h1>

      <section className="mt-4 rounded-2xl border border-border bg-card p-5">
        <p className="text-lg font-bold">{profile?.displayName ?? user.name}</p>
        <p className="mt-0.5 text-sm text-muted-foreground">{user.email}</p>
        <p className="mt-3 flex items-center gap-1.5 text-sm text-muted-foreground">
          <Users className="size-4" aria-hidden />
          담당 회원{" "}
          <span className="font-bold text-foreground tabular-nums">
            {memberCount}
          </span>
          명
        </p>
      </section>

      <div className="mt-4">
        <InvitePanel invitations={invitations} />
      </div>

      <section className="mt-4 rounded-2xl border border-border bg-card p-5">
        <h2 className="text-sm font-bold">회원 화면</h2>
        <p className="mt-1 mb-2 text-xs text-muted-foreground">
          내 운동 기록과 캘린더는 회원 화면에 있어요.
        </p>
        <Link
          href="/home"
          className="inline-flex h-11 items-center gap-1.5 rounded-xl border border-border px-4 text-sm font-bold"
        >
          <ArrowLeftRight className="size-4" aria-hidden />
          회원 화면으로
        </Link>
      </section>

      <Link
        href="/profile"
        className="mt-4 flex h-11 items-center justify-center gap-1.5 rounded-xl text-sm font-semibold text-muted-foreground"
      >
        <LogOut className="size-4" aria-hidden />
        계정 설정
      </Link>
    </main>
  );
}
