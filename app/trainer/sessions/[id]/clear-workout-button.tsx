"use client";

import { Loader2, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";

import { removeWorkoutAction } from "./actions";

/**
 * 운동 기록을 통째로 지우는 버튼.
 *
 * 수업을 잘못 골라 들어갔을 때만 쓴다. 세트를 하나씩 지우는 건 기록 목록에서
 * 하므로 여기 있는 건 "이 수업에 적은 걸 전부 무르기" 하나뿐이다.
 */
export function ClearWorkoutButton({ ptSessionId }: { ptSessionId: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={pending}
        className="h-8 rounded-lg text-xs font-semibold text-destructive"
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const result = await removeWorkoutAction(ptSessionId);
            if (result.error) setError(result.error);
          });
        }}
      >
        {pending ? (
          <Loader2 className="size-3.5 animate-spin" aria-hidden />
        ) : (
          <Trash2 className="size-3.5" aria-hidden />
        )}
        기록 지우기
      </Button>

      {error ? (
        <p className="mt-2 text-xs font-medium text-destructive">{error}</p>
      ) : null}
    </div>
  );
}
