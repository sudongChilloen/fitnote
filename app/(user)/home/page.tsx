import {
  Bell,
  CalendarClock,
  ChevronRight,
  Dumbbell,
  Flame,
  TrendingUp,
  UserRound,
  UtensilsCrossed,
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
  formatKstTimeLabel,
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
import { countDietOnDate } from "@/server/diet/diet.service";
import { getUnreadCounts } from "@/server/journals/journal.service";
import { getBodyOverview } from "@/server/body/body.service";
import { getMyUpcomingSessions } from "@/server/pt/pt.service";

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

  const [
    activeSession,
    workoutDays,
    daySessions,
    unread,
    recentSessions,
    todayDiet,
    upcomingSessions,
    body,
  ] = await Promise.all([
    getActiveSession(user.id),
    getRecentWorkoutDays(user.id),
    selectedKey ? getSessionsByDate(user.id, selectedKey) : null,
    getUnreadCounts(user.id),
    getRecentSessions(user.id, 3),
    countDietOnDate(user.id, todayKey),
    getMyUpcomingSessions(user.id, 3),
    getBodyOverview(user.id),
  ]);

  // 체중은 늘 있는 것만 보여준다. 세 지표를 다 그리면 홈이 체성분 화면이 된다.
  const weight = body.trends.find((trend) => trend.type === "WEIGHT") ?? null;
  const weightGoal = body.goals.find((goal) => goal.type === "WEIGHT") ?? null;

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
        다음 PT.
        트레이너만 일정을 아는 상태가 제일 이상하다. 회원은 자기가 언제
        가는지 카톡을 뒤져서 확인하고 있었다.
      */}
      {upcomingSessions.length > 0 ? (
        <section className="rounded-2xl border border-border bg-card p-5">
          <div className="mb-3 flex items-center gap-2">
            <CalendarClock className="size-4 text-brand-strong" />
            <h2 className="text-sm font-bold">다음 PT</h2>
          </div>

          <ul className="flex flex-col gap-3">
            {upcomingSessions.map((session) => (
              <li key={session.id} className="flex items-center gap-3">
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold">
                    {formatKstDateLabel(session.scheduledAt)}{" "}
                    {formatKstTimeLabel(session.scheduledAt)}
                  </span>
                  <span className="mt-0.5 block text-xs text-muted-foreground tabular-nums">
                    {session.trainerName} 트레이너 · {session.sessionNumber}/
                    {session.totalSessions}회차 · {session.durationMinutes}분
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

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

      {/*
        체중.
        기록이 없으면 재촉하지 않는다. 홈에 "아직 안 쟀어요" 를 띄우면 매일
        아침 못 한 일을 확인하러 오는 화면이 된다. 한 번이라도 적은 사람에게만
        지금 값과 지난번 대비 변화를 보여준다.
      */}
      {weight && weight.latest !== null ? (
        <Link
          href="/body"
          className="flex items-center gap-3 rounded-2xl border border-border bg-card p-5"
        >
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-muted-foreground">
            <TrendingUp className="size-5" aria-hidden />
          </span>

          <span className="min-w-0 flex-1">
            <span className="block text-sm font-bold">
              체중 {weight.latest}
              {weight.unit}
            </span>
            <span className="mt-0.5 block text-xs text-muted-foreground tabular-nums">
              {weight.delta === null
                ? "한 번 더 재면 변화를 보여드려요"
                : weight.delta === 0
                  ? "지난번과 같아요"
                  : `지난번보다 ${weight.delta > 0 ? "+" : ""}${weight.delta}${weight.unit}`}
              {weightGoal && weightGoal.remaining !== null
                ? weightGoal.reached
                  ? " · 목표 달성"
                  : ` · 목표까지 ${weightGoal.remaining}${weightGoal.unit}`
                : ""}
            </span>
          </span>

          <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
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

      {/*
        오늘 식단.
        식단은 하루 서너 번 짧게 남기는 기록이라 진입이 깊으면 안 올린다. 홈에서
        한 번에 닿게 두고, 몇 끼를 남겼는지만 말한다. 목표 끼니 수 같은 건 정하지
        않았다 — 하루 두 끼 먹는 사람에게 "1/3" 은 못 채운 것처럼 보인다.
      */}
      <Link
        href="/diet"
        className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4"
      >
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-muted-foreground">
          <UtensilsCrossed className="size-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold">오늘 식단</span>
          <span className="block text-xs text-muted-foreground">
            {todayDiet === 0
              ? "사진 한 장이면 트레이너가 볼 수 있어요"
              : `${todayDiet}끼 남겼어요`}
          </span>
        </span>
        <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
      </Link>

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
