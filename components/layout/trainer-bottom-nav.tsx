"use client";

import {
  CalendarDays,
  House,
  NotebookPen,
  UserRound,
  Users,
} from "lucide-react";
import { usePathname } from "next/navigation";

import { TabBar } from "./bottom-nav";

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
    <TabBar
      tabs={TABS}
      isActive={(href) =>
        href === "/trainer"
          ? pathname === "/trainer"
          : pathname === href || pathname.startsWith(`${href}/`)
      }
    />
  );
}
