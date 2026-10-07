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

const WEEKDAYS = [
  "월",
  "화",
  "수",
  "목",
  "금",
  "토",
  "일",
] as const;

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
    getTrainerWeek(
      user.id,
      typeof raw === "string"
        ? raw
        : undefined,
    ),

    listSchedulableContracts(user.id),
  ]);

  const isToday =
    week.dateKey === week.todayDateKey;

  const selectedDate = new Date(
    `${week.dateKey}T00:00:00+09:00`,
  );

  return (
    <main className="px-5 pt-5 pb-16">
      <h1 className="text-xl font-bold">
        일정
      </h1>

      {/* 주간 날짜 선택 */}
      <div className="mt-4 flex items-center gap-1">
        <Link
          href={`/trainer/schedule?date=${week.prevWeekDateKey}`}
          aria-label="지난 주"
          className="flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground"
        >
          <ChevronLeft
            className="size-4"
            aria-hidden
          />
        </Link>

        <ul className="flex flex-1 items-stretch gap-1">
          {week.days.map((day, index) => (
            <li
              key={day.dateKey}
              className="flex-1"
            >
              <Link
                href={`/trainer/schedule?date=${day.dateKey}`}
                aria-current={
                  day.isSelected
                    ? "date"
                    : undefined
                }
                className={cn(
                  "flex flex-col items-center gap-1 rounded-xl py-2 transition-colors",
                  day.isSelected
                    ? "bg-primary text-primary-foreground"
                    : day.isToday
                      ? "bg-accent text-brand-strong"
                      : "text-muted-foreground",
                )}
              >
                <span className="text-[0.625rem] leading-none font-semibold">
                  {WEEKDAYS[index]}
                </span>

                <span className="text-sm leading-none font-bold tabular-nums">
                  {Number(
                    day.dateKey.slice(8),
                  )}
                </span>

                {/*
                  하루의 수업 수.

                  취소된 수업은 service에서 이미 제외되어 있다.
                */}
                <span
                  className={cn(
                    "min-h-3.5 text-[0.625rem] leading-none font-bold tabular-nums",
                    day.count === 0 &&
                      "opacity-0",
                  )}
                >
                  {day.count}
                </span>
              </Link>
            </li>
          ))}
        </ul>

        <Link
          href={`/trainer/schedule?date=${week.nextWeekDateKey}`}
          aria-label="다음 주"
          className="flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground"
        >
          <ChevronRight
            className="size-4"
            aria-hidden
          />
        </Link>
      </div>

      {/* 선택 날짜 */}
      <div className="mt-6 flex items-baseline justify-between gap-2">
        <h2 className="text-base font-bold">
          {isToday
            ? "오늘"
            : formatKstDateLabel(
                selectedDate,
              )}
        </h2>

        {!isToday ? (
          <Link
            href="/trainer/schedule"
            className="shrink-0 text-xs font-semibold text-brand-strong"
          >
            오늘로
          </Link>
        ) : null}
      </div>

      {/* 수업 목록 */}
      {week.sessions.length === 0 ? (
        <EmptyDay message="이 날은 잡힌 수업이 없어요" />
      ) : (
        <ul className="mt-3 flex flex-col gap-2.5">
          {week.sessions.map((session) => (
            <SessionRow
              key={session.id}
              session={session}
            />
          ))}
        </ul>
      )}

      {/* 수업 추가 */}
      <NewSessionDrawer
        dateKey={week.dateKey}
        contracts={contracts}
        defaultTime={nextFreeTime(
          week.sessions,
        )}
      />
    </main>
  );
}