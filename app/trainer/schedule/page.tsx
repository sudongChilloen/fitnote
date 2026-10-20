import Link from "next/link";

import { ChevronLeft, ChevronRight } from "lucide-react";

import { requireUser } from "@/app/lib/dal";
import { formatKstDateLabel } from "@/lib/date";
import { listSchedulableContracts } from "@/server/pt/pt.service";
import { getTrainerWeek } from "@/server/trainers/trainer-board.service";
import { cn } from "@/lib/utils";

import { EmptyDay, SessionRow } from "../session-row";
import { NewSessionDrawer } from "./new-session-drawer";
import { nextFreeTime } from "./next-free-time";

export const metadata = {
  title: "일정 | FitNote",
};

const WEEKDAYS = ["월", "화", "수", "목", "금", "토", "일"] as const;

/**
 * 트레이너 일정.
 *
 * 요일 스트립 + 그 날 목록이다.
 *
 * 일정에서는 단순히 "언제 누구와 수업하는지"뿐 아니라
 * 실제 수업에 연결된 관리 업무가 있는 경우 그 업무까지 함께 보여준다.
 *
 * 관리 이벤트는 getTrainerWeek()가 TrainerSessionRow에 포함해서 반환하므로
 * 일정 화면에서 회원 데이터를 다시 조회하지 않는다.
 */
export default async function TrainerSchedulePage({
  searchParams,
}: PageProps<"/trainer/schedule">) {
  const user = await requireUser();
  const query = await searchParams;

  const raw = query.date;

  const [week, contracts] = await Promise.all([
    getTrainerWeek(user.id, typeof raw === "string" ? raw : undefined),

    listSchedulableContracts(user.id),
  ]);

  const isToday = week.dateKey === week.todayDateKey;

  const selectedDate = new Date(`${week.dateKey}T00:00:00+09:00`);

  return (
    <main className="px-5 pt-5 pb-16">
      <h1 className="text-2xl font-bold tracking-tight">일정</h1>

      {/* 주간 날짜 선택 */}

      {/* 주간 날짜 선택 */}
      <div className="mt-5 rounded-3xl bg-card p-2 shadow-card">
        <div className="flex items-center gap-1">
          <Link
            href={`/trainer/schedule?date=${week.prevWeekDateKey}`}
            aria-label="지난 주"
            className="flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary active:scale-95"
          >
            <ChevronLeft className="size-4" aria-hidden />
          </Link>

          <ul className="flex flex-1 items-stretch gap-1">
            {week.days.map((day, index) => (
              <li key={day.dateKey} className="min-w-0 flex-1">
                <Link
                  href={`/trainer/schedule?date=${day.dateKey}`}
                  aria-current={day.isSelected ? "date" : undefined}
                  className={cn(
                    "flex min-h-[76px] flex-col items-center justify-center gap-2 rounded-2xl py-2 transition-all active:scale-95",
                    day.isSelected
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : day.isToday
                        ? "bg-accent text-accent-foreground"
                        : "text-muted-foreground hover:bg-secondary/70",
                  )}
                >
                  <span className="text-[11px] font-semibold leading-none">
                    {WEEKDAYS[index]}
                  </span>

                  <span className="text-base font-bold leading-none tabular-nums">
                    {Number(day.dateKey.slice(8))}
                  </span>

                  <span
                    className={cn(
                      "h-1.5 w-1.5 rounded-full",
                      day.count > 0
                        ? day.isSelected
                          ? "bg-primary-foreground"
                          : "bg-primary"
                        : "bg-transparent",
                    )}
                    aria-label={
                      day.count > 0 ? `수업 ${day.count}개` : undefined
                    }
                  />
                </Link>
              </li>
            ))}
          </ul>

          <Link
            href={`/trainer/schedule?date=${week.nextWeekDateKey}`}
            aria-label="다음 주"
            className="flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary active:scale-95"
          >
            <ChevronRight className="size-4" aria-hidden />
          </Link>
        </div>
      </div>

      {/* 선택 날짜 */}
      <div className="mt-7 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-muted-foreground">
            {isToday ? "TODAY" : "SELECTED DATE"}
          </p>
          <h2 className="mt-1 text-xl font-bold tracking-tight">
            {isToday ? "오늘 수업" : formatKstDateLabel(selectedDate)}
          </h2>
        </div>

        {!isToday ? (
          <Link
            href="/trainer/schedule"
            className="inline-flex shrink-0 items-center gap-1 rounded-full bg-accent px-3.5 py-2 text-xs font-bold text-accent-foreground transition-colors hover:opacity-80"
          >
            오늘로 돌아가기
            <ChevronRight className="size-3.5" aria-hidden />
          </Link>
        ) : (
          <span className="rounded-full bg-secondary px-3 py-1.5 text-xs font-semibold text-muted-foreground">
            {week.sessions.length}개 수업
          </span>
        )}
      </div>

      {/* 수업 목록 */}
      {week.sessions.length === 0 ? (
        <div className="mt-4">
          <EmptyDay message="이 날은 잡힌 수업이 없어요" />
        </div>
      ) : (
        <ul className="mt-4 flex flex-col gap-3">
          {week.sessions.map((session) => (
            <SessionRow key={session.id} session={session} />
          ))}
        </ul>
      )}

      {/* 수업 추가 */}
      <NewSessionDrawer
        dateKey={week.dateKey}
        contracts={contracts}
        defaultTime={nextFreeTime(week.sessions)}
      />
    </main>
  );
}
