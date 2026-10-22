import { requireUser } from "@/app/lib/dal";
import {
  getTrainerHome,
  memberContractGroup,
} from "@/server/trainers/trainer.service";
import type { TrainerManagementStatus } from "@/server/trainers/trainer.service";

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

  const home = await getTrainerHome(user.id);

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
    <main className="px-5 pb-16 pt-6">
      {/* 페이지 헤더 */}
      <header className="mb-7">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-brand-strong">
              MEMBER MANAGEMENT
            </p>

            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight">담당 회원</h1>

              <span className="inline-flex items-center rounded-full bg-secondary px-2.5 py-1 text-xs font-bold tabular-nums text-foreground">
                {home.members.length}명
              </span>
            </div>

            <p className="mt-2 max-w-[260px] text-sm leading-relaxed text-muted-foreground">
              회원 현황과 관리가 필요한 항목을 확인해요.
            </p>
          </div>

          <div className="shrink-0 pt-1">
            <AddMemberDrawer />
          </div>
        </div>
      </header>

      {home.members.length === 0 ? (
        <NoMembers />
      ) : (
        <>
          <MemberFilterChips current={filter} counts={counts} />

          {/* 결과 */}
          {shown.length === 0 ? (
            <div className="mt-6 rounded-3xl border border-dashed border-border bg-card px-5 py-9 text-center">
              <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-secondary text-muted-foreground">
                <span className="text-2xl" aria-hidden>
                  🙂
                </span>
              </div>

              <p className="mt-4 text-sm font-bold">
                해당 조건의 회원이 없어요
              </p>

              <p className="mx-auto mt-2 max-w-xs text-xs leading-relaxed text-muted-foreground">
                현재 필터에 해당하는 회원이 없어요. 다른 관리 상태나 계약 상태를
                선택해 보세요.
              </p>

              <Link
                href="/trainer/members"
                className="mt-5 inline-flex h-10 items-center justify-center rounded-xl border border-border px-4 text-sm font-semibold transition-colors hover:bg-secondary"
              >
                전체 회원 보기
              </Link>
            </div>
          ) : (
            <>
              <div className="mt-7 flex items-end justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold tracking-tight">
                      회원 목록
                    </h2>
                    <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-bold tabular-nums text-foreground">
                      {shown.length}
                    </span>
                  </div>

                  <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                    현재 필터 조건에 해당하는 회원이에요.
                  </p>
                </div>

                <span className="shrink-0 pb-0.5 text-[11px] font-medium text-muted-foreground">
                  관리 우선순 정렬
                </span>
              </div>

              <ul className="mt-3 flex flex-col gap-3">
                {shown.map((member) => (
                  <MemberCard key={member.connectionId} member={member} />
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </main>
  );
}
