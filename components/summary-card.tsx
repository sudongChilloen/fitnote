import Link from "next/link";

import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * 간결한 숫자 요약 타일 (v3).
 * 민트 원 아이콘 · 큰 숫자 · 이름. 지금 확인할 게 있으면 초록 테두리로 말한다.
 */
export function SummaryCard({
  icon: Icon,
  label,
  value,
  unit,
  href,
  highlight = false,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  unit?: string;
  href: string;
  /** 예전 호출부 호환용. v3 에서는 색 대신 테두리만 바꾼다. */
  tint?: string;
  highlight?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "min-w-0 rounded-[1.125rem] border bg-card p-3 transition-transform active:scale-[0.98]",
        highlight ? "border-primary" : "border-border",
      )}
    >
      <span className="flex size-8 items-center justify-center rounded-full bg-brand-muted text-primary">
        <Icon className="size-4" strokeWidth={2} aria-hidden />
      </span>
      <span className="mt-2.5 block text-2xl leading-none font-extrabold tabular-nums">
        {value}
        {unit ? <span className="ml-0.5 text-xs font-semibold">{unit}</span> : null}
      </span>
      <span className="mt-1 block truncate text-xs text-muted-foreground">{label}</span>
    </Link>
  );
}
