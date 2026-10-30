"use client";

import { Check, Loader2 } from "lucide-react";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import type { SessionBriefing } from "@/server/pt/session-record.service";

import { copyExercisesAction } from "./actions";

/**
 * 지난 수업 운동을 오늘 기록에 그대로 담는 버튼. 브리핑 카드 안에 들어간다.
 */
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

  if (!canCopy) return null;

  return (
    <>
      {error ? (
        <p role="alert" className="mt-2.5 rounded-xl bg-white/10 px-3 py-2 text-xs text-[#ffc4b6]">
          {error}
        </p>
      ) : null}

      <Button
        type="button"
        size="lg"
        variant="outline"
        disabled={pending}
        onClick={copyExercises}
        className="mt-3 h-10.5 w-full rounded-full border-0 bg-brand text-[0.8125rem] font-extrabold text-ink hover:bg-brand/85"
      >
        {pending ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            담는 중…
          </>
        ) : (
          <>
            <Check className="size-4" />
            지난 수업 운동 {briefing.records.length}개 그대로 담기
          </>
        )}
      </Button>
    </>
  );
}
