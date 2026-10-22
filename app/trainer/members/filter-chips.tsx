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
      className="-mx-5 mt-6 overflow-x-auto px-5 pb-2"
      aria-label="회원 필터"
    >
      <ul className="flex w-max gap-2">
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
                  "flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition-all duration-200 active:scale-[0.98]",
                  active
                    ? filter.key === "attention"
                      ? "border-status-check bg-status-check text-white shadow-sm"
                      : filter.key === "soon"
                        ? "border-status-urgent bg-status-urgent text-white shadow-sm"
                        : "border-primary bg-primary text-primary-foreground shadow-sm"
                    : "border-border/70 bg-card text-muted-foreground hover:border-primary/30 hover:bg-secondary/60 hover:text-foreground",
                )}
              >
                <span>{filter.label}</span>

                <span
                  className={cn(
                    "inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-[11px] font-bold tabular-nums",
                    active
                      ? "bg-white/20 text-white"
                      : "bg-secondary text-muted-foreground",
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
