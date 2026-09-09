"use client";

import { useFormStatus } from "react-dom";

import { Trash2 } from "lucide-react";

/**
 * 삭제 버튼.
 *
 * 폼은 서버 컴포넌트가 서버 액션을 그대로 물고 그리므로 자바스크립트가 없어도
 * 지워진다. 확인 창은 띄우지 않는다 — 식단은 하루에 서너 번 쌓이는 가벼운 기록이라
 * 잘못 지워도 다시 올리면 되고, 매번 확인을 받으면 그게 더 성가시다.
 */
export function DeleteDietButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="flex h-9 items-center gap-1 rounded-xl border border-border px-3 text-xs font-semibold text-muted-foreground disabled:opacity-50"
    >
      <Trash2 className="size-3.5" aria-hidden />
      {pending ? "지우는 중" : "삭제"}
    </button>
  );
}
