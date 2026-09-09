"use client";

import { CalendarDays, House, NotebookPen, User, Users } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

/**
 * 트레이너 하단 탭.
 *
 * 회원용과 따로 두는 이유는 단순히 항목이 달라서가 아니다. 트레이너는 회원과
 * 다른 축으로 일한다. 회원은 "오늘 뭐 할까(운동 → 캘린더 → 기록)" 로 움직이고,
 * 트레이너는 "지금 뭘 해야 하지(다음 수업 → 알림장 → 답장)" 로 움직인다.
 * 그래서 탭도 시간과 할 일 순서로 놓는다.
 */
const TABS = [
  { href: "/trainer", label: "홈", icon: House },
  { href: "/trainer/schedule", label: "일정", icon: CalendarDays },
  { href: "/trainer/members", label: "회원", icon: Users },
  { href: "/trainer/journals", label: "할 일", icon: NotebookPen },
  { href: "/trainer/profile", label: "내정보", icon: User },
] as const;

export function TrainerBottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="주요 메뉴"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 backdrop-blur"
    >
      <ul
        className="mx-auto flex w-full max-w-md items-stretch"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {TABS.map(({ href, label, icon: Icon }) => {
          /*
            `/trainer` 는 모든 트레이너 경로의 접두사라 startsWith 로 판단하면
            어디에 있든 홈이 켜진다. 홈만 정확히 일치로 본다.
          */
          const active =
            href === "/trainer"
              ? pathname === "/trainer"
              : pathname === href || pathname.startsWith(`${href}/`);

          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className="flex flex-col items-center gap-1 px-1 pt-2 pb-1.5"
              >
                <span
                  className={cn(
                    "flex h-8 w-12 items-center justify-center rounded-full transition-colors",
                    active
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground",
                  )}
                >
                  <Icon className="size-5" strokeWidth={active ? 2.4 : 1.8} />
                </span>
                <span
                  className={cn(
                    "text-[0.6875rem] leading-none",
                    active
                      ? "font-semibold text-brand-strong"
                      : "text-muted-foreground",
                  )}
                >
                  {label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
