"use client";

import { useFormStatus } from "react-dom";

import { Loader2 } from "lucide-react";

/** 저장 중을 표시하는 버튼. 두 번 눌러 같은 날 기록이 두 번 들어가지 않게 한다. */
export function SaveButton({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className={`inline-flex h-12 items-center justify-center gap-1.5 rounded-xl bg-brand text-base font-bold text-brand-foreground disabled:opacity-50 ${className}`}
    >
      {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
      {children}
    </button>
  );
}
