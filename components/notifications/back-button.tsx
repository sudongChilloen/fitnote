"use client";

import { ChevronLeft } from "lucide-react";
import { useRouter } from "next/navigation";

/** 알림은 어디서든 열리므로 정해진 곳 대신 바로 전 화면으로 돌아간다. */
export function BackButton() {
  const router = useRouter();

  return (
    <button
      type="button"
      aria-label="뒤로"
      onClick={() => router.back()}
      className="flex size-10 shrink-0 items-center justify-center rounded-full border border-border text-ink"
    >
      <ChevronLeft className="size-4.5" aria-hidden />
    </button>
  );
}
