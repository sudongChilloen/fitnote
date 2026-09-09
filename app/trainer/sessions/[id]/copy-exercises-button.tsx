"use client";

import { CopyPlus, Loader2 } from "lucide-react";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";

import { copyExercisesAction } from "./actions";

/**
 * 지난 수업에 한 운동을 그대로 담는다.
 *
 * 무게는 안 담는다. 종목이 같아도 오늘 드는 무게는 다르고, 열다섯 줄이
 * 전부 "했다" 고 주장하는 상태로 시작하면 그중 몇 줄은 안 한 채로 남는다.
 * 무게는 각 카드에서 하나씩 확인하며 넣는다.
 */
export function CopyPreviousExercisesButton({
  ptSessionId,
}: {
  ptSessionId: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div>
      <Button
        type="button"
        variant="outline"
        disabled={pending}
        className="h-11 w-full rounded-xl bg-card text-sm font-bold"
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const result = await copyExercisesAction(ptSessionId);
            if (result.error) setError(result.error);
          });
        }}
      >
        {pending ? (
          <Loader2 className="size-4 animate-spin" aria-hidden />
        ) : (
          <CopyPlus className="size-4" aria-hidden />
        )}
        이 운동들 그대로 담기
      </Button>

      {error ? (
        <p className="mt-2 text-xs font-medium text-destructive">{error}</p>
      ) : null}
    </div>
  );
}
