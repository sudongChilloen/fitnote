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

export const metadata = { title: "회원 | FitNote" };

type StatusFilter = "all" | TrainerManagementStatus;

function parseStatusFilter(
  value: string | string[] | undefined,
): StatusFilter {
  const normalized = Array.isArray(value) ? value[0] : value;

  if (
    normalized === "normal" ||
    normalized === "attention" ||
    normalized === "urgent"
  ) {
    return normalized;
  }

  return "all";
}

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
  const [user, query] = await Promise.all([
    requireUser(),
    searchParams,
  ]);

  const home = await getTrainerHome(user.id);

  const filter = parseMemberFilter(query.filter);
  const status = parseStatusFilter(query.status);

  const counts: Record<MemberFilter, number> = {
    all: home.members.length,
    pt: 0,
    soon: 0,
    none: 0,
  };

  const statusCounts: Record<StatusFilter, number> = {
    all: home.members.length,
    urgent: 0,
    attention: 0,
    normal: 0,
  };

  for (const member of home.members) {
    counts[memberContractGroup(member)] += 1;
    statusCounts[member.managementStatus] += 1;
  }

  const shown = home.members.filter((member) => {
    const matchesContract =
      filter === "all" ||
      memberContractGroup(member) === filter;

    const matchesStatus =
      status === "all" ||
      member.managementStatus === status;

    return matchesContract && matchesStatus;
  });

  return (
    <main className="px-5 pt-5 pb-16">
      {/* 헤더 */}
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h1 className="text-xl font-bold">
            담당 회원{" "}
            <span className="text-sm font-normal text-muted-foreground tabular-nums">
              {home.members.length}명
            </span>
          </h1>

          <p className="mt-1 text-xs text-muted-foreground">
            관리가 필요한 회원부터 보여드려요.
          </p>
        </div>

        <AddMemberDrawer />
      </div>

      {home.members.length === 0 ? (
        <NoMembers />
      ) : (
        <>
          {/* 관리 상태 필터 */}
          <nav
            className="-mx-5 mt-5 overflow-x-auto px-5"
            aria-label="관리 상태 필터"
          >
            <ul className="flex w-max gap-2">
              {[
                {
                  key: "all" as const,
                  label: "전체",
                },
                {
                  key: "urgent" as const,
                  label: "즉시 확인",
                },
                {
                  key: "attention" as const,
                  label: "확인 필요",
                },
                {
                  key: "normal" as const,
                  label: "정상",
                },
              ].map((item) => {
                const active = item.key === status;

                const href = buildMemberFilterHref({
                  filter,
                  status: item.key,
                });

                return (
                  <li key={item.key}>
                    <a
                      href={href}
                      aria-current={active ? "page" : undefined}
                      className={`
                        flex
                        h-9
                        items-center
                        gap-1.5
                        rounded-full
                        border
                        px-3.5
                        text-xs
                        font-bold
                        transition
                        ${
                          active
                            ? item.key === "urgent"
                              ? "border-destructive bg-destructive text-white"
                              : "border-primary bg-primary text-primary-foreground"
                            : "border-border bg-card text-muted-foreground"
                        }
                      `}
                    >
                      {item.label}

                      <span className="tabular-nums opacity-70">
                        {statusCounts[item.key]}
                      </span>
                    </a>
                  </li>
                );
              })}
            </ul>
          </nav>

          {/* 계약 상태 필터 */}
          <MemberFilterChips
            current={filter}
            counts={counts}
            status={status}
          />

          {/* 결과 */}
          {shown.length === 0 ? (
            <div className="mt-8 rounded-2xl border border-dashed border-border bg-card px-5 py-8 text-center">
              <p className="text-sm font-bold">
                해당 조건의 회원이 없어요.
              </p>

              <p className="mt-1 text-xs text-muted-foreground">
                다른 관리 상태나 계약 상태를 선택해 보세요.
              </p>
            </div>
          ) : (
            <>
              <div className="mt-5 flex items-center justify-between">
                <p className="text-xs font-bold text-muted-foreground">
                  {shown.length}명
                </p>

                {status !== "all" ? (
                  <p className="text-xs text-muted-foreground">
                    관리 상태 기준으로 표시 중
                  </p>
                ) : null}
              </div>

              <ul className="mt-2.5 flex flex-col gap-2.5">
                {shown.map((member) => (
                  <MemberCard
                    key={member.connectionId}
                    member={member}
                  />
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </main>
  );
}

function buildMemberFilterHref({
  filter,
  status,
}: {
  filter: MemberFilter;
  status: StatusFilter;
}) {
  const params = new URLSearchParams();

  if (filter !== "all") {
    params.set("filter", filter);
  }

  if (status !== "all") {
    params.set("status", status);
  }

  const query = params.toString();

  return query
    ? `/trainer/members?${query}`
    : "/trainer/members";
}