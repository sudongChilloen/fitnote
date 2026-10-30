"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { CalendarPlus, Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

import { scheduleFromCalendarAction } from "./actions";

export interface SchedulableContract {
  id: string;
  memberName: string;
  title: string;
  remaining: number;
  totalSessions: number;
}

/**
 * 일정 화면에서 바로 수업 잡기 (v3: 화면 안에 펼쳐 둔 카드).
 *
 * 지금까지는 회원 → 계약 → 상세까지 세 번 들어가야 수업 하나를 잡을 수
 * 있었다. 다음 수업을 잡는 건 대개 일정을 보다가 생각나는 일이라 일정 바로
 * 아래에 둔다. 보고 있던 날짜를 그대로 채워 넣는다.
 *
 * 회원과 계약을 따로 고르게 하지 않는다. 진행 중인 계약은 회원당 대개
 * 하나뿐이라 계약을 고르면 회원도 정해진다.
 */
export function NewSessionPanel({
  dateKey,
  contracts,
  defaultTime,
}: {
  dateKey: string;
  contracts: SchedulableContract[];
  /** 그날 마지막 수업 다음 시각. 없으면 저녁. */
  defaultTime: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const fieldClass =
    "mt-1.5 h-11.5 w-full min-w-0 rounded-[0.875rem] border border-border bg-card px-3 text-sm tabular-nums outline-none focus:border-primary focus:ring-2 focus:ring-primary/15";

  return (
    <section id="new-session" className="scroll-mt-20 rounded-[1.375rem] border border-border p-4">
      <div className="flex items-center gap-2.5">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-brand-muted text-primary">
          <CalendarPlus className="size-4.5" aria-hidden />
        </span>
        <h2 className="min-w-0 flex-1 text-[0.9375rem] font-bold">수업 추가</h2>
      </div>

      {contracts.length === 0 ? (
        <p className="mt-3 rounded-[0.875rem] bg-[#f7f8f7] px-3.5 py-3 text-xs leading-relaxed text-muted-foreground">
          진행 중인 PT 계약이 있어야 수업을 잡을 수 있어요. 회원 화면에서 계약을 먼저 만들어 주세요.
        </p>
      ) : (
        <form
          className="mt-3.5 flex flex-col gap-2.5"
          action={(formData) => {
            setError(null);
            startTransition(async () => {
              const result = await scheduleFromCalendarAction(formData);
              if (result.error) {
                setError(result.error);
                return;
              }
              router.push(`/trainer/schedule?date=${result.dateKey}`);
              router.refresh();
            });
          }}
        >
          <label className="block">
            <span className="text-xs font-bold text-muted-foreground">회원</span>
            <select
              name="contractId"
              required
              defaultValue={contracts.length === 1 ? contracts[0]!.id : ""}
              className={fieldClass}
            >
              <option value="" disabled>
                회원을 선택해 주세요
              </option>
              {contracts.map((contract) => (
                <option key={contract.id} value={contract.id}>
                  {contract.memberName} · PT {contract.remaining}회 남음
                </option>
              ))}
            </select>
          </label>

          <div className="grid grid-cols-2 gap-2">
            <label className="min-w-0">
              <span className="text-xs font-bold text-muted-foreground">날짜</span>
              <input name="date" type="date" defaultValue={dateKey} required className={fieldClass} />
            </label>
            <label className="min-w-0">
              <span className="text-xs font-bold text-muted-foreground">시간</span>
              <input
                name="time"
                type="time"
                step={300}
                defaultValue={defaultTime}
                required
                className={fieldClass}
              />
            </label>
          </div>

          <label className="block">
            <span className="text-xs font-bold text-muted-foreground">수업 시간</span>
            <span className="relative mt-1.5 block">
              <input
                name="durationMinutes"
                type="number"
                inputMode="numeric"
                min={10}
                max={240}
                step={5}
                defaultValue={60}
                required
                aria-label="수업 시간(분)"
                className={cn(fieldClass, "mt-0 pr-10")}
              />
              <span className="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 text-sm text-muted-foreground">
                분
              </span>
            </span>
          </label>

          {error ? (
            <p role="alert" className="rounded-[0.875rem] bg-status-urgent-bg px-3.5 py-2.5 text-xs font-medium text-status-urgent">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={pending}
            className="mt-1 flex h-12 w-full items-center justify-center gap-1.5 rounded-full bg-primary text-[0.9375rem] font-extrabold text-white disabled:opacity-60"
          >
            {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
            {pending ? "수업을 등록하고 있어요" : "수업 잡기"}
          </button>
        </form>
      )}
    </section>
  );
}
