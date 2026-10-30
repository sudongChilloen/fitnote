import { requireUser } from "@/app/lib/dal";
import {
  getTrainerHome,
  memberContractGroup,
} from "@/server/trainers/trainer.service";
import type { TrainerManagementStatus } from "@/server/trainers/trainer.service";

import { InvitePanel } from "@/app/(user)/profile/invite-panel";
import { listActiveTrainerInvitations } from "@/server/trainers/connection.service";
import { getTrainerWeek } from "@/server/trainers/trainer-board.service";
import { Search } from "lucide-react";

import { MemberCard, NoMembers } from "../member-card";
import { AddMemberDrawer } from "./add-member-drawer";
import { MemberFilterChips } from "./filter-chips";
import { parseMemberFilter, type MemberFilter } from "./member-filter";
import Link from "next/link";

export const metadata = { title: "회원 | FitNote" };

/**
 * 담당 회원 목록.
 *
 * 회원 목록에서는 계약 상태와 관리 상태를 분리해서 필터링한다.
 *
 * - 계약 상태: PT 중 / 마감 임박 / 계약 없음
 * - 관리 상태: 정상 / 확인 필요 / 즉시 확인
 *
 * 두 필터는 함께 사용할 수 있다.
 *
 * 예:
 * /trainer/members?filter=pt&status=attention
 */
export default async function TrainerMembersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [user, query] = await Promise.all([requireUser(), searchParams]);

  const [home, week, invitations] = await Promise.all([
    getTrainerHome(user.id),
    getTrainerWeek(user.id),
    listActiveTrainerInvitations(user.id),
  ]);
  const search = typeof query.q === "string" ? query.q.trim() : "";
  const weekSessions = week.days.reduce((sum, day) => sum + day.count, 0);

  const filter = parseMemberFilter(query.filter);

  const counts: Record<MemberFilter, number> = {
    all: home.members.length,
    attention: home.members.filter(
      (member) =>
        member.managementStatus === "urgent" ||
        member.managementStatus === "attention",
    ).length,
    soon: home.members.filter(
      (member) => memberContractGroup(member) === "soon",
    ).length,
  };

  const priority: Record<TrainerManagementStatus, number> = {
    urgent: 0,
    attention: 1,
    normal: 2,
  };

  const shown = home.members
    .filter((member) => (search ? member.name.includes(search) : true))
    .filter((member) => {
      if (filter === "attention") {
        return (
          member.managementStatus === "urgent" ||
          member.managementStatus === "attention"
        );
      }

      if (filter === "soon") {
        return memberContractGroup(member) === "soon";
      }

      return true;
    })
    .sort((a, b) => {
      const statusOrder =
        priority[a.managementStatus] - priority[b.managementStatus];

      if (statusOrder !== 0) {
        return statusOrder;
      }

      const aSoon = memberContractGroup(a) === "soon" ? 0 : 1;
      const bSoon = memberContractGroup(b) === "soon" ? 0 : 1;

      return aSoon - bSoon;
    });

  return (
    <main className="flex flex-col pb-6">
      <header className="flex items-center gap-2 py-3.5 pr-4 pl-5">
        <h1 className="min-w-0 flex-1 text-xl font-extrabold">
          회원{" "}
          <span className="text-sm font-semibold text-muted-foreground tabular-nums">
            {home.members.length}명
          </span>
        </h1>
        <AddMemberDrawer />
      </header>

      <div className="flex flex-col gap-3 px-4 pt-1.5">
        {home.members.length === 0 ? (
          <NoMembers />
        ) : (
          <>
            <form action="/trainer/members" className="flex h-11.5 items-center gap-2 rounded-full bg-surface px-4">
              <Search className="size-4.5 shrink-0 text-faint" aria-hidden />
              {filter !== "all" ? <input type="hidden" name="filter" value={filter} /> : null}
              <input
                type="search"
                name="q"
                defaultValue={search}
                placeholder="이름으로 찾기"
                aria-label="회원 이름으로 찾기"
                className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-faint"
              />
            </form>

            <MemberFilterChips current={filter} counts={counts} />

            <div className="grid grid-cols-3 gap-2">
              {[
                { k: "이번 주 수업", v: `${weekSessions}회`, c: "text-ink" },
                { k: "확인 필요", v: `${counts.attention}명`, c: "text-primary" },
                { k: "곧 만료", v: `${counts.soon}명`, c: counts.soon > 0 ? "text-status-urgent" : "text-ink" },
              ].map((stat) => (
                <span key={stat.k} className="min-w-0 rounded-2xl bg-[#f7f8f7] px-3 py-2.5">
                  <span className="block truncate text-[0.6875rem] text-muted-foreground">{stat.k}</span>
                  <b className={`block text-lg tabular-nums ${stat.c}`}>{stat.v}</b>
                </span>
              ))}
            </div>

            {shown.length === 0 ? (
              <div className="rounded-[1.25rem] bg-[#f7f8f7] px-5 py-9 text-center">
                <p className="text-sm font-bold">해당 조건의 회원이 없어요</p>
                <p className="mx-auto mt-2 max-w-xs text-xs leading-relaxed text-muted-foreground">
                  {search ? `"${search}" 이름의 회원이 없어요.` : "다른 필터를 골라 보세요."}
                </p>
                <Link
                  href="/trainer/members"
                  className="mt-4 inline-flex h-10 items-center justify-center rounded-full bg-ink px-5 text-sm font-bold text-white"
                >
                  전체 회원 보기
                </Link>
              </div>
            ) : (
              <ul className="flex flex-col">
                {shown.map((member) => (
                  <MemberCard key={member.connectionId} member={member} variant="bar" />
                ))}
              </ul>
            )}
          </>
        )}

        <div className="mt-1">
          <InvitePanel invitations={invitations} />
        </div>
      </div>
    </main>
  );
}
