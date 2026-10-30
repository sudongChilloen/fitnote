import Link from "next/link";

import { ChevronLeft, ChevronRight, Plus } from "lucide-react";

import { requireUser } from "@/app/lib/dal";
import { formatKstDateLabel, toKstTimeValue } from "@/lib/date";
import { cn } from "@/lib/utils";
import { listSchedulableContracts } from "@/server/pt/pt.service";
import {
  getTrainerMonth,
  getTrainerWeek,
  type TrainerSessionRow,
} from "@/server/trainers/trainer-board.service";

import { EmptyDay } from "../session-row";
import { enterSessionRecord } from "../sessions/[id]/actions";
import { NewSessionPanel } from "./new-session-drawer";
import { nextFreeTime } from "./next-free-time";

export const metadata = {
  title: "일정 | FitNote",
};

const WEEKDAY = ["일", "월", "화", "수", "목", "금", "토"] as const;

type Show = "all" | "remaining" | "finish";

type Tone = "done" | "need" | "next" | "todo" | "cancel";

const TONE: Record<
  Tone,
  { status: string; card: string; pill: string; dot: string; time: string; sub: string }
> = {
  done: {
    status: "완료",
    card: "bg-surface text-ink",
    pill: "border-input text-muted-foreground",
    dot: "bg-[#cfd6d2]",
    time: "text-faint",
    sub: "text-muted-foreground",
  },
  need: {
    status: "마무리 필요",
    card: "bg-card text-ink ring-[1.5px] ring-coral ring-inset",
    pill: "border-coral text-status-urgent",
    dot: "bg-coral",
    time: "text-ink",
    sub: "text-muted-foreground",
  },
  next: {
    status: "다음 수업",
    card: "bg-primary text-white",
    pill: "border-brand text-brand",
    dot: "bg-brand",
    time: "text-primary",
    sub: "text-white/75",
  },
  todo: {
    status: "예정",
    card: "bg-card text-ink ring-1 ring-border ring-inset",
    pill: "border-[#dfe4e1] text-muted-foreground",
    dot: "bg-[#dfe4e1]",
    time: "text-ink",
    sub: "text-muted-foreground",
  },
  cancel: {
    status: "취소",
    card: "bg-card text-faint ring-1 ring-line ring-inset",
    pill: "border-border text-faint",
    dot: "bg-line",
    time: "text-faint",
    sub: "text-faint",
  },
};

function toneOf(session: TrainerSessionRow, nextId: string | null): Tone {
  if (session.status === "CANCELLED") return "cancel";
  if (session.status === "COMPLETED" || session.status === "NO_SHOW") {
    return session.managementEvents.length > 0 ? "need" : "done";
  }
  if (session.managementEvents.length > 0) return "need";
  return session.id === nextId ? "next" : "todo";
}

function subOf(session: TrainerSessionRow) {
  const parts = [`${session.durationMinutes}분`];
  if (session.status === "NO_SHOW") parts.push("노쇼");
  const event = session.managementEvents[0];
  if (event) parts.push(event.reason);
  else if (session.journalStatus === "PUBLISHED") parts.push("알림장 보냄");
  else if (session.hasWorkout) parts.push("운동 기록 있음");
  return parts.join(" · ");
}

function month_(dateKey: string) {
  return Number(dateKey.slice(5, 7));
}

function weekdayOf(dateKey: string) {
  const [y, m, d] = dateKey.split("-").map(Number);
  return WEEKDAY[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
}

/** 날짜가 그 달의 몇째 주인지 (월요일 시작). */
function weekOfMonth(dateKey: string) {
  const [y, m, d] = dateKey.split("-").map(Number);
  const firstDow = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7;
  return Math.floor((d - 1 + firstDow) / 7) + 1;
}

export default async function TrainerSchedulePage({
  searchParams,
}: PageProps<"/trainer/schedule">) {
  const user = await requireUser();
  const query = await searchParams;
  const dateKey = typeof query.date === "string" ? query.date : undefined;
  const show: Show = query.show === "remaining" || query.show === "finish" ? query.show : "all";
  // 주간이 기본. 월간은 한 달을 훑어보고 날짜를 고를 때 쓴다.
  const view: "week" | "month" = query.view === "month" ? "month" : "week";

  const [week, month, contracts] = await Promise.all([
    getTrainerWeek(user.id, dateKey),
    view === "month" ? getTrainerMonth(user.id, dateKey) : Promise.resolve(null),
    listSchedulableContracts(user.id),
  ]);

  const [year] = week.dateKey.split("-").map(Number);
  const isToday = week.dateKey === week.todayDateKey;

  const active = week.sessions.filter((session) => session.status !== "CANCELLED");
  const remaining = week.sessions.filter(
    (session) => session.status === "SCHEDULED" && session.managementEvents.length === 0,
  );
  const needFinish = week.sessions.filter((session) => session.managementEvents.length > 0);
  // 다음 수업은 오늘 볼 때만 칠한다. 다른 날짜의 첫 수업을 "다음" 이라 부르면 틀린 말이다.
  const nextId = isToday ? (remaining[0]?.id ?? null) : null;

  const visible =
    show === "remaining" ? remaining : show === "finish" ? needFinish : week.sessions;

  // 날짜·보기·필터를 한 주소에 모은다. 날짜를 바꿔도 보던 방식(주/월)은 그대로 둔다.
  const href = ({
    date = week.dateKey,
    nextView = view,
    nextShow = show,
  }: { date?: string; nextView?: "week" | "month"; nextShow?: Show }) => {
    const params = new URLSearchParams({ date });
    if (nextView === "month") params.set("view", "month");
    if (nextShow !== "all") params.set("show", nextShow);
    return `/trainer/schedule?${params.toString()}`;
  };
  const filterHref = (target: Show) => href({ nextShow: target });
  // 월요일 시작 달력의 앞쪽 빈칸 수.
  const leadingBlank = month
    ? (() => {
        const [y, m] = month.monthStartDateKey.split("-").map(Number);
        return (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7;
      })()
    : 0;

  return (
    <main className="flex flex-col pb-6">
      <header className="flex items-center gap-2 py-3.5 pr-4 pl-5">
        <h1 className="min-w-0 flex-1 text-xl font-extrabold">일정</h1>
        <a
          href="#new-session"
          className="flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-ink pr-3.5 pl-2.5 text-[0.8125rem] font-bold text-white"
        >
          <span className="flex size-5.5 items-center justify-center rounded-full bg-brand text-ink">
            <Plus className="size-3.5" strokeWidth={3} aria-hidden />
          </span>
          수업 추가
        </a>
      </header>

      {/* 보기 전환: 주 / 월 */}
      <nav aria-label="보기" className="mx-4 grid grid-cols-2 rounded-full bg-surface p-1 text-center">
        {(
          [
            ["week", "주간"],
            ["month", "월간"],
          ] as const
        ).map(([key, label]) => (
          <Link
            key={key}
            href={href({ nextView: key })}
            scroll={false}
            aria-current={view === key ? "page" : undefined}
            className={cn(
              "flex h-8.5 items-center justify-center rounded-full text-[0.8125rem] font-bold",
              view === key ? "bg-card text-ink shadow-[0_1px_2px_rgb(0_0_0/8%)]" : "text-muted-foreground",
            )}
          >
            {label}
          </Link>
        ))}
      </nav>

      {view === "week" ? (
        <section className="mt-3 border-b border-line pb-3">
          <div className="flex items-center gap-2 px-4 pb-2.5">
            <Link
              href={href({ date: week.prevWeekDateKey })}
              aria-label="이전 주"
              className="flex size-9 shrink-0 items-center justify-center rounded-full border border-border text-ink"
            >
              <ChevronLeft className="size-4" aria-hidden />
            </Link>
            <b className="min-w-0 flex-1 text-center text-[0.9375rem] tabular-nums">
              {year}년 {month_(week.dateKey)}월 · {weekOfMonth(week.dateKey)}주차
            </b>
            <Link
              href={href({ date: week.nextWeekDateKey })}
              aria-label="다음 주"
              className="flex size-9 shrink-0 items-center justify-center rounded-full border border-border text-ink"
            >
              <ChevronRight className="size-4" aria-hidden />
            </Link>
          </div>

          <ul className="grid grid-cols-7 px-2.5 text-center">
            {week.days.map((day) => {
              const weekday = weekdayOf(day.dateKey);
              return (
                <li key={day.dateKey} className="min-w-0">
                  <Link
                    href={href({ date: day.dateKey })}
                    scroll={false}
                    aria-current={day.isSelected ? "date" : undefined}
                    aria-label={`${formatKstDateLabel(new Date(`${day.dateKey}T00:00:00+09:00`))} 수업 ${day.count}개`}
                    className="flex flex-col items-center gap-1"
                  >
                    <span className={cn("text-[0.6875rem]", weekday === "일" ? "text-status-urgent" : "text-faint")}>
                      {day.isToday ? "오늘" : weekday}
                    </span>
                    <span
                      className={cn(
                        "flex size-9.5 items-center justify-center rounded-full text-[0.9375rem] font-bold tabular-nums",
                        day.isSelected
                          ? "bg-primary text-white"
                          : day.isToday
                            ? "bg-brand-muted text-primary"
                            : "text-ink",
                      )}
                    >
                      {Number(day.dateKey.slice(8))}
                    </span>
                    <span className={cn("text-[0.6875rem] font-bold tabular-nums", day.isSelected ? "text-primary" : "text-faint")}>
                      {day.count > 0 ? `${day.count}건` : "–"}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ) : month ? (
        <section className="mx-4 mt-3 rounded-[1.375rem] border border-border px-2 pt-2.5 pb-3">
          <div className="flex items-center gap-2 px-1.5 pb-2">
            <Link
              href={href({ date: month.prevMonthDateKey })}
              aria-label="지난 달"
              className="flex size-9 shrink-0 items-center justify-center rounded-full border border-border text-ink"
            >
              <ChevronLeft className="size-4" aria-hidden />
            </Link>
            <b className="min-w-0 flex-1 text-center text-[0.9375rem] tabular-nums">
              {month.monthStartDateKey.slice(0, 4)}년 {Number(month.monthStartDateKey.slice(5, 7))}월
            </b>
            <Link
              href={href({ date: month.nextMonthDateKey })}
              aria-label="다음 달"
              className="flex size-9 shrink-0 items-center justify-center rounded-full border border-border text-ink"
            >
              <ChevronRight className="size-4" aria-hidden />
            </Link>
          </div>

          <div className="grid grid-cols-7 text-center">
            {["월", "화", "수", "목", "금", "토", "일"].map((label) => (
              <span
                key={label}
                className={cn("pb-1 text-[0.6875rem]", label === "일" ? "text-status-urgent" : "text-faint")}
              >
                {label}
              </span>
            ))}
            {Array.from({ length: leadingBlank }, (_, index) => (
              <span key={`blank-${index}`} aria-hidden />
            ))}
            {month.days.map((day) => (
              <Link
                key={day.dateKey}
                href={href({ date: day.dateKey })}
                scroll={false}
                aria-current={day.isSelected ? "date" : undefined}
                aria-label={`${formatKstDateLabel(new Date(`${day.dateKey}T00:00:00+09:00`))} 수업 ${day.count}개`}
                className="flex min-w-0 flex-col items-center gap-0.5 py-1"
              >
                <span
                  className={cn(
                    "flex size-8.5 items-center justify-center rounded-full text-[0.8125rem] font-bold tabular-nums",
                    day.isSelected
                      ? "bg-primary text-white"
                      : day.isToday
                        ? "bg-brand-muted text-primary"
                        : "text-ink",
                  )}
                >
                  {Number(day.dateKey.slice(8))}
                </span>
                <span
                  className={cn(
                    "h-3.5 text-[0.6875rem] leading-3.5 font-bold tabular-nums",
                    day.count > 0 ? (day.isSelected ? "text-primary" : "text-muted-foreground") : "text-transparent",
                  )}
                >
                  {day.count > 0 ? `${day.count}건` : "·"}
                </span>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <div className="flex flex-col gap-3 px-4 pt-3.5">
        <div className="flex items-baseline justify-between gap-2 px-1">
          <b className="text-[1.0625rem]">
            {formatKstDateLabel(new Date(`${week.dateKey}T00:00:00+09:00`))}
          </b>
          <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
            수업 {active.length} · 남은 {remaining.length}
          </span>
        </div>

        <nav aria-label="보기" className="flex flex-wrap gap-1.5">
          {(
            [
              ["all", `전체 ${week.sessions.length}`],
              ["remaining", `남은 수업 ${remaining.length}`],
              ["finish", `마무리 필요 ${needFinish.length}`],
            ] as const
          ).map(([key, label]) => {
            const on = show === key;
            return (
              <Link
                key={key}
                href={filterHref(key)}
                scroll={false}
                aria-current={on ? "page" : undefined}
                className={cn(
                  "rounded-full px-3.25 py-2 text-xs font-bold whitespace-nowrap",
                  on
                    ? "bg-ink text-white"
                    : key === "finish" && needFinish.length > 0
                      ? "bg-status-urgent-bg text-status-urgent"
                      : "bg-surface text-[#4b5650]",
                )}
              >
                {label}
              </Link>
            );
          })}
        </nav>

        {visible.length === 0 ? (
          <EmptyDay
            message={
              week.sessions.length === 0 ? "이 날은 잡힌 수업이 없어요" : "해당하는 수업이 없어요"
            }
          />
        ) : (
          <ol className="flex flex-col">
            {visible.map((session, index) => {
              const tone = toneOf(session, nextId);
              const style = TONE[tone];
              const cta =
                tone === "need" ? "수업 마무리" : tone === "next" ? "수업 기록 열기" : null;
              const last = index === visible.length - 1;

              return (
                // 시간 · 선 · 카드를 세 칸으로 나눈다. 칸이 겹치지 않아 시간 글자가 점이나 카드에 가리지 않는다.
                <li key={session.id} className="grid grid-cols-[2.75rem_1.25rem_minmax(0,1fr)] gap-x-1.5">
                  <span
                    className={cn(
                      "pt-3.25 text-right text-[0.8125rem] font-extrabold tabular-nums",
                      style.time,
                    )}
                  >
                    {toKstTimeValue(session.scheduledAt)}
                  </span>

                  <span aria-hidden className="relative flex justify-center">
                    {visible.length > 1 ? (
                      <span
                        className={cn(
                          "absolute w-0 border-l-2 border-dashed border-[#dfe4e1]",
                          index === 0 ? "top-4.5 bottom-0" : last ? "top-0 h-4.5" : "top-0 bottom-0",
                        )}
                      />
                    ) : null}
                    <span
                      className={cn(
                        "relative z-10 mt-3.75 size-3 shrink-0 rounded-full shadow-[0_0_0_3px_#fff]",
                        style.dot,
                      )}
                    />
                  </span>

                  <div className={cn("mb-2.5 min-w-0 rounded-[1.25rem] px-3.5 py-3", style.card)}>
                    <Link href={`/trainer/sessions/${session.id}`} className="block">
                      <span className="flex min-w-0 items-center gap-2">
                        <b
                          className={cn(
                            "min-w-0 truncate text-[0.9375rem]",
                            tone === "cancel" && "line-through",
                          )}
                        >
                          {session.memberName}
                        </b>
                        <span className="shrink-0 text-[0.6875rem] opacity-75 tabular-nums">
                          {session.sessionNumber}회차
                        </span>
                        <span
                          className={cn(
                            "ml-auto shrink-0 rounded-full border px-2.25 py-0.5 text-[0.6875rem] font-bold whitespace-nowrap",
                            style.pill,
                          )}
                        >
                          {session.status === "NO_SHOW" && tone === "done" ? "노쇼" : style.status}
                        </span>
                      </span>
                      <span className={cn("mt-1 block truncate text-xs", style.sub)}>
                        {subOf(session)}
                      </span>
                    </Link>
                    {cta ? (
                      <form action={enterSessionRecord} className="mt-2.5">
                        <input type="hidden" name="ptSessionId" value={session.id} />
                        <button
                          type="submit"
                          className={cn(
                            "flex h-9.5 w-full items-center justify-center rounded-full text-[0.8125rem] font-extrabold",
                            tone === "next" ? "bg-brand text-ink" : "bg-surface text-ink",
                          )}
                        >
                          {cta}
                        </button>
                      </form>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ol>
        )}

        <div className="mt-2">
          <NewSessionPanel
            dateKey={week.dateKey}
            contracts={contracts}
            defaultTime={nextFreeTime(week.sessions)}
          />
        </div>
      </div>
    </main>
  );
}
