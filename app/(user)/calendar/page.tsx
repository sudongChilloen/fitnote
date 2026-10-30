import {
  ChevronLeft,
  ChevronRight,
  Dumbbell,
  UtensilsCrossed,
} from "lucide-react";
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
import { getDietByDate, MEAL_LABEL } from "@/server/diet/diet.service";
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

  const [summary, sessions, diet] = await Promise.all([
    getMonthSummary(user.id, month),
    getSessionsByDate(user.id, selected),
    getDietByDate(user.id, selected),
  ]);

  const cells = buildMonthGrid(month);
  const [year, monthNumber] = month.split("-").map(Number);

  const monthHref = (target: string) =>
    `/calendar?month=${target}&date=${selected}`;

  // 이번 달 요약: 운동한 날과 그중 PT 가 있던 날.
  const monthEntries = [...summary.entries()].filter(([key]) =>
    key.startsWith(month),
  );
  const workoutDayCount = monthEntries.length;
  const ptDayCount = monthEntries.filter(([, entry]) => entry.hasPt).length;

  return (
    <main className="flex flex-col gap-3.5 pt-4.5">
      <header className="flex items-center gap-2 px-5">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-extrabold tracking-tight">캘린더</h1>
          <p className="truncate text-[0.8125rem] text-muted-foreground tabular-nums">
            {monthNumber}월 <b className="text-primary">{workoutDayCount}일</b> 운동
            {ptDayCount > 0 ? ` · PT ${ptDayCount}일` : ""}
          </p>
        </div>
        <Link
          href={monthHref(shiftMonthKey(month, -1))}
          aria-label="이전 달"
          className="flex size-9 shrink-0 items-center justify-center rounded-full border border-border text-ink hover:bg-surface"
        >
          <ChevronLeft className="size-4" />
        </Link>
        <p className="shrink-0 text-sm font-bold tabular-nums">
          {year}년 {monthNumber}월
        </p>
        <Link
          href={monthHref(shiftMonthKey(month, 1))}
          aria-label="다음 달"
          className="flex size-9 shrink-0 items-center justify-center rounded-full border border-border text-ink hover:bg-surface"
        >
          <ChevronRight className="size-4" />
        </Link>
      </header>

      <div className="flex flex-col gap-3.5 px-4">
        <section className="rounded-[1.375rem] border border-border px-2 py-3">
          <div className="grid grid-cols-7 justify-items-center gap-y-1">
            {WEEKDAYS.map((label) => (
              <p key={label} className="pb-1.5 text-center text-[0.6875rem] text-faint">
                {label}
              </p>
            ))}

            {cells.map((cell) => {
              const entry = summary.get(cell.dateKey);
              const isSelected = cell.dateKey === selected;
              const isToday = cell.dateKey === today;
              const future = cell.dateKey > today;

              return (
                <Link
                  key={cell.dateKey}
                  href={`/calendar?month=${month}&date=${cell.dateKey}`}
                  scroll={false}
                  aria-current={isSelected ? "date" : undefined}
                  aria-label={`${formatKstDateLabel(new Date(`${cell.dateKey}T00:00:00+09:00`))}${
                    entry ? (entry.hasPt ? " PT" : " 개인 운동") : ""
                  }`}
                  className={cn(
                    // PT 는 딥그린, 개인 운동은 연민트, 고른 날은 검정, 오늘은 민트 테두리.
                    // 색만으로 나누지 않도록 범례와 aria-label 로 함께 말한다.
                    "flex size-10 items-center justify-center rounded-full text-[0.8125rem] tabular-nums transition-colors",
                    !cell.inMonth && "opacity-35",
                    isSelected
                      ? "bg-ink font-bold text-white"
                      : entry
                        ? entry.hasPt
                          ? "bg-primary font-bold text-white"
                          : "bg-[#cdeee0] font-bold text-ink"
                        : future
                          ? "text-[#8a938e]"
                          : "text-ink hover:bg-surface",
                    isToday && !isSelected && "font-bold ring-2 ring-brand ring-inset",
                  )}
                >
                  {Number(cell.dateKey.slice(8))}
                </Link>
              );
            })}
          </div>

          <div className="mt-2.5 flex items-center justify-center gap-3.5 text-[0.6875rem] text-muted-foreground">
            <span className="flex items-center gap-1.25">
              <span aria-hidden className="size-2.5 rounded-full bg-primary" />
              PT
            </span>
            <span className="flex items-center gap-1.25">
              <span aria-hidden className="size-2.5 rounded-full bg-[#cdeee0]" />
              개인 운동
            </span>
            <span className="flex items-center gap-1.25">
              <span aria-hidden className="size-2.5 rounded-full ring-2 ring-brand ring-inset" />
              오늘
            </span>
          </div>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="px-1 text-base font-extrabold">
            {formatKstDateLabel(new Date(`${selected}T00:00:00+09:00`))}
            {selected === today ? " · 오늘" : ""}
          </h2>

          {sessions.length === 0 ? (
            <p className="rounded-[1.125rem] bg-[#f7f8f7] py-8 text-center text-sm text-muted-foreground">
              이 날은 기록이 없어요.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {sessions.map((session) => (
                <li key={session.id}>
                  {/*
                    PT 와 개인 운동을 한 곳에 모아 보여준다. 색만으로 나누지 않게
                    "PT" 라고 글자로도 적는다.
                  */}
                  <Link
                    href={`/workouts/${session.id}`}
                    className="flex items-center gap-3 rounded-[1.125rem] bg-[#f7f8f7] px-3.5 py-3 text-ink"
                  >
                    <span
                      className={cn(
                        "flex size-10.5 shrink-0 items-center justify-center rounded-[0.875rem]",
                        session.isPt ? "bg-primary text-white" : "bg-brand-muted text-primary",
                      )}
                    >
                      <Dumbbell className="size-5.5" strokeWidth={1.8} aria-hidden />
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[0.6875rem] font-bold text-primary">
                        {session.isPt
                          ? `PT${session.recordedByName ? ` · ${session.recordedByName} 트레이너` : ""}`
                          : "개인 운동"}
                      </span>
                      <span className="block truncate text-sm font-bold">
                        {session.records.length > 0
                          ? session.records.map((record) => record.exercise.name).join(", ")
                          : "기록한 운동이 없어요"}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground tabular-nums">
                        {session.totalSets}세트
                        {session.totalVolume > 0
                          ? ` · ${session.totalVolume.toLocaleString()}kg`
                          : ""}
                        {session.durationSec ? ` · ${formatDuration(session.durationSec)}` : ""}
                      </span>
                    </span>

                    {session.status === "IN_PROGRESS" ? (
                      <span className="shrink-0 rounded-full bg-ink px-2.5 py-1.5 text-[0.6875rem] font-bold text-white">
                        {session.entryMode === "MANUAL" ? "입력 중" : "진행 중"}
                      </span>
                    ) : (
                      <ChevronRight className="size-4 shrink-0 text-faint" aria-hidden />
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          )}

          {/* 기록이 있어도 추가할 수 있어야 한다. 하루에 두 번 운동하는 사람이 있다. */}
          <LogPastWorkoutButton
            defaultDate={selected}
            label={sessions.length > 0 ? "이 날짜에 기록 추가" : "이 날짜 기록하기"}
            hideDateInput
          />
        </section>

      {/*
        같은 날의 식단 (노랑 = 식단).
        운동과 식단을 나란히 놓아 "그날 뭘 하고 뭘 먹었나" 를 한 화면에서 본다.
      */}
      <section className="flex flex-col">
        <div className="flex items-center justify-between px-1 pb-1">
          <h2 className="text-base font-extrabold">식단</h2>
          <Link
            href={`/diet?date=${selected}`}
            className="flex items-center text-xs font-semibold text-muted-foreground"
          >
            {diet.length > 0 ? "전체 보기" : "남기기"}
            <ChevronRight className="size-3.5" aria-hidden />
          </Link>
        </div>

        {diet.length === 0 ? (
          <p className="rounded-[1.125rem] bg-[#f7f8f7] py-6 text-center text-xs text-muted-foreground">
            이 날 남긴 식단이 없어요.
          </p>
        ) : (
          <ul className="flex flex-col">
            {diet.map((record) => (
              <li key={record.id}>
                <Link
                  href={`/diet/${record.id}`}
                  className="flex items-center gap-3 border-b border-line px-1 py-2 text-ink"
                >
                  {record.thumbnailUrl ? (
                    // 서명 주소는 열 때마다 값이 달라 최적화 캐시가 빗나간다.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={record.thumbnailUrl}
                      alt=""
                      loading="lazy"
                      className="size-13 shrink-0 rounded-[0.875rem] bg-line object-cover"
                    />
                  ) : (
                    <span className="flex size-13 shrink-0 items-center justify-center rounded-[0.875rem] bg-line text-faint">
                      <UtensilsCrossed className="size-5" />
                    </span>
                  )}

                  <span className="min-w-0 flex-1">
                    <span className="block text-[0.6875rem] font-bold text-muted-foreground">
                      {MEAL_LABEL[record.mealType]}
                    </span>
                    <span className="block truncate text-sm font-bold">
                      {record.foodName ?? record.memo ?? "사진만 남겼어요"}
                    </span>
                  </span>

                  {record.feedbackCount > 0 ? (
                    <span className="shrink-0 rounded-full border border-brand px-2 py-0.5 text-[0.6875rem] font-bold text-primary">
                      피드백 {record.feedbackCount}
                    </span>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
      </div>
    </main>
  );
}
