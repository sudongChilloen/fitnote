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
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 backdrop-blur"
    >
      <ul
        className="mx-auto flex w-full max-w-md items-stretch"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {TABS.map(({ href, label, icon: Icon }) => {
          // /exercises/[id] 같은 하위 경로에서도 상위 탭이 활성으로 보이게 한다.
          const active = pathname === href || pathname.startsWith(`${href}/`);

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
