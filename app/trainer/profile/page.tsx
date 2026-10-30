import Link from "next/link";

import { Bell, ChevronRight, LogOut } from "lucide-react";

import { logout } from "@/app/actions/auth";
import { requireUser } from "@/app/lib/dal";
import { InvitePanel } from "@/app/(user)/profile/invite-panel";
import { kstMonthRange, toKstDateKey } from "@/lib/date";
import { prisma } from "@/lib/prisma";
import { listActiveTrainerInvitations } from "@/server/trainers/connection.service";

export const metadata = { title: "내 정보 | FitNote" };

function monthStart() {
  return kstMonthRange(toKstDateKey(new Date()).slice(0, 7)).start;
}

/**
 * 트레이너 내 정보 (v3).
 *
 * 회원을 늘리는 게 트레이너가 이 화면에 오는 가장 큰 이유라 초대 코드를 위쪽에
 * 둔다. 이번 달 숫자는 이미 쌓인 수업·알림장에서 센다.
 *
 * 한 계정은 회원이거나 트레이너 중 하나라 회원 화면으로 넘어가는 길은 없다.
 */
export default async function TrainerProfilePage() {
  const user = await requireUser();
  const since = monthStart();
  const month = Number(toKstDateKey(new Date()).slice(5, 7));

  const [profile, invitations, memberCount, sessionCount, journalCount] = await Promise.all([
    prisma.trainerProfile.findUnique({
      where: { userId: user.id },
      select: { displayName: true, bio: true, specialty: true, careerYears: true },
    }),
    listActiveTrainerInvitations(user.id),
    prisma.trainerMemberConnection.count({
      where: { trainerProfile: { userId: user.id }, status: "ACTIVE" },
    }),
    prisma.pTSession.count({
      where: {
        trainerProfile: { userId: user.id },
        status: "COMPLETED",
        scheduledAt: { gte: since },
      },
    }),
    prisma.journal.count({
      where: {
        trainerProfile: { userId: user.id },
        status: "PUBLISHED",
        publishedAt: { gte: since },
      },
    }),
  ]);

  const name = profile?.displayName ?? user.name;
  const specialties = (profile?.specialty ?? "")
    .split(/[,·/]/)
    .map((item) => item.trim())
    .filter(Boolean);

  return (
    <main className="flex flex-col gap-3 px-4 pt-5 pb-6">
      <header className="flex items-center gap-3 px-1 pb-1">
        <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-ink text-xl font-extrabold text-brand">
          {name.charAt(0) || "T"}
        </span>
        <span className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-extrabold">{name}</h1>
          <p className="truncate text-xs text-muted-foreground">{user.email}</p>
        </span>
      </header>

      <section className="rounded-[1.375rem] bg-primary px-4.5 py-4 text-white">
        <span className="block text-xs text-white/75">이번 달 · {month}월</span>
        <div className="mt-2.5 grid grid-cols-3 gap-1.5">
          {[
            ["진행 수업", `${sessionCount}회`],
            ["보낸 알림장", `${journalCount}개`],
            ["담당 회원", `${memberCount}명`],
          ].map(([label, value]) => (
            <span key={label} className="min-w-0 rounded-[0.875rem] bg-white/10 px-2.5 py-2">
              <span className="block truncate text-[0.6875rem] text-white/70">{label}</span>
              <b className="block truncate text-[1.0625rem] tabular-nums">{value}</b>
            </span>
          ))}
        </div>
      </section>

      {specialties.length > 0 || profile?.bio || profile?.careerYears ? (
        <section className="rounded-[1.25rem] border border-border px-4 py-3.5">
          <b className="block text-[0.9375rem]">소개</b>
          {specialties.length > 0 || profile?.careerYears ? (
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {specialties.map((item) => (
                <span
                  key={item}
                  className="rounded-full bg-brand-muted px-2.75 py-1.25 text-xs font-bold whitespace-nowrap text-primary"
                >
                  {item}
                </span>
              ))}
              {profile?.careerYears ? (
                <span className="rounded-full bg-surface px-2.75 py-1.25 text-xs font-bold whitespace-nowrap text-[#4b5650]">
                  경력 {profile.careerYears}년
                </span>
              ) : null}
            </div>
          ) : null}
          {profile?.bio ? (
            <p className="mt-2.5 text-[0.8125rem] leading-relaxed whitespace-pre-wrap text-[#4b5650]">
              {profile.bio}
            </p>
          ) : null}
        </section>
      ) : null}

      <InvitePanel invitations={invitations} />

      <Link
        href="/trainer/notifications"
        className="flex items-center gap-3 rounded-[1.25rem] border border-border p-3.5"
      >
        <span className="flex size-9.5 shrink-0 items-center justify-center rounded-xl bg-brand-muted text-primary">
          <Bell className="size-4.75" strokeWidth={1.9} aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <b className="block text-sm">알림 · 푸시 설정</b>
          <span className="block truncate text-xs text-muted-foreground">
            받은 알림과 푸시 받을 종류
          </span>
        </span>
        <ChevronRight className="size-4 shrink-0 text-faint" aria-hidden />
      </Link>

      <form action={logout}>
        <button
          type="submit"
          className="flex h-11.5 w-full items-center justify-center gap-2 rounded-full text-sm font-semibold text-muted-foreground transition-colors hover:bg-surface hover:text-foreground"
        >
          <LogOut className="size-4" aria-hidden />
          로그아웃
        </button>
      </form>
    </main>
  );
}
