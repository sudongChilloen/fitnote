import Link from "next/link";

import { cn } from "@/lib/utils";
import { MEMBER_FILTERS, MemberFilter } from "./member-filter";

type StatusFilter = "all" | "normal" | "attention" | "urgent";

/**
 * 계약 상태로 목록을 좁힌다.
 *
 * 링크로 만든다. 회원 상세에 들어갔다 뒤로 나오면 보던 자리로 돌아와야 하는데,
 * 클라이언트 상태로 두면 매번 전체 목록으로 초기화된다.
 *
 * 건수를 칩에 같이 쓴다. 눌러 봐야 몇 명인지 아는 필터는 결국 다 눌러 보게
 * 되고, 0명인 칩을 누르는 헛걸음도 막을 수 있다.
 */
export function MemberFilterChips({
  current,
  counts,
  status,
}: {
  current: MemberFilter;
  counts: Record<MemberFilter, number>;
  status: StatusFilter;
}) {
  return (
    <nav className="-mx-5 mt-4 overflow-x-auto px-5">
      <ul className="flex w-max gap-2">
        {MEMBER_FILTERS.map((filter) => {
          const active = filter.key === current;

          const params = new URLSearchParams();

          if (filter.key !== "all") {
            params.set("filter", filter.key);
          }

          if (status !== "all") {
            params.set("status", status);
          }

          const query = params.toString();

          const href = query ? `/trainer/members?${query}` : "/trainer/members";

          return (
            <li key={filter.key}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-xs font-bold",
                  active
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-muted-foreground",
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
