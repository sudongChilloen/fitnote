"use client";

import { Check, Dumbbell, Loader2 } from "lucide-react";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import type { SessionBriefing } from "@/server/pt/session-record.service";

import { copyExercisesAction } from "./actions";

export function Briefing({
  ptSessionId,
  briefing,
  canCopy,
}: {
  ptSessionId: string;
  briefing: SessionBriefing;
  canCopy: boolean;
}) {
  const router = useRouter();

  const [pending, startTransition] =
    useTransition();

  const [error, setError] =
    useState<string | null>(null);

  function copyExercises() {
    if (!canCopy || pending) {
      return;
    }

    setError(null);

    startTransition(async () => {
      try {
        const result =
          (await copyExercisesAction(
            ptSessionId,
          )) as
            | {
                error?: string;
                added?: number;
                skipped?: number;
              }
            | undefined;

        if (result?.error) {
          setError(result.error);
          return;
        }

        /*
         * copyExercisesAction에서 DB에는 이미
         * WorkoutSession / WorkoutRecord가 저장된다.
         *
         * 현재 페이지도 서버 컴포넌트이므로
         * 최신 workout.records를 다시 가져오게 한다.
         */
        router.refresh();
      } catch (error) {
        setError(
          error instanceof Error
            ? error.message
            : "운동을 담지 못했어요.",
        );
      }
    });
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-secondary">
          <Dumbbell
            className="size-5"
            aria-hidden
          />
        </div>

        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-bold">
            지난 수업 운동
          </h2>

          <p className="mt-0.5 text-xs text-muted-foreground">
            {briefing.sessionNumber
              ? `${briefing.sessionNumber}회차 · `
              : ""}
            {briefing.daysAgo > 0
              ? `${briefing.daysAgo}일 전`
              : "최근 수업"}
          </p>
        </div>
      </div>

      <ul className="mt-4 flex flex-col gap-2">
        {briefing.records.map(
          (record) => (
            <li
              key={record.exerciseId}
              className="rounded-xl bg-secondary px-3.5 py-3"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="min-w-0 truncate text-sm font-semibold">
                  {record.name}
                </p>

                <span className="shrink-0 text-xs text-muted-foreground">
                  {record.setCount}세트
                </span>
              </div>

              {record.topWeight !==
              null ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  지난 기록{" "}
                  <span className="font-semibold text-foreground">
                    {record.topWeight}
                    kg
                  </span>
                  {record.topReps !==
                  null
                    ? ` × ${record.topReps}회`
                    : ""}
                </p>
              ) : null}
            </li>
          ),
        )}
      </ul>

      {error ? (
        <p
          role="alert"
          className="mt-3 rounded-xl border border-destructive px-3 py-2 text-xs text-destructive"
        >
          {error}
        </p>
      ) : null}

      {canCopy ? (
        <Button
          type="button"
          size="lg"
          disabled={pending}
          onClick={copyExercises}
          className="mt-4 h-11 w-full rounded-xl font-bold"
        >
          {pending ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              담는 중…
            </>
          ) : (
            <>
              <Check className="size-4" />
              이 운동들 그대로 담기
            </>
          )}
        </Button>
      ) : null}
    </section>
  );
}