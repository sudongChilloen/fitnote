"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { CalendarPlus, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";

import { scheduleFromCalendarAction } from "./actions";

export interface SchedulableContract {
  id: string;
  memberName: string;
  title: string;
  remaining: number;
  totalSessions: number;
}

/**
 * 일정 화면에서 바로 수업 잡기.
 *
 * 지금까지는 회원 → 계약 → 상세까지 세 번 들어가야 수업 하나를 잡을 수
 * 있었다. 다음 수업을 잡는 건 대개 일정을 보다가 생각나는 일인데, 그때마다
 * 화면을 셋 지나 갔다가 다시 돌아와야 했다.
 *
 * 보고 있던 날짜를 그대로 채워 넣는 게 이 화면에서 잡는 이유의 절반이다.
 * 9월 12일을 열어 보다가 눌렀으면 9월 12일이어야 한다.
 *
 * 회원과 계약을 따로 고르게 하지 않는다. 진행 중인 계약은 회원당 대개
 * 하나뿐이라 계약을 고르면 회원도 정해진다.
 */
export function NewSessionDrawer({
  dateKey,
  contracts,
  defaultTime,
}: {
  dateKey: string;
  contracts: SchedulableContract[];
  /** 그날 마지막 수업 다음 시각. 없으면 저녁. */
  defaultTime: string;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <>
      <Button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-5 h-14 w-full rounded-2xl text-sm font-bold shadow-sm transition-all hover:shadow-md active:scale-[0.98]"
      >
        <CalendarPlus className="size-4" aria-hidden />
        수업 잡기
      </Button>

      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent className="mx-auto max-h-[90dvh] max-w-md overflow-y-auto rounded-t-[2rem]">
          <DrawerHeader className="px-5 pb-5 pt-4 text-left">
            <div className="mb-3 flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <CalendarPlus className="size-5" aria-hidden />
            </div>

            <DrawerTitle className="text-xl font-bold tracking-tight">
              수업 잡기
            </DrawerTitle>

            <DrawerDescription className="mt-1 text-sm leading-relaxed">
              {contracts.length === 0
                ? "수업을 잡을 수 있는 계약이 없어요."
                : "회원과 시간을 선택해 새로운 수업 일정을 등록하세요."}
            </DrawerDescription>
          </DrawerHeader>

          {contracts.length === 0 ? (
            <div className="mx-4 mb-8 rounded-2xl bg-secondary/60 px-4 py-5">
              <p className="text-sm leading-relaxed text-muted-foreground">
                진행 중인 PT 계약이 있어야 수업을 잡을 수 있어요. 회원 화면에서
                계약을 먼저 만들어 주세요.
              </p>
            </div>
          ) : (
            <form
              className="flex flex-col gap-5 px-5 pb-8"
              action={(formData) => {
                setError(null);
                startTransition(async () => {
                  const result = await scheduleFromCalendarAction(formData);

                  if (result.error) {
                    setError(result.error);
                    return;
                  }

                  setOpen(false);
                  router.push(`/trainer/schedule?date=${result.dateKey}`);
                  router.refresh();
                });
              }}
            >
              <label className="flex flex-col gap-2">
                <span className="text-sm font-bold">회원 선택</span>
                <select
                  name="contractId"
                  required
                  defaultValue={contracts.length === 1 ? contracts[0]!.id : ""}
                  className="h-12 w-full rounded-xl border border-border bg-background px-3.5 text-sm tabular-nums outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground/70 focus:border-primary focus:ring-2 focus:ring-primary/15"
                >
                  <option value="" disabled>
                    회원을 선택해 주세요
                  </option>
                  {contracts.map((contract) => (
                    <option key={contract.id} value={contract.id}>
                      {contract.memberName} · {contract.remaining}회 남음
                    </option>
                  ))}
                </select>
              </label>

              <div className="rounded-2xl border border-border/60 bg-secondary/30 p-4">
                <p className="mb-3 text-sm font-bold">수업 일정</p>
                <div className="grid grid-cols-2 gap-3">
                  <label className="flex min-w-0 flex-col gap-2">
                    <span className="text-xs font-semibold text-muted-foreground">
                      날짜
                    </span>
                    <input
                      name="date"
                      type="date"
                      defaultValue={dateKey}
                      required
                      className="h-11 min-w-0 w-full rounded-xl border border-border/70 bg-card px-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
                    />
                  </label>

                  <label className="flex min-w-0 flex-col gap-2">
                    <span className="text-xs font-semibold text-muted-foreground">
                      시작 시각
                    </span>
                    <input
                      name="time"
                      type="time"
                      step={300}
                      defaultValue={defaultTime}
                      required
                      className="h-11 min-w-0 w-full rounded-xl border border-border/70 bg-card px-2 text-sm tabular-nums outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
                    />
                  </label>
                </div>
              </div>

              <label className="flex flex-col gap-2">
                <span className="text-sm font-bold">진행 시간</span>
                <div className="relative">
                  <input
                    name="durationMinutes"
                    type="number"
                    min={10}
                    max={240}
                    step={5}
                    defaultValue={60}
                    className="h-12 w-full rounded-2xl border border-border/70 bg-background px-3.5 pr-14 text-sm tabular-nums outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
                  />
                  <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                    분
                  </span>
                </div>
              </label>

              {error ? (
                <p
                  role="alert"
                  className="rounded-xl bg-destructive/10 px-3.5 py-3 text-sm font-medium text-destructive"
                >
                  {error}
                </p>
              ) : null}

              <Button
                type="submit"
                disabled={pending}
                className="h-14 rounded-2xl text-sm font-bold shadow-sm transition-all hover:shadow-md"
              >
                {pending ? (
                  <>
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                    수업을 등록하고 있어요
                  </>
                ) : (
                  <>
                    <CalendarPlus className="size-4" aria-hidden />이 시각에
                    수업 잡기
                  </>
                )}
              </Button>
            </form>
          )}
        </DrawerContent>
      </Drawer>
    </>
  );
}
