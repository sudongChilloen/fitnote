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
        variant="outline"
        onClick={() => setOpen(true)}
        className="mt-5 h-12 w-full rounded-xl text-sm font-bold"
      >
        <CalendarPlus className="size-4" aria-hidden />
        수업 잡기
      </Button>

      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent className="mx-auto max-w-md">
          <DrawerHeader className="text-left">
            <DrawerTitle>수업 잡기</DrawerTitle>
            <DrawerDescription>
              {contracts.length === 0
                ? "수업을 잡을 수 있는 계약이 없어요."
                : "회원과 시각을 정하면 바로 일정에 올라가요."}
            </DrawerDescription>
          </DrawerHeader>

          {contracts.length === 0 ? (
            <p className="px-4 pb-8 text-sm text-muted-foreground">
              진행 중인 PT 계약이 있어야 수업을 잡을 수 있어요. 회원 화면에서
              계약을 먼저 만들어 주세요.
            </p>
          ) : (
            <form
              className="flex flex-col gap-3 px-4 pb-8"
              action={(formData) => {
                setError(null);
                startTransition(async () => {
                  const result = await scheduleFromCalendarAction(formData);

                  if (result.error) {
                    setError(result.error);
                    return;
                  }

                  setOpen(false);
                  /*
                  다른 날을 보다가 잡았으면 그 날로 옮긴다. 방금 만든 수업이
                  화면에 없으면 잡힌 건지 아닌지를 알 수 없다.
                */
                  router.push(`/trainer/schedule?date=${result.dateKey}`);
                  router.refresh();
                });
              }}
            >
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-bold">회원</span>
                <select
                  name="contractId"
                  required
                  defaultValue={contracts.length === 1 ? contracts[0]!.id : ""}
                  className="h-11 rounded-xl border border-border bg-background px-3 text-sm"
                >
                  <option value="" disabled>
                    고르기
                  </option>
                  {contracts.map((contract) => (
                    <option key={contract.id} value={contract.id}>
                      {contract.memberName} · {contract.remaining}회 남음
                    </option>
                  ))}
                </select>
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-bold">날짜</span>
                  <input
                    name="date"
                    type="date"
                    defaultValue={dateKey}
                    required
                    className="h-11 rounded-xl border border-border bg-background px-3 text-sm"
                  />
                </label>

                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-bold">시각</span>
                  <input
                    name="time"
                    type="time"
                    step={300}
                    defaultValue={defaultTime}
                    required
                    className="h-11 rounded-xl border border-border bg-background px-3 text-sm"
                  />
                </label>
              </div>

              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-bold">진행 시간 (분)</span>
                <input
                  name="durationMinutes"
                  type="number"
                  min={10}
                  max={240}
                  step={5}
                  defaultValue={60}
                  className="h-11 rounded-xl border border-border bg-background px-3 text-sm tabular-nums"
                />
              </label>

              {error ? (
                <p className="text-xs font-medium text-destructive">{error}</p>
              ) : null}

              <Button
                type="submit"
                disabled={pending}
                className="mt-1 h-12 rounded-xl text-sm font-bold"
              >
                {pending ? <Loader2 className="size-4 animate-spin" /> : null}이
                시각에 잡기
              </Button>
            </form>
          )}
        </DrawerContent>
      </Drawer>
    </>
  );
}
