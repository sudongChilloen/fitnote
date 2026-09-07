"use client";

import { Heart } from "lucide-react";
import { useFormStatus } from "react-dom";

import { cn } from "@/lib/utils";

/**
 * 즐겨찾기 하트의 버튼 부분.
 *
 * 폼 자체는 서버 컴포넌트가 서버 액션을 직접 물고 그리므로 자바스크립트가 없어도
 * 눌린다. 이 조각은 눌린 뒤 응답이 올 때까지 흐릿하게 만드는 일만 한다.
 */
export function FavoriteToggleButton({ on }: { on: boolean }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      aria-pressed={on}
      className={cn(
        "flex size-10 items-center justify-center rounded-xl border transition-colors",
        on
          ? "border-brand bg-accent text-brand-strong"
          : "border-border text-muted-foreground hover:bg-secondary",
        pending && "opacity-50",
      )}
    >
      <Heart className={cn("size-5", on && "fill-current")} />
      <span className="sr-only">
        {on ? "즐겨찾기에서 빼기" : "즐겨찾기에 넣기"}
      </span>
    </button>
  );
}
