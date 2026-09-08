import Link from "next/link";

import { ChevronLeft, ChevronRight } from "lucide-react";

import { requireUser } from "@/app/lib/dal";
import { formatKstDateLabel } from "@/lib/date";
import { getTrainerWeek } from "@/server/trainers/trainer-board.service";
import { cn } from "@/lib/utils";

import { EmptyDay, SessionRow } from "../session-row";

export const metadata = { title: "일정 | FitNote" };

const WEEKDAYS = ["월", "화", "수", "목", "금", "토", "일"] as const;

/**
 * 트레이너 일정.
 *
 * 요일 스트립 + 그 날 목록이다. 시간축 그리드를 쓰지 않았다. PT 일정은 아침과
 * 저녁에 몰려서 7열 그리드의 대부분이 빈칸이고, 폰 폭에서는 이름이 두 글자도
 * 안 들어간다. 트레이너가 수업 사이에 꺼내 보는 화면이라 "다음이 몇 시에
 * 누구인가" 가 한눈에 답해져야 한다.
 */
export default async function TrainerSchedulePage({
  searchParams,
}: PageProps<"/trainer/schedule">) {
  const user = await requireUser();
  const query = await searchParams;

  const raw = query.date;
  const week = await getTrainerWeek(
    user.id,
    typeof raw === "string" ? raw : undefined,
  );

  const isToday = week.dateKey === week.todayDateKey;
  const selectedDate = new Date(`${week.dateKey}T00:00:00+09:00`);

  return (
    <main className="px-5 pt-5 pb-16">
      <h1 className="text-xl font-bold">일정</h1>

      <div className="mt-4 flex items-center gap-1">
        <Link
          href={`/trainer/schedule?date=${week.prevWeekDateKey}`}
          aria-label="지난 주"
          className="flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground"
        >
          <ChevronLeft className="size-4" aria-hidden />
        </Link>

        <ul className="flex flex-1 items-stretch gap-1">
          {week.days.map((day, index) => (
            <li key={day.dateKey} className="flex-1">
              <Link
                href={`/trainer/schedule?date=${day.dateKey}`}
                aria-current={day.isSelected ? "date" : undefined}
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
                  {Number(day.dateKey.slice(8))}
                </span>
                {/*
                  수업 수를 점이 아니라 숫자로 쓴다. 하루에 여덟 개씩 있는
                  트레이너에게 점 여덟 개는 셀 수 없는 정보다.
                */}
                <span
                  className={cn(
                    "min-h-3.5 text-[0.625rem] leading-none font-bold tabular-nums",
                    day.count === 0 && "opacity-0",
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
          <ChevronRight className="size-4" aria-hidden />
        </Link>
      </div>

      <div className="mt-6 flex items-baseline justify-between gap-2">
        <h2 className="text-base font-bold">
          {isToday ? "오늘" : formatKstDateLabel(selectedDate)}
        </h2>
        {isToday ? null : (
          <Link
            href="/trainer/schedule"
            className="shrink-0 text-xs font-semibold text-brand-strong"
          >
            오늘로
          </Link>
        )}
      </div>

      {week.sessions.length === 0 ? (
        <EmptyDay message="이 날은 잡힌 수업이 없어요" />
      ) : (
        <ul className="mt-3 flex flex-col gap-2.5">
          {week.sessions.map((session) => (
            <SessionRow key={session.id} session={session} />
          ))}
        </ul>
      )}

      <p className="mt-6 text-center text-xs text-muted-foreground">
        수업은 회원의 PT 계약에서 잡아요.
      </p>
    </main>
  );
}
