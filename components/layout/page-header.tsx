import Link from "next/link";

import { ChevronLeft } from "lucide-react";

/**
 * v3 화면 머리말. 동그란 뒤로 버튼 · 제목(+ 한 줄 설명) · 오른쪽 자리 하나.
 * 모든 상세 화면이 같은 모양을 써서 어디서 들어와도 같은 자리에서 돌아간다.
 */
export function PageHeader({
  backHref,
  backLabel,
  title,
  subtitle,
  right,
}: {
  backHref: string;
  backLabel: string;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <header className="flex items-center gap-2.5 px-4 pt-3.5 pb-2">
      <Link
        href={backHref}
        aria-label={backLabel}
        className="flex size-10 shrink-0 items-center justify-center rounded-full border border-border text-ink"
      >
        <ChevronLeft className="size-4.5" aria-hidden />
      </Link>
      <span className="min-w-0 flex-1 leading-tight">
        <h1 className="truncate text-[1.0625rem] font-bold">{title}</h1>
        {subtitle ? (
          <span className="block truncate text-xs text-muted-foreground">{subtitle}</span>
        ) : null}
      </span>
      {right ? <span className="shrink-0">{right}</span> : null}
    </header>
  );
}
