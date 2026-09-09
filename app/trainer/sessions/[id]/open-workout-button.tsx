"use client";

import { Dumbbell, Loader2 } from "lucide-react";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";

import { openWorkoutAction } from "./actions";

/**
 * 운동 기록을 여는 버튼.
 *
 * 보통은 이 버튼을 볼 일이 없다. 시간표에서 "수업 기록" 을 누르면 들어오면서
 * 이미 열려 있다. 주소를 직접 열었거나 기록을 지운 뒤에만 보인다.
 */
export function OpenWorkoutButton({ ptSessionId }: { ptSessionId: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div>
      <Button
        type="button"
        variant="outline"
        disabled={pending}
        className="h-12 w-full rounded-xl text-sm font-bold"
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const result = await openWorkoutAction(ptSessionId);
            if (result.error) setError(result.error);
          });
        }}
      >
        {pending ? (
          <Loader2 className="size-4 animate-spin" aria-hidden />
        ) : (
          <Dumbbell className="size-4" aria-hidden />
        )}
        운동 기록 시작
      </Button>

      {error ? (
        <p className="mt-2 text-xs font-medium text-destructive">{error}</p>
      ) : null}
    </div>
  );
}
