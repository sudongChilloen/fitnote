"use client";

import { CalendarPlus, Loader2 } from "lucide-react";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { toKstDateKey } from "@/lib/date";
import { cn } from "@/lib/utils";

import { startManualWorkout } from "./actions";

/**
 * 지난 운동을 몰아서 기록한다.
 *
 * 운동하면서 실시간으로 적는 사람만 있는 게 아니다. 다 끝내고 앉아서
 * 한 번에 넣는 사람도 있고, 그 사람에게 "시작 → 종료" 는 맞지 않는다.
 *
 * 날짜는 <input type="date"> 로 받는다. 달력 UI 를 직접 만들 이유가 없고
 * 모바일에서는 OS 기본 날짜 선택기가 뜬다.
 */
export function LogPastWorkoutButton({
  defaultDate,
  label = "지난 운동 기록",
  hideDateInput = false,
}: {
  defaultDate?: string;
  label?: string;
  /** 캘린더처럼 날짜를 이미 고른 화면에서는 입력칸이 중복이다. */
  hideDateInput?: boolean;
} = {}) {
  const today = toKstDateKey(new Date());
  const [date, setDate] = useState(defaultDate ?? today);

  // 캘린더에서 다른 날짜를 누르면 prop 이 바뀐다.
  // effect 대신 렌더 중 조정해 불필요한 재렌더를 피한다.
  const [syncedDefault, setSyncedDefault] = useState(defaultDate);
  if (defaultDate !== undefined && syncedDefault !== defaultDate) {
    setSyncedDefault(defaultDate);
    setDate(defaultDate);
  }
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        {hideDateInput ? null : (
          <input
            type="date"
            value={date}
            max={today}
            onChange={(event) => setDate(event.target.value)}
            aria-label="기록할 날짜"
            className="h-11 flex-1 rounded-xl border border-input bg-card px-3 text-sm outline-none focus:ring-2 focus:ring-ring/40"
          />
        )}
        <Button
          variant="outline"
          className={cn(
            "h-11 rounded-xl font-bold",
            hideDateInput ? "w-full" : "shrink-0",
          )}
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              setError(null);
              // 성공하면 서버에서 redirect 하므로 값이 돌아오지 않는다.
              const result = await startManualWorkout(date);
              if (result?.error) setError(result.error);
            })
          }
        >
          {pending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <CalendarPlus className="size-4" />
          )}
          {label}
        </Button>
      </div>

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
