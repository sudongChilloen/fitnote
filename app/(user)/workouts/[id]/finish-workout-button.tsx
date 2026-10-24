"use client";

import { Loader2 } from "lucide-react";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";

import { finishWorkout } from "../actions";

export function FinishWorkoutButton({
  sessionId,
  manual = false,
}: {
  sessionId: string;
  manual?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [minutes, setMinutes] = useState("");
  const [error, setError] = useState<string | null>(null);

  function finish() {
    setError(null);

    // 비워 두면 시간 없이 저장한다. 적었다면 숫자여야 한다.
    const parsed = minutes.trim() === "" ? null : Number(minutes);

    if (parsed !== null && !Number.isInteger(parsed)) {
      setError("운동 시간은 분 단위 숫자로 적어 주세요.");
      return;
    }

    startTransition(async () => {
      const result = await finishWorkout(sessionId, parsed);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {manual ? (
        <label className="flex items-center justify-between gap-3 rounded-xl border border-border px-4 py-3">
          <span className="text-sm font-medium">
            운동 시간{" "}
            <span className="text-xs font-normal text-muted-foreground">
              (선택)
            </span>
          </span>
          <span className="flex items-center gap-2">
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={1440}
              value={minutes}
              onChange={(event) => setMinutes(event.target.value)}
              placeholder="60"
              aria-label="운동 시간(분)"
              className="h-10 w-20 rounded-lg border border-border bg-background px-3 text-right tabular-nums"
            />
            <span className="text-sm text-muted-foreground">분</span>
          </span>
        </label>
      ) : null}

      <Button
        size="lg"
        className="h-12 w-full rounded-xl font-bold"
        disabled={pending}
        onClick={finish}
      >
        {pending ? <Loader2 className="size-4 animate-spin" /> : null}
        {manual ? "기록 저장" : "운동 종료"}
      </Button>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
