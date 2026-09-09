"use client";

import { Check, History, Loader2, Plus, X } from "lucide-react";
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
  exercise: { name: string; bodyPart: keyof typeof BODY_PART_LABEL };
  sets: SetDto[];
};

export type PreviousRecord = {
  performedAt: string;
  sets: { weight: number | null; reps: number | null }[];
} | null;

/** 숫자 입력을 서비스가 받는 값으로 바꾼다. 빈 칸은 null 이다. */
function toNumberOrNull(value: string) {
  const trimmed = value.trim();
  if (trimmed === "") return null;

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
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
  /** 세트별 완료 체크. 지금 하는 중이 아니면 숨긴다. */
  showCompleteToggle: boolean;
}) {
  const [weight, setWeight] = useState(set.weight?.toString() ?? "");
  const [reps, setReps] = useState(set.reps?.toString() ?? "");
  const [pending, startTransition] = useTransition();

  function save(next: { weight?: string; reps?: string; completed?: boolean }) {
    const nextWeight = next.weight ?? weight;
    const nextReps = next.reps ?? reps;
    const nextCompleted = next.completed ?? set.completed;

    // 값이 그대로면 서버를 부르지 않는다.
    const unchanged =
      toNumberOrNull(nextWeight) === set.weight &&
      toNumberOrNull(nextReps) === set.reps &&
      nextCompleted === set.completed;

    if (unchanged) return;

    onError(null);
    startTransition(async () => {
      const result = await updateSetValues(sessionId, set.id, {
        weight: toNumberOrNull(nextWeight),
        reps: toNumberOrNull(nextReps),
        completed: nextCompleted,
      });

      if (result.error) onError(result.error);
    });
  }

  const inputClass =
    "h-9 w-14 rounded-lg border border-input bg-background text-center text-sm font-semibold tabular-nums outline-none focus:ring-2 focus:ring-ring/40";

  return (
    <li
      className={cn(
        "flex items-center gap-2 rounded-xl px-2.5 py-2",
        set.completed ? "bg-accent" : "bg-muted",
      )}
    >
      <span className="w-5 text-center text-xs font-bold text-muted-foreground tabular-nums">
        {set.setNumber}
      </span>

      <input
        inputMode="decimal"
        value={weight}
        aria-label={`${set.setNumber}세트 중량(kg)`}
        onChange={(event) => setWeight(event.target.value)}
        onBlur={() => save({})}
        className={inputClass}
      />
      <span className="text-xs text-muted-foreground">kg</span>

      <span className="text-muted-foreground">×</span>

      <input
        inputMode="numeric"
        value={reps}
        aria-label={`${set.setNumber}세트 횟수`}
        onChange={(event) => setReps(event.target.value)}
        onBlur={() => save({})}
        className={inputClass}
      />
      <span className="text-xs text-muted-foreground">회</span>

      {/*
        세트별 완료 체크는 "지금 이 세트를 하는 중" 일 때만 뜻이 있다.

        트레이너가 수업에서 한 운동을 옮겨 적을 때는 이미 다 한 것이라 항상
        완료다. 그런데도 체크가 보이면 세트마다 탭이 하나씩 늘고, 잘못 눌러
        해제하면 그 세트가 볼륨에서 조용히 빠진다.
      */}
      {showCompleteToggle ? (
        <button
          type="button"
          aria-label={set.completed ? "완료 취소" : "완료"}
          aria-pressed={set.completed}
          disabled={pending}
          onClick={() => save({ completed: !set.completed })}
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
      ) : (
        <span className="ml-auto" />
      )}

      <button
        type="button"
        aria-label={`${set.setNumber}세트 삭제`}
        onClick={() => {
          onError(null);
          startTransition(async () => {
            const result = await removeSet(sessionId, set.id);
            if (result.error) onError(result.error);
          });
        }}
        className="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground"
      >
        <X className="size-4" />
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
  /** 세트별 완료 체크를 보여줄지. 진행중인 내 운동에서만 쓴다. */
  showCompleteToggle?: boolean;
  /** 지난 기록을 담을 때 PT 수업 것만 볼지. 트레이너가 켠다. */
  ptOnly?: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  /**
   * 새 세트의 기본값.
   * 직전 세트를 그대로 이어가는 경우가 대부분이고,
   * 첫 세트면 지난 기록의 같은 순번 값을 채워준다.
   */
  function nextSetDefaults() {
    const lastSet = record.sets.at(-1);
    if (lastSet) {
      return { weight: lastSet.weight, reps: lastSet.reps };
    }

    const previous = previousRecord?.sets[0];
    return { weight: previous?.weight ?? null, reps: previous?.reps ?? null };
  }

  return (
    <li className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="font-bold">{record.exercise.name}</h2>
        <span className="text-xs text-muted-foreground">
          {BODY_PART_LABEL[record.exercise.bodyPart]}
        </span>
      </div>

      {previousRecord && previousRecord.sets.length > 0 ? (
        <p className="mt-1.5 text-xs text-muted-foreground">
          지난 기록{" "}
          <span className="font-semibold text-brand-strong">
            {previousRecord.sets
              .slice(0, 3)
              .map((set) => `${set.weight ?? 0}kg×${set.reps ?? 0}`)
              .join(" · ")}
            {previousRecord.sets.length > 3 ? " …" : ""}
          </span>
        </p>
      ) : null}

      {record.sets.length > 0 ? (
        <ul className="mt-3 flex flex-col gap-1.5">
          {record.sets.map((set) =>
            editable ? (
              <SetRow
                key={set.id}
                sessionId={sessionId}
                set={set}
                onError={setError}
                showCompleteToggle={showCompleteToggle}
              />
            ) : (
              <li
                key={set.id}
                className="flex items-center gap-3 rounded-xl bg-muted px-3 py-2 text-sm"
              >
                <span className="w-5 text-center text-xs font-bold text-muted-foreground tabular-nums">
                  {set.setNumber}
                </span>
                <span className="font-semibold tabular-nums">
                  {set.weight ?? 0}kg
                </span>
                <span className="text-muted-foreground">×</span>
                <span className="font-semibold tabular-nums">
                  {set.reps ?? 0}회
                </span>
              </li>
            ),
          )}
        </ul>
      ) : null}

      {error ? (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {/*
        지난 기록 통째로 담기.

        세트가 비어 있을 때만 뜬다. 이미 적은 게 있는데 누르면 세트가 두 배가
        되고, 지우는 데 더 오래 걸린다.
      */}
      {editable &&
      record.sets.length === 0 &&
      previousRecord &&
      previousRecord.sets.length > 0 ? (
        <Button
          variant="outline"
          className="mt-3 h-11 w-full rounded-xl font-bold"
          disabled={pending}
          onClick={() => {
            setError(null);
            startTransition(async () => {
              const result = await copyPreviousSetsAction(
                sessionId,
                record.id,
                ptOnly,
              );
              if (result.error) setError(result.error);
            });
          }}
        >
          {pending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <History className="size-4" />
          )}
          지난 기록 {previousRecord.sets.length}세트 그대로 담기
        </Button>
      ) : null}

      <div className="mt-3 flex items-center gap-2">
        {editable ? (
          <Button
            variant="secondary"
            size="sm"
            className="h-9 flex-1 rounded-lg font-semibold"
            disabled={pending}
            onClick={() => {
              setError(null);
              startTransition(async () => {
                const result = await addSetToRecord(
                  sessionId,
                  record.id,
                  nextSetDefaults(),
                );
                if (result.error) setError(result.error);
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
        ) : null}

        <span className="ml-auto text-sm font-bold tabular-nums">
          {(record.totalVolume ?? 0).toLocaleString()}
          <span className="ml-0.5 text-xs font-medium text-muted-foreground">
            kg
          </span>
        </span>
      </div>

      {editable ? (
        <button
          type="button"
          className="mt-2 w-full text-xs text-muted-foreground"
          onClick={() => {
            setError(null);
            startTransition(async () => {
              const result = await removeExerciseFromSession(
                sessionId,
                record.id,
              );
              if (result.error) setError(result.error);
            });
          }}
        >
          이 운동 삭제
        </button>
      ) : null}
    </li>
  );
}
