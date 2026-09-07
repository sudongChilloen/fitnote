import {
  Bell,
  ChevronRight,
  Dumbbell,
  Flame,
  UserRound,
  X,
} from "lucide-react";
import Link from "next/link";

import { logout } from "@/app/actions/auth";
import { requireUser } from "@/app/lib/dal";
import { ElapsedTime } from "@/components/elapsed-time";
import { Button } from "@/components/ui/button";
import {
  formatDuration,
  formatKstDateLabel,
  kstDaysAgo,
  kstWeekdayLabel,
  toKstDateKey,
} from "@/lib/date";
import { cn } from "@/lib/utils";
import {
  getActiveSession,
  getRecentSessions,
  getRecentWorkoutDays,
  getSessionsByDate,
} from "@/server/workouts/workout.service";
import { getUnreadCounts } from "@/server/journals/journal.service";

import { LogPastWorkoutButton } from "../workouts/log-past-button";
import { StartWorkoutButton } from "../workouts/start-workout-button";

export const metadata = {
  title: "홈 | FitNote",
};

/** 최근 7일을 오늘이 마지막에 오도록 나열한다. */
function recentDays() {
  return Array.from({ length: 7 }, (_, index) => kstDaysAgo(6 - index));
}

/**
 * "40kg × 10회 3세트" 처럼 한 줄로 줄인다.
 *
 * 무게와 횟수가 세트마다 다르면 하나로 못 줄이므로 세트 수만 말한다.
 * 억지로 평균을 내면 실제로 하지 않은 무게가 화면에 뜬다.
 */
function summarizeSets(sets: { weight: number | null; reps: number | null }[]) {
  if (sets.length === 0) return "기록 없음";

  const [first] = sets;
  const same = sets.every(
    (set) => set.weight === first.weight && set.reps === first.reps,
  );

  if (!same || first.reps === null) return `${sets.length}세트`;

  const weight = first.weight ? `${first.weight}kg × ` : "";

  return `${weight}${first.reps}회 ${sets.length}세트`;
}

export default async function HomePage({ searchParams }: PageProps<"/home">) {
  const user = await requireUser();

  const days = recentDays();
  const dayKeys = days.map(toKstDateKey);
  const todayKey = toKstDateKey(new Date());

  const params = await searchParams;

  // 주소로 들어오는 값이라 그대로 믿지 않는다.
  // 화면에 그린 7일 중 하나일 때만 연다. 아무 날짜나 열어주면 홈이
  // 캘린더 노릇을 하게 되는데, 그건 캘린더 탭이 할 일이다.
  const selectedKey =
    typeof params.day === "string" && dayKeys.includes(params.day)
      ? params.day
      : null;

  const [activeSession, workoutDays, daySessions, unread, recentSessions] =
    await Promise.all([
      getActiveSession(user.id),
      getRecentWorkoutDays(user.id),
      selectedKey ? getSessionsByDate(user.id, selectedKey) : null,
      getUnreadCounts(user.id),
      getRecentSessions(user.id, 3),
    ]);

  return (
    <main className="flex flex-col gap-5 px-5 pt-8">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">안녕하세요</p>
          <h1 className="text-2xl font-bold tracking-tight">{user.name}님</h1>
        </div>

        <form action={logout}>
          <Button
            variant="ghost"
            size="sm"
            type="submit"
            className="text-muted-foreground"
          >
            로그아웃
          </Button>
        </form>
      </header>

      {activeSession ? (
        <Link
          href={`/workouts/${activeSession.id}`}
          className="rounded-2xl border border-brand/40 bg-accent p-5"
        >
          <div className="flex items-center gap-2 text-sm font-bold text-accent-foreground">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-brand opacity-75" />
              <span className="relative inline-flex size-2 rounded-full bg-brand" />
            </span>
            운동 중
          </div>

          <p className="mt-2 text-xl font-bold">
            {activeSession.records.length > 0
              ? `${activeSession.records[0].exercise.name}${
                  activeSession.records.length > 1
                    ? ` 외 ${activeSession.records.length - 1}개`
                    : ""
                }`
              : "아직 기록한 운동이 없어요"}
          </p>

          <div className="mt-4 flex items-center justify-between border-t border-brand/30 pt-3 text-sm">
            <span className="text-accent-foreground/80">
              <ElapsedTime initialSeconds={activeSession.elapsedSec ?? 0} />{" "}
              진행 중 · {activeSession.totalSets}세트
            </span>
            <span className="flex items-center gap-0.5 font-bold text-brand-strong">
              이어서 하기
              <ChevronRight className="size-4" />
            </span>
          </div>
        </Link>
      ) : (
        <StartWorkoutButton />
      )}

      <LogPastWorkoutButton />

      {/*
        새로운 소식.
        읽을 게 없으면 아예 안 그린다. "새 소식 0개" 는 알려 주는 게 아니라
        자리만 차지한다. 알림장 · 공지를 나눠 적는 이유는 눌러 열기 전에
        무엇이 왔는지 알려주기 위해서다.
      */}
      {unread.total > 0 ? (
        <Link
          href="/journal"
          className="flex items-center gap-3 rounded-2xl border border-brand/40 bg-accent p-4"
        >
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand text-brand-foreground">
            <Bell className="size-5" />
          </span>

          <span className="min-w-0 flex-1">
            <span className="block text-sm font-bold text-accent-foreground">
              새로운 소식 {unread.total}개
            </span>
            <span className="block text-xs text-accent-foreground/80">
              {[
                unread.journals > 0 ? `알림장 ${unread.journals}개` : null,
                unread.notices > 0 ? `공지 ${unread.notices}개` : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </span>
          </span>

          <ChevronRight className="size-5 shrink-0 text-brand-strong" />
        </Link>
      ) : null}

      <section className="rounded-2xl border border-border bg-card p-5">
        <div className="mb-4 flex items-center gap-2">
          <Flame className="size-4 text-brand-strong" />
          <h2 className="text-sm font-bold">이번 주 운동</h2>
          <span className="ml-auto text-sm font-bold text-brand-strong">
            {workoutDays.size}일
          </span>
        </div>

        <ul className="grid grid-cols-7 gap-1.5">
          {days.map((day) => {
            const key = toKstDateKey(day);
            const done = workoutDays.has(key);
            const isToday = key === todayKey;
            const isSelected = key === selectedKey;

            return (
              <li key={key} className="flex flex-col items-center gap-1.5">
                <span className="text-[0.6875rem] text-muted-foreground">
                  {kstWeekdayLabel(day)}
                </span>
                {/*
                  한 번 더 누르면 닫힌다. 열기만 되고 닫히지 않으면
                  잘못 눌렀을 때 빠져나갈 방법이 없다.
                */}
                <Link
                  href={isSelected ? "/home" : `/home?day=${key}`}
                  scroll={false}
                  aria-current={isSelected ? "date" : undefined}
                  aria-label={`${formatKstDateLabel(day)} 기록 ${
                    isSelected ? "닫기" : "보기"
                  }`}
                  className={cn(
                    "flex aspect-square w-full items-center justify-center rounded-xl text-xs font-bold transition-colors",
                    done
                      ? "bg-brand text-brand-foreground"
                      : "bg-muted text-muted-foreground",
                    isToday &&
                      !done &&
                      "ring-2 ring-brand ring-offset-2 ring-offset-card",
                    isSelected &&
                      "ring-2 ring-primary ring-offset-2 ring-offset-card",
                  )}
                >
                  {done ? <Dumbbell className="size-4" /> : key.slice(-2)}
                </Link>
              </li>
            );
          })}
        </ul>

        {selectedKey && daySessions ? (
          <div className="mt-4 border-t border-border pt-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="text-sm font-bold">
                {formatKstDateLabel(new Date(`${selectedKey}T00:00:00+09:00`))}
                {selectedKey === todayKey ? " · 오늘" : ""}
              </h3>

              <Link
                href="/home"
                scroll={false}
                aria-label="닫기"
                className="flex size-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary"
              >
                <X className="size-4" />
              </Link>
            </div>

            {daySessions.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border py-6 text-center text-sm text-muted-foreground">
                이 날은 기록이 없어요.
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {daySessions.map((session) => (
                  <li key={session.id}>
                    <Link
                      href={`/workouts/${session.id}`}
                      className="block rounded-xl bg-secondary/60 p-3"
                    >
                      <span className="flex items-baseline justify-between gap-2">
                        <span className="flex min-w-0 items-baseline gap-1.5">
                          {session.isPt ? (
                            <span className="shrink-0 rounded-full bg-accent px-2 py-0.5 text-[0.65rem] font-bold text-brand-strong">
                              PT
                            </span>
                          ) : null}
                          <span className="truncate text-sm font-bold">
                            {session.records.length > 0
                              ? `${session.records[0].exercise.name}${
                                  session.records.length > 1
                                    ? ` 외 ${session.records.length - 1}개`
                                    : ""
                                }`
                              : "기록한 운동이 없어요"}
                          </span>
                        </span>
                        <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                          {session.totalSets}세트
                          {session.totalVolume > 0
                            ? ` · ${session.totalVolume.toLocaleString()}kg`
                            : ""}
                          {session.durationSec
                            ? ` · ${formatDuration(session.durationSec)}`
                            : ""}
                        </span>
                      </span>

                      {/*
                        운동 이름만 나열하면 "그날 뭘 했는지" 는 알아도
                        "얼마나 했는지" 는 모른다. 무게와 횟수까지 보여야
                        굳이 상세로 들어가지 않는다.
                      */}
                      {session.records.length > 0 ? (
                        <span className="mt-2 flex flex-col gap-0.5">
                          {session.records.map((record) => (
                            <span
                              key={record.id}
                              className="flex items-baseline justify-between gap-2 text-xs"
                            >
                              <span className="truncate text-muted-foreground">
                                {record.exercise.name}
                              </span>
                              <span className="shrink-0 text-muted-foreground tabular-nums">
                                {summarizeSets(record.sets)}
                              </span>
                            </span>
                          ))}
                        </span>
                      ) : null}
                    </Link>
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-3">
              <LogPastWorkoutButton
                defaultDate={selectedKey}
                label={
                  daySessions.length > 0
                    ? "이 날짜에 기록 추가"
                    : "이 날짜 기록하기"
                }
                hideDateInput
              />
            </div>
          </div>
        ) : null}
      </section>

      {/*
        최근 운동.
        주간 스트립은 "며칠 했는가" 만 말한다. 무엇을 했는지는 날짜를 눌러야
        나오는데, 지난 운동을 이어서 하려는 사람은 대개 날짜를 기억하지 못한다.
      */}
      {recentSessions.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-bold">최근 운동</h2>

          <ul className="flex flex-col gap-2">
            {recentSessions.map((session) => (
              <li key={session.id}>
                <Link
                  href={`/workouts/${session.id}`}
                  className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4"
                >
                  <span
                    className={cn(
                      "flex size-10 shrink-0 items-center justify-center rounded-xl",
                      session.isPt
                        ? "bg-brand text-brand-foreground"
                        : "bg-secondary text-muted-foreground",
                    )}
                  >
                    {session.isPt ? (
                      <UserRound className="size-5" />
                    ) : (
                      <Dumbbell className="size-5" />
                    )}
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      {/* PT 인지 개인 운동인지는 색이 아니라 글자로도 말한다. */}
                      {session.isPt ? (
                        <span className="shrink-0 rounded-full bg-accent px-2 py-0.5 text-[0.65rem] font-bold text-brand-strong">
                          PT
                        </span>
                      ) : null}
                      <span className="truncate text-sm font-bold">
                        {session.exerciseNames.length > 0
                          ? `${session.exerciseNames[0]}${
                              session.exerciseNames.length > 1
                                ? ` 외 ${session.exerciseNames.length - 1}개`
                                : ""
                            }`
                          : "기록한 운동이 없어요"}
                      </span>
                    </span>

                    <span className="block text-xs text-muted-foreground tabular-nums">
                      {formatKstDateLabel(session.startedAt)} ·{" "}
                      {session.totalSets}세트
                      {session.durationSec
                        ? ` · ${formatDuration(session.durationSec)}`
                        : ""}
                      {session.isPt && session.recordedByName
                        ? ` · ${session.recordedByName} 트레이너`
                        : ""}
                    </span>
                  </span>

                  <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <Link
        href="/exercises"
        className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4"
      >
        <span className="flex size-10 items-center justify-center rounded-xl bg-accent text-accent-foreground">
          <Dumbbell className="size-5" />
        </span>
        <span className="flex-1">
          <span className="block text-sm font-bold">운동 라이브러리</span>
          <span className="block text-xs text-muted-foreground">
            부위·기구별로 운동을 찾아보세요
          </span>
        </span>
        <ChevronRight className="size-5 text-muted-foreground" />
      </Link>
    </main>
  );
}
