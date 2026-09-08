"use client";

import { Dumbbell, Loader2, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";

import { openWorkoutAction, removeWorkoutAction } from "../actions";

/**
 * 운동 기록을 열고 지우는 버튼.
 *
 * 알림장 폼과 같은 `<form>` 에 넣으면 저장 버튼과 섞이므로 따로 둔다.
 */
export function WorkoutControls({
  journalId,
  hasWorkout,
  canDelete,
}: {
  journalId: string;
  hasWorkout: boolean;
  canDelete: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function run(fn: () => Promise<{ error: string | null }>) {
    setError(null);
    startTransition(async () => {
      const result = await fn();
      if (result.error) setError(result.error);
    });
  }

  return (
    <div>
      {hasWorkout ? (
        canDelete ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={pending}
            className="h-8 rounded-lg text-xs font-semibold text-destructive"
            onClick={() => run(() => removeWorkoutAction(journalId))}
          >
            {pending ? (
              <Loader2 className="size-3.5 animate-spin" aria-hidden />
            ) : (
              <Trash2 className="size-3.5" aria-hidden />
            )}
            기록 지우기
          </Button>
        ) : null
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={pending}
          className="h-9 rounded-lg text-xs font-bold"
          onClick={() => run(() => openWorkoutAction(journalId))}
        >
          {pending ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <Dumbbell className="size-4" aria-hidden />
          )}
          운동 기록 적기
        </Button>
      )}

      {error ? (
        <p className="mt-2 text-xs font-medium text-destructive">{error}</p>
      ) : null}
    </div>
  );
}
