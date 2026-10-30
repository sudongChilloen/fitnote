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

  return <TabBar tabs={TABS} isActive={(href) => pathname === href || pathname.startsWith(`${href}/`)} />;
}

/**
 * 화면 아래에 붙은 탭. 회원·트레이너가 같은 모양을 쓴다.
 * 선택된 탭은 글자가 딥그린이 되고 아이콘 안쪽이 민트로 칠해진다.
 */
export function TabBar({
  tabs,
  isActive,
}: {
  tabs: readonly { href: string; label: string; icon: typeof House }[];
  isActive: (href: string) => boolean;
}) {
  return (
    <nav
      aria-label="주요 메뉴"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-card"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="mx-auto grid h-16 w-full max-w-md grid-cols-5">
        {tabs.map(({ href, label, icon: Icon }) => {
          const active = isActive(href);
          return (
            <li key={href} className="min-w-0">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-full flex-col items-center justify-center gap-1 transition-colors",
                  active ? "text-primary" : "text-faint hover:text-foreground",
                )}
              >
                <Icon
                  className="size-[1.375rem]"
                  strokeWidth={active ? 2 : 1.8}
                  fill={active ? "var(--brand-muted)" : "none"}
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
