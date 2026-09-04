import { CalendarDays, ChevronLeft, ChevronRight, Dumbbell } from "lucide-react";
import Link from "next/link";

import { requireUser } from "@/app/lib/dal";
import {
  buildMonthGrid,
  formatDuration,
  formatKstDateLabel,
  shiftMonthKey,
  toKstDateKey,
} from "@/lib/date";
import { cn } from "@/lib/utils";
import {
  getMonthSummary,
  getSessionsByDate,
} from "@/server/workouts/workout.service";

import { LogPastWorkoutButton } from "../workouts/log-past-button";

export const metadata = { title: "캘린더 | FitNote" };

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

/** URL 로 들어오는 값이라 형식을 확인하고, 아니면 오늘로 되돌린다. */
function pickDateKey(value: string | string[] | undefined, fallback: string) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? value
    : fallback;
}

export default async function CalendarPage({
  searchParams,
}: PageProps<"/calendar">) {
  const user = await requireUser();

  const params = await searchParams;

  const today = toKstDateKey(new Date());
  const selected = pickDateKey(params.date, today);
  // 선택한 날짜가 속한 달을 보여준다. 9월 30일을 고른 채 10월로 넘기면
  // 선택이 화면 밖으로 사라지므로 month 를 따로 받는다.
  const month =
    typeof params.month === "string" && /^\d{4}-\d{2}$/.test(params.month)
      ? params.month
      : selected.slice(0, 7);

  const [summary, sessions] = await Promise.all([
    getMonthSummary(user.id, month),
    getSessionsByDate(user.id, selected),
  ]);

  const cells = buildMonthGrid(month);
  const [year, monthNumber] = month.split("-").map(Number);

  const monthHref = (target: string) =>
    `/calendar?month=${target}&date=${selected}`;

  return (
    <main className="flex flex-col gap-5 px-5 pt-6">
      <header className="flex items-center gap-2">
        <CalendarDays className="size-5 text-brand-strong" />
        <h1 className="text-lg font-bold">운동 캘린더</h1>
      </header>

      <section className="rounded-2xl border border-border bg-card p-4">
        <div className="mb-3 flex items-center justify-between">
          <Link
            href={monthHref(shiftMonthKey(month, -1))}
            aria-label="이전 달"
            className="flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary"
          >
            <ChevronLeft className="size-4" />
          </Link>

          <p className="text-sm font-bold tabular-nums">
            {year}년 {monthNumber}월
          </p>

          <Link
            href={monthHref(shiftMonthKey(month, 1))}
            aria-label="다음 달"
            className="flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary"
          >
            <ChevronRight className="size-4" />
          </Link>
        </div>

        <div className="grid grid-cols-7 gap-1">
          {WEEKDAYS.map((label) => (
            <p
              key={label}
              className="py-1 text-center text-xs font-semibold text-muted-foreground"
            >
              {label}
            </p>
          ))}

          {cells.map((cell) => {
            const entry = summary.get(cell.dateKey);
            const isSelected = cell.dateKey === selected;
            const isToday = cell.dateKey === today;

            return (
              <Link
                key={cell.dateKey}
                href={`/calendar?month=${month}&date=${cell.dateKey}`}
                scroll={false}
                aria-current={isSelected ? "date" : undefined}
                className={cn(
                  "flex aspect-square flex-col items-center justify-center gap-1 rounded-xl text-sm tabular-nums transition-colors",
                  !cell.inMonth && "text-muted-foreground/40",
                  isSelected
                    ? "bg-primary font-bold text-primary-foreground"
                    : isToday
                      ? "bg-accent font-bold text-accent-foreground"
                      : "hover:bg-secondary",
                )}
              >
                {Number(cell.dateKey.slice(8))}
                {/*
                  운동한 날 표시. 색만으로 구분하면 색각 이상이 있는 사람이
                  구분하지 못하므로 점이라는 형태를 함께 쓴다.
                */}
                <span
                  aria-hidden
                  className={cn(
                    "size-1.5 rounded-full",
                    entry
                      ? isSelected
                        ? "bg-primary-foreground"
                        : "bg-brand"
                      : "bg-transparent",
                  )}
                />
              </Link>
            );
          })}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-bold">
          {formatKstDateLabel(new Date(`${selected}T00:00:00+09:00`))}
          {selected === today ? " · 오늘" : ""}
        </h2>

        {sessions.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
            이 날은 기록이 없어요.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {sessions.map((session) => (
              <li key={session.id}>
                <Link
                  href={`/workouts/${session.id}`}
                  className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4"
                >
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent">
                    <Dumbbell className="size-5 text-brand-strong" />
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold">
                      {session.records.length > 0
                        ? session.records
                            .map((record) => record.exercise.name)
                            .join(", ")
                        : "기록한 운동이 없어요"}
                    </span>
                    <span className="block text-xs text-muted-foreground tabular-nums">
                      {session.totalSets}세트
                      {session.totalVolume > 0
                        ? ` · ${session.totalVolume.toLocaleString()}kg`
                        : ""}
                      {session.durationSec
                        ? ` · ${formatDuration(session.durationSec)}`
                        : ""}
                    </span>
                  </span>

                  {session.status === "IN_PROGRESS" ? (
                    <span className="shrink-0 rounded-full bg-accent px-2.5 py-1 text-xs font-semibold text-accent-foreground">
                      {session.entryMode === "MANUAL" ? "입력 중" : "진행 중"}
                    </span>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        )}

        {/*
          기록이 있어도 추가할 수 있어야 한다. 하루에 두 번 운동하는 사람이 있다.
        */}
        <LogPastWorkoutButton
          defaultDate={selected}
          label={sessions.length > 0 ? "이 날짜에 기록 추가" : "이 날짜 기록하기"}
          hideDateInput
        />
      </section>
    </main>
  );
}
