"use client";

import { CalendarDays, Dumbbell, House, NotebookPen, User } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const TABS = [
  { href: "/home", label: "홈", icon: House },
  { href: "/exercises", label: "운동", icon: Dumbbell },
  { href: "/calendar", label: "캘린더", icon: CalendarDays },
  { href: "/journal", label: "알림장", icon: NotebookPen },
  { href: "/profile", label: "내정보", icon: User },
] as const;

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="주요 메뉴"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-40 px-4"
      style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}
    >
      {/* 레퍼런스처럼 화면 아래에 떠 있는 알약형 탭. 선택된 탭은 연한 오렌지 알약으로 켜진다 */}
      <ul className="pointer-events-auto mx-auto flex w-full max-w-md items-stretch gap-1 rounded-full bg-card p-1.5 shadow-float">
        {TABS.map(({ href, label, icon: Icon }) => {
          // /exercises/[id] 같은 하위 경로에서도 상위 탭이 활성으로 보이게 한다.
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex flex-col items-center gap-0.5 rounded-full px-1 py-2 transition-colors",
                  active
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground",
                )}
              >
                <Icon
                  className="size-[1.375rem]"
                  strokeWidth={active ? 2.25 : 1.75}
                />
                <span
                  className={cn(
                    "text-[0.6875rem] leading-none",
                    active ? "font-bold" : "font-medium",
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
