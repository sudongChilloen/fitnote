import Link from "next/link";

import { cn } from "@/lib/utils";

import {
  MEMBER_FILTERS,
  type MemberFilter,
} from "./member-filter";

type StatusFilter =
  | "all"
  | "normal"
  | "attention"
  | "urgent";

/**
 * 계약 상태로 목록을 좁힌다.
 *
 * 관리 상태 필터와 함께 사용할 수 있다.
 *
 * 예:
 * /trainer/members?status=attention&filter=pt
 */
export function MemberFilterChips({
  current,
  counts,
  status = "all",
}: {
  current: MemberFilter;
  counts: Record<MemberFilter, number>;
  status?: StatusFilter;
}) {
  return (
    <nav
      className="-mx-5 mt-3 overflow-x-auto px-5"
      aria-label="계약 상태 필터"
    >
      <ul className="flex w-max gap-2">
        {MEMBER_FILTERS.map((filter) => {
          const active = filter.key === current;

          const href = buildHref({
            filter: filter.key,
            status,
          });

          return (
            <li key={filter.key}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-xs font-bold transition",
                  active
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-muted-foreground hover:bg-muted/50",
                )}
              >
                {filter.label}

                <span className="tabular-nums opacity-70">
                  {counts[filter.key]}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function buildHref({
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