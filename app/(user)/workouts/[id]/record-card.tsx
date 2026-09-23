"use client";

import {
  Check,
  History,
  Loader2,
  Plus,
  X,
} from "lucide-react";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { BODY_PART_LABEL } from "@/lib/exercise-labels";
import { cn } from "@/lib/utils";

import {
  addSetToRecord,
  copyPreviousSetsAction,
  removeExerciseFromSession,
  removeSet,
  updateSetValues,
} from "../actions";

export type SetDto = {
  id: string;
  setNumber: number;
  weight: number | null;
  reps: number | null;
  completed: boolean;
};

export type RecordDto = {
  id: string;
  totalVolume: number | null;
  exercise: {
    name: string;
    bodyPart: keyof typeof BODY_PART_LABEL;
  };
  sets: SetDto[];
};

export type PreviousRecord = {
  performedAt: string;
  sets: {
    weight: number | null;
    reps: number | null;
  }[];
} | null;

/**
 * 숫자 입력을 서비스가 받는 값으로 바꾼다.
 * 빈 칸은 null.
 */
function toNumberOrNull(value: string) {
  const trimmed = value.trim();

  if (trimmed === "") {
    return null;
  }

  const parsed = Number(trimmed);

  return Number.isFinite(parsed)
    ? parsed
    : null;
}

function SetRow({
  sessionId,
  set,
  onError,
  showCompleteToggle,
}: {
  sessionId: string;
  set: SetDto;
  onError: (message: string | null) => void;
  showCompleteToggle: boolean;
}) {
  const [weight, setWeight] = useState(
    set.weight?.toString() ?? "",
  );

  const [reps, setReps] = useState(
    set.reps?.toString() ?? "",
  );

  const [pending, startTransition] =
    useTransition();

  function save(
    next: {
      weight?: string;
      reps?: string;
      completed?: boolean;
    },
  ) {
    const nextWeight =
      next.weight ?? weight;

    const nextReps =
      next.reps ?? reps;

    const nextCompleted =
      next.completed ?? set.completed;

    const unchanged =
      toNumberOrNull(nextWeight) ===
        set.weight &&
      toNumberOrNull(nextReps) ===
        set.reps &&
      nextCompleted === set.completed;

    if (unchanged) {
      return;
    }

    onError(null);

    startTransition(async () => {
      const result =
        await updateSetValues(
          sessionId,
          set.id,
          {
            weight:
              toNumberOrNull(nextWeight),
            reps:
              toNumberOrNull(nextReps),
            completed:
              nextCompleted,
          },
        );

      if (result.error) {
        onError(result.error);
      }
    });
  }

  const inputClass = cn(
    "h-10 w-[4.25rem] rounded-lg",
    "border border-input bg-background",
    "px-2 text-center text-sm font-semibold",
    "tabular-nums outline-none",
    "focus:ring-2 focus:ring-ring/40",
  );

  return (
    <li
      className={cn(
        "flex items-center gap-1.5 rounded-xl px-2 py-2",
        set.completed
          ? "bg-accent"
          : "bg-muted",
      )}
    >
      {/* 세트 번호 */}
      <span className="w-5 shrink-0 text-center text-xs font-bold text-muted-foreground tabular-nums">
        {set.setNumber}
      </span>

      {/* 중량 */}
      <input
        inputMode="decimal"
        value={weight}
        aria-label={`${set.setNumber}세트 중량(kg)`}
        onChange={(event) =>
          setWeight(event.target.value)
        }
        onBlur={() => save({})}
        className={inputClass}
      />

      <span className="shrink-0 text-xs text-muted-foreground">
        kg
      </span>

      <span
        className="shrink-0 text-muted-foreground"
        aria-hidden
      >
        ×
      </span>

      {/* 횟수 */}
      <input
        inputMode="numeric"
        value={reps}
        aria-label={`${set.setNumber}세트 횟수`}
        onChange={(event) =>
          setReps(event.target.value)
        }
        onBlur={() => save({})}
        className={inputClass}
      />

      <span className="shrink-0 text-xs text-muted-foreground">
        회
      </span>

      {/* 완료 */}
      {showCompleteToggle ? (
        <button
          type="button"
          aria-label={
            set.completed
              ? "완료 취소"
              : "완료"
          }
          aria-pressed={
            set.completed
          }
          disabled={pending}
          onClick={() =>
            save({
              completed:
                !set.completed,
            })
          }
          className={cn(
            "ml-auto flex size-8 shrink-0 items-center justify-center rounded-lg",
            set.completed
              ? "bg-brand text-brand-foreground"
              : "border border-input text-muted-foreground",
          )}
        >
          {pending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Check className="size-4" />
          )}
        </button>
      ) : null}

      {/* 세트 삭제 */}
      <button
        type="button"
        aria-label={`${set.setNumber}세트 삭제`}
        disabled={pending}
        onClick={() => {
          onError(null);

          startTransition(async () => {
            const result =
              await removeSet(
                sessionId,
                set.id,
              );

            if (result.error) {
              onError(result.error);
            }
          });
        }}
        className="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
      >
        <X
          className="size-4"
          aria-hidden
        />
      </button>
    </li>
  );
}

export function RecordCard({
  sessionId,
  record,
  previousRecord,
  editable,
  showCompleteToggle = true,
  ptOnly = false,
}: {
  sessionId: string;
  record: RecordDto;
  previousRecord: PreviousRecord;
  editable: boolean;
  showCompleteToggle?: boolean;
  ptOnly?: boolean;
}) {
  const [error, setError] =
    useState<string | null>(null);

  const [pending, startTransition] =
    useTransition();

  /**
   * 새 세트 기본값.
   *
   * 현재 기록이 있으면 마지막 세트 값을 이어받고,
   * 아직 세트가 없다면 지난 기록의 첫 세트 값을 사용한다.
   */
  function nextSetDefaults() {
    const lastSet =
      record.sets.at(-1);

    if (lastSet) {
      return {
        weight: lastSet.weight,
        reps: lastSet.reps,
      };
    }

    const previous =
      previousRecord?.sets[0];

    return {
      weight:
        previous?.weight ?? null,
      reps:
        previous?.reps ?? null,
    };
  }

  const previousSets =
    previousRecord?.sets ?? [];

  const hasPreviousSets =
    previousSets.length > 0;

  const previousPreview =
    previousSets
      .slice(0, 4)
      .map(
        (set) =>
          `${set.weight ?? "-"}kg × ${
            set.reps ?? "-"
          }`,
      )
      .join(" · ");

  return (
    <li className="rounded-2xl border border-border bg-card p-4">
      {/* =====================================================
          EXERCISE HEADER
         ===================================================== */}

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate font-bold">
            {record.exercise.name}
          </h2>

          <span className="mt-0.5 block text-xs text-muted-foreground">
            {
              BODY_PART_LABEL[
                record.exercise.bodyPart
              ]
            }
          </span>
        </div>

        {record.totalVolume !== null ? (
          <span className="shrink-0 text-xs font-semibold tabular-nums text-muted-foreground">
            {record.totalVolume.toLocaleString()}
            <span className="ml-0.5 font-medium">
              kg
            </span>
          </span>
        ) : null}
      </div>

      {/* =====================================================
          PREVIOUS RECORD
         ===================================================== */}

      {hasPreviousSets ? (
        <div className="mt-3 rounded-xl bg-secondary/70 px-3 py-2.5">
          <div className="flex items-center gap-1.5">
            <History
              className="size-3.5 text-muted-foreground"
              aria-hidden
            />

            <span className="text-[0.6875rem] font-bold text-muted-foreground">
              지난 기록
            </span>
          </div>

          <p className="mt-1 text-xs font-semibold tabular-nums text-brand-strong">
            {previousPreview}

            {previousSets.length >
            4 ? (
              <span className="ml-1 font-medium text-muted-foreground">
                +{previousSets.length - 4}
              </span>
            ) : null}
          </p>
        </div>
      ) : null}

      {/* =====================================================
          SET LIST
         ===================================================== */}

      {record.sets.length > 0 ? (
        <div className="mt-3">
          <div className="mb-1.5 flex items-center justify-between px-2">
            <span className="text-[0.6875rem] font-semibold text-muted-foreground">
              오늘 기록
            </span>

            <span className="text-[0.6875rem] text-muted-foreground tabular-nums">
              {record.sets.length}세트
            </span>
          </div>

          <ul className="flex flex-col gap-1.5">
            {record.sets.map(
              (set) =>
                editable ? (
                  <SetRow
                    key={set.id}
                    sessionId={sessionId}
                    set={set}
                    onError={setError}
                    showCompleteToggle={
                      showCompleteToggle
                    }
                  />
                ) : (
                  <li
                    key={set.id}
                    className="flex items-center gap-3 rounded-xl bg-muted px-3 py-2.5 text-sm"
                  >
                    <span className="w-5 text-center text-xs font-bold text-muted-foreground tabular-nums">
                      {set.setNumber}
                    </span>

                    <span className="font-semibold tabular-nums">
                      {set.weight ?? 0}kg
                    </span>

                    <span className="text-muted-foreground">
                      ×
                    </span>

                    <span className="font-semibold tabular-nums">
                      {set.reps ?? 0}회
                    </span>
                  </li>
                ),
              )}
          </ul>
        </div>
      ) : null}

      {/* =====================================================
          ERROR
         ===================================================== */}

      {error ? (
        <p
          role="alert"
          className="mt-2 text-sm text-destructive"
        >
          {error}
        </p>
      ) : null}

      {/* =====================================================
          COPY PREVIOUS SETS
         ===================================================== */}

      {editable &&
      record.sets.length === 0 &&
      hasPreviousSets ? (
        <Button
          variant="outline"
          className="mt-3 h-11 w-full rounded-xl font-bold"
          disabled={pending}
          onClick={() => {
            setError(null);

            startTransition(async () => {
              const result =
                await copyPreviousSetsAction(
                  sessionId,
                  record.id,
                  ptOnly,
                );

              if (result.error) {
                setError(result.error);
              }
            });
          }}
        >
          {pending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <History className="size-4" />
          )}

          지난 기록{" "}
          {previousSets.length}세트 그대로 담기
        </Button>
      ) : null}

      {/* =====================================================
          ACTIONS
         ===================================================== */}

      {editable ? (
        <div className="mt-3 flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            className="h-10 flex-1 rounded-lg font-semibold"
            disabled={pending}
            onClick={() => {
              setError(null);

              startTransition(async () => {
                const result =
                  await addSetToRecord(
                    sessionId,
                    record.id,
                    nextSetDefaults(),
                  );

                if (result.error) {
                  setError(
                    result.error,
                  );
                }
              });
            }}
          >
            {pending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Plus className="size-4" />
            )}

            세트 추가
          </Button>

          <button
            type="button"
            disabled={pending}
            onClick={() => {
              setError(null);

              startTransition(async () => {
                const result =
                  await removeExerciseFromSession(
                    sessionId,
                    record.id,
                  );

                if (result.error) {
                  setError(
                    result.error,
                  );
                }
              });
            }}
            className="flex h-10 shrink-0 items-center justify-center rounded-lg px-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            운동 삭제
          </button>

          <span className="hidden shrink-0 text-sm font-bold tabular-nums sm:inline">
            {(record.totalVolume ?? 0).toLocaleString()}
            <span className="ml-0.5 text-xs font-medium text-muted-foreground">
              kg
            </span>
          </span>
        </div>
      ) : null}

      {!editable ? (
        <div className="mt-3 flex justify-end text-sm font-bold tabular-nums">
          {(record.totalVolume ?? 0).toLocaleString()}
          <span className="ml-0.5 text-xs font-medium text-muted-foreground">
            kg
          </span>
        </div>
      ) : null}
    </li>
  );
}