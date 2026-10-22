"use client";

import { Dumbbell, Loader2 } from "lucide-react";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";

import { openWorkoutAction } from "./actions";

export function OpenWorkoutButton({
  ptSessionId,
}: {
  ptSessionId: string;
}) {
  const router = useRouter();

  const [pending, startTransition] =
    useTransition();

  const [error, setError] =
    useState<string | null>(null);

  function openWorkout() {
    if (pending) return;

    setError(null);

    startTransition(async () => {
      try {
        const result =
          (await openWorkoutAction(
            ptSessionId,
          )) as
            | {
                error?: string;
              }
            | undefined;

        if (result?.error) {
          setError(result.error);
          return;
        }

        router.refresh();
      } catch (error) {
        setError(
          error instanceof Error
            ? error.message
            : "운동 기록을 열지 못했어요.",
        );
      }
    });
  }

  return (
    <div>
      <Button
        type="button"
        size="lg"
        disabled={pending}
        onClick={openWorkout}
        className="h-12 w-full rounded-xl font-bold"
      >
        {pending ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            준비 중…
          </>
        ) : (
          <>
            <Dumbbell className="size-4" />
            운동 기록 시작
          </>
        )}
      </Button>

      {error ? (
        <p
          role="alert"
          className="mt-2 text-xs text-destructive"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}