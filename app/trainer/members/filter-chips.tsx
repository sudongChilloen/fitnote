import Link from "next/link";

import { cn } from "@/lib/utils";
import { MEMBER_FILTERS, type MemberFilter } from "./member-filter";

export function MemberFilterChips({
  current,
  counts,
}: {
  current: MemberFilter;
  counts: Record<MemberFilter, number>;
}) {
  return (
    <nav
      className="-mx-4 mt-1 overflow-x-auto px-4 pb-1"
      aria-label="회원 필터"
    >
      <ul className="flex w-max gap-1.5">
        {MEMBER_FILTERS.map((filter) => {
          const active = filter.key === current;
          const params = new URLSearchParams();

          if (filter.key !== "all") {
            params.set("filter", filter.key);
          }

          const query = params.toString();
          const href = query ? `/trainer/members?${query}` : "/trainer/members";

          return (
            <li key={filter.key}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-10 items-center gap-2 rounded-full pr-1.5 pl-4 text-[0.8125rem] font-bold transition-transform active:scale-[0.98]",
                  // v3: 고른 칸은 검정, 나머지는 흰 바탕 + 회색 테두리. 만료 임박만 코랄 글자.
                  active
                    ? "bg-ink text-white"
                    : filter.key === "soon"
                      ? "bg-card text-status-urgent ring-1 ring-border ring-inset"
                      : "bg-card text-ink ring-1 ring-border ring-inset",
                )}
              >
                <span>{filter.label}</span>

                <span
                  className={cn(
                    "inline-flex h-7 min-w-7 items-center justify-center rounded-full px-1.5 text-xs font-extrabold tabular-nums",
                    active ? "bg-brand text-ink" : "bg-surface text-ink",
                  )}
                >
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
