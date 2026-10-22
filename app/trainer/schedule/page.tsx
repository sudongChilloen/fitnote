import Link from "next/link";

import { ChevronLeft, ChevronRight } from "lucide-react";

import { requireUser } from "@/app/lib/dal";
import { formatKstDateLabel } from "@/lib/date";
import { listSchedulableContracts } from "@/server/pt/pt.service";
import {
  getTrainerMonth,
  getTrainerWeek,
} from "@/server/trainers/trainer-board.service";
import { cn } from "@/lib/utils";

import { EmptyDay, SessionRow } from "../session-row";
import { NewSessionDrawer } from "./new-session-drawer";
import { nextFreeTime } from "./next-free-time";

export const metadata = {
  title: "일정 | FitNote",
};

const WEEKDAYS = ["월", "화", "수", "목", "금", "토", "일"] as const;

export default async function TrainerSchedulePage({
  searchParams,
}: PageProps<"/trainer/schedule">) {
  const user = await requireUser();
  const query = await searchParams;
  const raw = query.date;
  const dateKey = typeof raw === "string" ? raw : undefined;

  const [week, month, contracts] = await Promise.all([
    getTrainerWeek(user.id, dateKey),
    getTrainerMonth(user.id, dateKey),
    listSchedulableContracts(user.id),
  ]);

  const isToday = week.dateKey === week.todayDateKey;
  const selectedDate = new Date(`${week.dateKey}T00:00:00+09:00`);
  const monthDate = new Date(`${month.monthStartDateKey}T00:00:00+09:00`);

  // 월요일부터 시작하는 달력에 필요한 앞쪽 빈칸
  const leadingBlankCount = (monthDate.getDay() + 6) % 7;

  const monthLabel = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "long",
  }).format(monthDate);

  return (
    <main className="px-5 pt-5 pb-16">
      <header className="mb-6">
        <p className="text-xs font-semibold tracking-wide text-primary">
          TRAINER WORKSPACE
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">일정</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          월간 일정을 확인하고 날짜별 수업을 관리하세요.
        </p>
      </header>

      {/* 월간 달력 */}
      <section
        aria-label={`${monthLabel} 수업 달력`}
        className="rounded-3xl border border-border/70 bg-card p-3 shadow-card"
      >
        <div className="mb-4 flex items-center justify-between px-1">
          <Link
            href={`/trainer/schedule?date=${month.prevMonthDateKey}`}
            aria-label="지난 달"
            className="flex size-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary active:scale-95"
          >
            <ChevronLeft className="size-5" aria-hidden />
          </Link>

          <h2 className="text-lg font-bold tracking-tight">{monthLabel}</h2>

          <Link
            href={`/trainer/schedule?date=${month.nextMonthDateKey}`}
            aria-label="다음 달"
            className="flex size-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary active:scale-95"
          >
            <ChevronRight className="size-5" aria-hidden />
          </Link>
        </div>

        <div className="grid grid-cols-7">
          {WEEKDAYS.map((day, index) => (
            <div
              key={day}
              className={cn(
                "flex h-8 items-center justify-center text-xs font-semibold",
                index === 5
                  ? "text-blue-500"
                  : index === 6
                    ? "text-rose-500"
                    : "text-muted-foreground",
              )}
            >
              {day}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-y-1">
          {Array.from({ length: leadingBlankCount }, (_, index) => (
            <div key={`blank-${index}`} aria-hidden className="min-h-[68px]" />
          ))}

          {month.days.map((day) => {
            const dayNumber = Number(day.dateKey.slice(8));
            const weekday = new Date(`${day.dateKey}T00:00:00+09:00`).getDay();

            return (
              <Link
                key={day.dateKey}
                href={`/trainer/schedule?date=${day.dateKey}`}
                aria-label={`${day.dateKey}, 수업 ${day.count}개`}
                aria-current={day.isSelected ? "date" : undefined}
                className={cn(
                  "flex min-h-17 min-w-0 flex-col items-center rounded-xl px-0.5 py-2 transition-colors active:scale-95",
                  day.isSelected
                    ? "bg-primary text-primary-foreground"
                    : day.isToday
                      ? "bg-accent text-accent-foreground"
                      : "hover:bg-secondary/70",
                )}
              >
                <span
                  className={cn(
                    "flex size-8 items-center justify-center rounded-full text-sm font-semibold tabular-nums",
                    !day.isSelected &&
                      !day.isToday &&
                      weekday === 0 &&
                      "text-rose-500",
                    !day.isSelected &&
                      !day.isToday &&
                      weekday === 6 &&
                      "text-blue-500",
                  )}
                >
                  {dayNumber}
                </span>

                <span
                  className={cn(
                    "mt-1 min-h-4 text-[10px] font-semibold leading-4 tabular-nums",
                    day.isSelected
                      ? "text-primary-foreground"
                      : day.count > 0
                        ? "text-primary"
                        : "text-transparent",
                  )}
                >
                  {day.count > 0 ? `${day.count}회` : "·"}
                </span>
              </Link>
            );
          })}
        </div>

        <div className="mt-3 flex items-center justify-between border-t border-border/70 px-1 pt-3">
          <p className="text-xs text-muted-foreground">
            <span className="mr-1 inline-block size-1.5 rounded-full bg-primary" />
            날짜를 누르면 해당 일정을 확인할 수 있어요.
          </p>

          {!isToday ? (
            <Link
              href="/trainer/schedule"
              className="shrink-0 rounded-full border border-border px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-secondary"
            >
              오늘로
            </Link>
          ) : (
            <span className="shrink-0 text-xs font-semibold text-primary">
              오늘
            </span>
          )}
        </div>
      </section>

      {/* 선택한 날짜의 수업 */}
      <section className="mt-7">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold tracking-wide text-muted-foreground">
              {isToday ? "TODAY" : "SELECTED DATE"}
            </p>

            <h2 className="mt-1.5 text-xl font-bold tracking-tight">
              {isToday ? "오늘 수업" : formatKstDateLabel(selectedDate)}
            </h2>

            <p className="mt-1 text-xs text-muted-foreground">
              {isToday
                ? "오늘 예정된 수업을 확인하세요."
                : "선택한 날짜의 수업 목록이에요."}
            </p>
          </div>

          <span className="shrink-0 rounded-full bg-primary/10 px-3 py-2 text-xs font-bold text-primary">
            수업{" "}
            {
              week.sessions.filter((session) => session.status !== "CANCELLED")
                .length
            }
            개
          </span>
        </div>

        {week.sessions.length === 0 ? (
          <div className="mt-5">
            <EmptyDay message="이 날은 잡힌 수업이 없어요" />
          </div>
        ) : (
          <ul className="mt-5 flex flex-col gap-3">
            {week.sessions.map((session) => (
              <SessionRow key={session.id} session={session} />
            ))}
          </ul>
        )}
      </section>

      {/* 수업 추가 */}
      <NewSessionDrawer
        dateKey={week.dateKey}
        contracts={contracts}
        defaultTime={nextFreeTime(week.sessions)}
      />
    </main>
  );
}
