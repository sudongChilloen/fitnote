"use client";

import { useFormStatus } from "react-dom";

import { Loader2 } from "lucide-react";

/**
 * 제출 중을 표시하는 버튼.
 *
 * 서버 컴포넌트가 서버 액션을 그대로 물고 그리도록, 눌리는 부분만 떼어냈다.
 * PT 회차 처리는 되돌리기가 번거로워서 두 번 눌리는 것을 특히 막아야 한다.
 */
export function SubmitButton({
  children,
  className = "",
  variant = "primary",
  confirm,
  name,
  value,
}: {
  children: React.ReactNode;
  className?: string;
  variant?: "primary" | "outline" | "danger";
  confirm?: string;
  name?: string;
  value?: string;
}) {
  const { pending } = useFormStatus();

  const base =
    "inline-flex h-11 items-center justify-center gap-1.5 rounded-xl px-4 text-sm font-bold transition disabled:opacity-50";
  const skin =
    variant === "primary"
      ? "bg-brand text-brand-foreground"
      : variant === "danger"
        ? "border border-destructive/40 text-destructive"
        : "border border-border text-foreground";

  return (
    <button
      type="submit"
      name={name}
      value={value}
      disabled={pending}
      onClick={(event) => {
        if (confirm && !window.confirm(confirm)) event.preventDefault();
      }}
      className={`${base} ${skin} ${className}`}
    >
      {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
      {children}
    </button>
  );
}
