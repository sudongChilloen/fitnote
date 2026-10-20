"use client";

import {
  CalendarDays,
  House,
  NotebookPen,
  UserRound,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const TABS = [
  { href: "/trainer", label: "홈", icon: House },
  { href: "/trainer/schedule", label: "일정", icon: CalendarDays },
  { href: "/trainer/members", label: "회원", icon: Users },
  { href: "/trainer/journals", label: "할 일", icon: NotebookPen },
  { href: "/trainer/profile", label: "내 정보", icon: UserRound },
] as const;

export function TrainerBottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="주요 메뉴"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-40 px-4"
      style={{
        paddingBottom: "calc(0.625rem + env(safe-area-inset-bottom))",
      }}
    >
      <ul className="pointer-events-auto mx-auto flex w-full max-w-md items-center gap-1 rounded-[1.75rem] border border-border/70 bg-card/95 p-2 shadow-float backdrop-blur-xl">
        {TABS.map(({ href, label, icon: Icon }) => {
          const active =
            href === "/trainer"
              ? pathname === "/trainer"
              : pathname === href || pathname.startsWith(`${href}/`);

          return (
            <li key={href} className="min-w-0 flex-1">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-[3.25rem] flex-col items-center justify-center gap-1 rounded-2xl px-0.5 py-2 transition-all duration-200",
                  active
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-muted/70 hover:text-foreground",
                )}
              >
                <Icon
                  className={cn(
                    "size-5 transition-transform duration-200",
                    active && "scale-105",
                  )}
                  strokeWidth={active ? 2.25 : 1.8}
                />
                <span
                  className={cn(
                    "whitespace-nowrap text-[0.6875rem] leading-none",
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
