import {
  Bell,
  CalendarDays,
  ChevronRight,
  Dumbbell,
  Flame,
  NotebookPen,
  Play,
  Plus,
  X,
} from "lucide-react";
import Link from "next/link";

import { requireUser } from "@/app/lib/dal";
import { ElapsedTime } from "@/components/elapsed-time";
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
  getRecentDailySets,
  getRecentSessions,
  getSessionsByDate,
} from "@/server/workouts/workout.service";
import { countDietOnDate } from "@/server/diet/diet.service";
import { getUnreadCounts } from "@/server/journals/journal.service";
import { getBodyOverview } from "@/server/body/body.service";
import { getMyUpcomingSessions } from "@/server/pt/pt.service";
import { getNotificationUnreadCount } from "@/server/notifications/notification.service";

import { AcknowledgeButton } from "../sessions/acknowledge-button";
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
    dailySets,
    daySessions,
    unread,
    recentSessions,
    todayDiet,
    upcomingSessions,
    body,
    unreadNotifications,
  ] = await Promise.all([
    getActiveSession(user.id),
    getRecentDailySets(user.id, 30),
    selectedKey ? getSessionsByDate(user.id, selectedKey) : null,
    getUnreadCounts(user.id),
    getRecentSessions(user.id, 3),
    countDietOnDate(user.id, todayKey),
    getMyUpcomingSessions(user.id, 3),
    getBodyOverview(user.id),
    getNotificationUnreadCount(user.id),
  ]);

  const workoutDays = new Set(dayKeys.filter((key) => dailySets.has(key)));
  const setsOf = (key: string) => dailySets.get(key) ?? 0;
  const weekSets = dayKeys.reduce((sum, key) => sum + setsOf(key), 0);
  const prevWeekSets = Array.from({ length: 7 }, (_, index) =>
    setsOf(toKstDateKey(kstDaysAgo(13 - index))),
  ).reduce((sum, value) => sum + value, 0);
  const weekDelta = weekSets - prevWeekSets;
  const maxDaySets = Math.max(1, ...dayKeys.map(setsOf));

  // 연속 기록: 오늘 아직 안 했으면 어제부터 센다. 오늘 하루 비었다고 끊기면 아침마다 0일이 된다.
  let streak = 0;
  for (let back = dailySets.has(todayKey) ? 0 : 1; back < 30; back += 1) {
    if (!dailySets.has(toKstDateKey(kstDaysAgo(back)))) break;
    streak += 1;
  }

  // 체중은 늘 있는 것만 보여준다. 세 지표를 다 그리면 홈이 체성분 화면이 된다.
  const weight = body.trends.find((trend) => trend.type === "WEIGHT") ?? null;
  const weightGoal = body.goals.find((goal) => goal.type === "WEIGHT") ?? null;

  const unreadLabel = [
    unread.journals > 0 ? `알림장 ${unread.journals}개` : null,
    unread.notices > 0 ? `공지 ${unread.notices}개` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  // 카드에 크게 띄울 다음 수업. 취소된 수업은 아래 알림 줄이 따로 말한다.
  const nextPt =
    upcomingSessions.find((session) => session.status !== "CANCELLED") ?? null;
  const changedSessions = upcomingSessions.filter((session) => session.changed);

  const nextPtDays = nextPt
    ? Math.round(
        (new Date(`${toKstDateKey(nextPt.scheduledAt)}T00:00:00+09:00`).getTime() -
          new Date(`${todayKey}T00:00:00+09:00`).getTime()) /
          86_400_000,
      )
    : null;

  // 링: 다음 PT 가 있으면 회차 진행률, 없으면 최근 7일 중 운동한 날 비율.
  const ringRatio = nextPt
    ? Math.min(nextPt.sessionNumber / Math.max(nextPt.totalSessions, 1), 1)
    : workoutDays.size / 7;

  return (
    <main className="flex flex-col gap-3 px-4 pt-4">
      {/* 머리말: 아바타 · 이름 · 연속 기록 · 동그란 아이콘 버튼 */}
      <header className="flex items-center gap-2.5 px-1 pb-0.5">
        <span className="flex size-10.5 shrink-0 items-center justify-center rounded-full bg-brand-muted text-base font-extrabold text-primary">
          {user.name.slice(0, 1)}
        </span>
        <span className="min-w-0 flex-1 leading-tight">
          <span className="block truncate text-base font-bold">{user.name}님</span>
          {streak > 1 ? (
            <span className="mt-0.5 inline-flex items-center gap-1 rounded-full bg-brand-muted px-2 py-0.5 text-[0.6875rem] font-bold text-primary">
              <Flame className="size-3" aria-hidden />
              {streak}일 연속 기록 중
            </span>
          ) : (
            <span className="block text-xs text-muted-foreground">
              {formatKstDateLabel(new Date())}
            </span>
          )}
        </span>
        <RoundLink href="/calendar" label="캘린더">
          <CalendarDays className="size-[1.1875rem]" aria-hidden />
        </RoundLink>
        <RoundLink
          href="/notifications"
          label={
            unreadNotifications > 0
              ? `알림 ${unreadNotifications}개 읽지 않음`
              : "알림"
          }
        >
          <Bell className="size-[1.1875rem]" aria-hidden />
          {unreadNotifications > 0 ? (
            <span className="absolute top-2.5 right-2.5 size-[0.4375rem] rounded-full bg-coral" />
          ) : null}
        </RoundLink>
      </header>

      {/* 일정 변경 · 취소. 확인할 때까지 붙잡아 둔다. 주의는 코랄 테두리 하나로만. */}
      {changedSessions.map((session) => {
        const cancelled = session.status === "CANCELLED";
        return (
          <div
            key={session.id}
            className="flex items-center gap-2.5 rounded-2xl border-[1.5px] border-coral py-2.5 pr-2 pl-3.5"
          >
            <span className="min-w-0 flex-1">
              <span className="block text-[0.8125rem] font-bold">
                {cancelled ? "수업이 취소됐어요" : "수업 일정이 바뀌었어요"}
              </span>
              <span className="block truncate text-xs text-muted-foreground tabular-nums">
                {formatKstDateLabel(session.scheduledAt)}{" "}
                {formatKstTimeLabel(session.scheduledAt)}
                {cancelled && session.cancelReason ? ` · ${session.cancelReason}` : ""}
              </span>
            </span>
            <AcknowledgeButton sessionId={session.id} />
          </div>
        );
      })}

      {/*
        다음 PT. 가장 큰 숫자는 "며칠 남았나", 오른쪽 링은 계약 회차 진행률.
        PT 가 없으면 최근 7일 운동한 날을 보여준다.
      */}
      <Link
        href="/sessions"
        className="relative flex items-center gap-3 overflow-hidden rounded-3xl bg-primary py-4.5 pr-4.5 pl-5 text-white"
      >
        <Dumbbell
          aria-hidden
          strokeWidth={1.6}
          className="pointer-events-none absolute -right-4 -bottom-6 size-36 opacity-[0.08]"
        />
        <span className="relative min-w-0 flex-1">
          <span className="block text-xs font-semibold text-white/75">
            {nextPt ? "다음 PT" : formatKstDateLabel(new Date())}
          </span>
          {nextPt && nextPtDays !== null ? (
            <>
              <span className="mt-1 block text-[2.625rem] leading-none font-extrabold tracking-tight tabular-nums">
                {nextPtDays <= 0 ? "오늘" : `D-${nextPtDays}`}
              </span>
              <span className="mt-2 block text-[0.8125rem] font-semibold tabular-nums">
                {formatKstDateLabel(nextPt.scheduledAt)}{" "}
                {formatKstTimeLabel(nextPt.scheduledAt)}
              </span>
              <span className="block truncate text-xs text-white/75">
                {nextPt.trainerName} 트레이너 · {nextPt.durationMinutes}분
              </span>
            </>
          ) : (
            <span className="mt-1.5 block text-[1.375rem] leading-snug font-extrabold tracking-tight">
              {activeSession
                ? "운동 중이에요. 화이팅!"
                : workoutDays.size > 0
                  ? `최근 7일 중 ${workoutDays.size}일 운동했어요`
                  : "오늘 가볍게 시작해 볼까요"}
            </span>
          )}
        </span>

        <ProgressRing
          ratio={ringRatio}
          value={nextPt ? String(nextPt.sessionNumber) : `${workoutDays.size}`}
          caption={nextPt ? `/ ${nextPt.totalSessions}회차` : "/ 7일"}
        />
      </Link>

      {/* 주 버튼. 화면 아래에 고정하지 않고 다음 PT 카드 바로 아래에 둔다. */}
      {activeSession ? (
        <Link
          href={`/workouts/${activeSession.id}`}
          className="flex h-14 items-center rounded-full bg-ink pr-1.5 pl-5.5 text-white"
        >
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[0.9375rem] font-bold">
              {activeSession.records.length > 0
                ? `${activeSession.records[0].exercise.name}${
                    activeSession.records.length > 1
                      ? ` 외 ${activeSession.records.length - 1}개`
                      : ""
                  }`
                : "운동 중"}
            </span>
            <span className="block text-[0.6875rem] text-white/70 tabular-nums">
              <ElapsedTime initialSeconds={activeSession.elapsedSec ?? 0} /> ·{" "}
              {activeSession.totalSets}세트
            </span>
          </span>
          <span className="mr-2.5 shrink-0 text-xs font-bold text-brand">이어서 하기</span>
          <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-brand text-ink">
            <Play className="size-4 fill-current" aria-hidden />
          </span>
        </Link>
      ) : (
        <div>
          <StartWorkoutButton />
        </div>
      )}

      {/* 새 알림장 · 공지 */}
      {unread.total > 0 ? (
        <Link
          href="/journal"
          className="flex items-center gap-2.5 rounded-2xl border-[1.5px] border-brand-mid py-2.5 pr-2 pl-3"
        >
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-muted text-primary">
            <NotebookPen className="size-4" aria-hidden />
          </span>
          <span className="min-w-0 flex-1 truncate text-[0.8125rem] font-bold">
            {unreadLabel} 새로 왔어요
          </span>
          <span className="shrink-0 rounded-full bg-surface px-3 py-2 text-xs font-bold">
            읽기
          </span>
        </Link>
      ) : null}

      {/*
        최근 7일 세트 막대.
        막대를 누르면 그날 기록이 카드 안에서 열리고, 한 번 더 누르면 닫힌다.
      */}
      <section className="rounded-[1.375rem] border border-border px-3.5 pt-4 pb-3.5">
        <div className="flex items-start justify-between gap-2">
          <span className="min-w-0">
            <span className="block text-xs text-muted-foreground">
              최근 7일 · {workoutDays.size}일 운동
            </span>
            <span className="block text-2xl font-extrabold tracking-tight tabular-nums">
              {weekSets}
              <span className="ml-0.5 text-[0.8125rem] font-semibold">세트</span>
            </span>
          </span>
          {prevWeekSets > 0 || weekSets > 0 ? (
            <span
              className={cn(
                "shrink-0 rounded-full px-2.5 py-1 text-[0.6875rem] font-bold tabular-nums",
                weekDelta >= 0 ? "bg-brand-muted text-primary" : "bg-surface text-muted-foreground",
              )}
            >
              {weekDelta === 0
                ? "지난주와 같아요"
                : `${weekDelta > 0 ? "▲" : "▼"} 지난주보다 ${Math.abs(weekDelta)}세트`}
            </span>
          ) : null}
        </div>

        <ul className="mt-2.5 grid h-28 grid-cols-7 items-end gap-2">
          {days.map((day, index) => {
            const key = toKstDateKey(day);
            const sets = setsOf(key);
            const done = workoutDays.has(key);
            const isToday = key === todayKey;
            const isSelected = key === selectedKey;
            const height = done ? 12 + Math.round((sets / maxDaySets) * 58) : 8;

            return (
              <li key={key} className="h-full min-w-0">
                <Link
                  href={isSelected ? "/home" : `/home?day=${key}`}
                  scroll={false}
                  aria-current={isSelected ? "date" : undefined}
                  aria-label={`${formatKstDateLabel(day)}${done ? ` ${sets}세트` : ""} 기록 ${
                    isSelected ? "닫기" : "보기"
                  }`}
                  className="flex h-full flex-col items-center justify-end gap-1"
                >
                  <span
                    className={cn(
                      "text-[0.6875rem] font-bold tabular-nums",
                      isToday ? "text-primary" : "text-faint",
                    )}
                  >
                    {done && sets > 0 ? sets : ""}
                  </span>
                  <span
                    aria-hidden
                    style={{
                      height,
                      background: done
                        ? index === 6
                          ? "linear-gradient(180deg, var(--brand), var(--primary))"
                          : "#cdeee0"
                        : "#f0f2f0",
                    }}
                    className={cn(
                      "w-full rounded-lg",
                      isSelected && "ring-2 ring-primary ring-offset-2",
                    )}
                  />
                  <span
                    className={cn(
                      "text-[0.6875rem]",
                      isToday || isSelected ? "font-bold text-foreground" : "text-faint",
                    )}
                  >
                    {isToday ? "오늘" : kstWeekdayLabel(day)}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>

        {selectedKey && daySessions ? (
          <div className="mt-3 rounded-2xl bg-[#f7f8f7] p-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-[0.8125rem] font-bold">
                {formatKstDateLabel(new Date(`${selectedKey}T00:00:00+09:00`))}
                {selectedKey === todayKey ? " · 오늘" : ""}
              </h3>
              <Link
                href="/home"
                scroll={false}
                aria-label="닫기"
                className="-mr-1 flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-card"
              >
                <X className="size-4" />
              </Link>
            </div>

            {daySessions.length === 0 ? (
              <p className="py-3 text-center text-sm text-muted-foreground">
                이 날은 기록이 없어요.
              </p>
            ) : (
              <ul className="flex flex-col divide-y divide-border">
                {daySessions.map((session) => (
                  <li key={session.id}>
                    <Link href={`/workouts/${session.id}`} className="block py-2">
                      <span className="flex items-center gap-1.5">
                        {session.isPt ? <PtBadge /> : null}
                        <span className="min-w-0 flex-1 truncate text-[0.8125rem] font-bold">
                          {session.records.length > 0
                            ? `${session.records[0].exercise.name}${
                                session.records.length > 1
                                  ? ` 외 ${session.records.length - 1}개`
                                  : ""
                              }`
                            : "기록한 운동이 없어요"}
                        </span>
                        <span className="shrink-0 text-[0.6875rem] text-muted-foreground tabular-nums">
                          {session.totalSets}세트
                          {session.totalVolume > 0
                            ? ` · ${session.totalVolume.toLocaleString()}kg`
                            : ""}
                          {session.durationSec
                            ? ` · ${formatDuration(session.durationSec)}`
                            : ""}
                        </span>
                      </span>

                      {session.records.length > 0 ? (
                        <span className="mt-1.5 flex flex-col gap-0.5">
                          {session.records.map((record) => (
                            <span
                              key={record.id}
                              className="flex items-baseline justify-between gap-2 text-xs text-muted-foreground"
                            >
                              <span className="min-w-0 truncate">{record.exercise.name}</span>
                              <span className="shrink-0 tabular-nums">
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

            <div className="mt-2">
              <LogPastWorkoutButton
                defaultDate={selectedKey}
                label={
                  daySessions.length > 0 ? "이 날짜에 기록 추가" : "이 날짜 기록하기"
                }
                hideDateInput
              />
            </div>
          </div>
        ) : null}
      </section>

      {/* 체중 · 오늘 식단 */}
      <div className="grid grid-cols-2 gap-2.5">
        {weight && weight.latest !== null ? (
          <Link href="/body" className="min-w-0 rounded-[1.25rem] bg-[#f7f8f7] p-3.5">
            <span className="flex items-center justify-between gap-1.5">
              <span className="text-xs text-muted-foreground">체중</span>
              {weight.delta !== null && weight.delta !== 0 ? (
                <span className="shrink-0 text-[0.6875rem] font-bold text-primary tabular-nums">
                  {weight.delta > 0 ? "▲" : "▼"}
                  {Math.abs(weight.delta)}
                </span>
              ) : null}
            </span>
            <span className="mt-1 block text-[1.375rem] font-extrabold tabular-nums">
              {weight.latest}
              <span className="text-xs font-semibold">{weight.unit}</span>
            </span>
            <Sparkline values={weight.points.slice(-8).map((point) => point.value)} />
            <span className="block truncate text-[0.6875rem] text-muted-foreground tabular-nums">
              {weightGoal && weightGoal.remaining !== null
                ? weightGoal.reached
                  ? "목표 달성"
                  : `목표까지 ${weightGoal.remaining}${weightGoal.unit}`
                : weight.delta === null
                  ? "한 번 더 재면 변화를 보여드려요"
                  : "지난번 기록과 비교"}
            </span>
          </Link>
        ) : (
          <Link href="/body" className="min-w-0 rounded-[1.25rem] bg-[#f7f8f7] p-3.5">
            <span className="text-xs text-muted-foreground">체중</span>
            <span className="mt-1 block text-[0.9375rem] font-bold">처음 기록하기</span>
            <span className="mt-1 block text-[0.6875rem] text-muted-foreground">
              재면 변화를 보여드려요
            </span>
          </Link>
        )}

        <div className="relative min-w-0 rounded-[1.25rem] bg-[#f7f8f7] p-3.5">
          <Link href="/diet" className="absolute inset-0 rounded-[1.25rem]" aria-label="식단 보기" />
          <span className="flex items-center justify-between gap-1.5">
            <span className="text-xs text-muted-foreground">오늘 식단</span>
            <Link
              href="/diet/new"
              aria-label="식단 남기기"
              className="relative flex size-6.5 shrink-0 items-center justify-center rounded-full bg-primary text-white"
            >
              <Plus className="size-4" aria-hidden />
            </Link>
          </span>
          <span className="mt-1 block text-[1.375rem] font-extrabold tabular-nums">
            {todayDiet}
            <span className="text-xs font-semibold">끼</span>
          </span>
          <span aria-hidden className="mt-2 flex gap-1">
            {[0, 1, 2].map((index) => (
              <span
                key={index}
                className={cn(
                  "h-1.5 flex-1 rounded-full",
                  index < todayDiet ? "bg-primary" : "bg-border",
                )}
              />
            ))}
          </span>
          <span className="mt-2 block truncate text-[0.6875rem] text-muted-foreground">
            {todayDiet === 0 ? "사진 한 장이면 충분해요" : "트레이너가 볼 수 있어요"}
          </span>
        </div>
      </div>

      {/* 최근 운동 */}
      {recentSessions.length > 0 ? (
        <section className="mt-1">
          <div className="flex items-center justify-between px-1 py-1">
            <h2 className="text-base font-extrabold">최근 운동</h2>
            <Link
              href="/calendar"
              className="flex items-center text-xs font-semibold text-muted-foreground"
            >
              전체
              <ChevronRight className="size-3.5" aria-hidden />
            </Link>
          </div>

          <ul className="flex flex-col">
            {recentSessions.map((session) => (
              <li key={session.id}>
                <Link
                  href={`/workouts/${session.id}`}
                  className="flex items-center gap-3 border-b border-line px-1 py-2.5"
                >
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-[0.875rem] bg-brand-muted text-primary">
                    <Dumbbell className="size-5.5" strokeWidth={1.8} aria-hidden />
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="flex min-w-0 items-center gap-1.5">
                      <span className="min-w-0 truncate text-sm font-bold">
                        {session.exerciseNames.length > 0
                          ? `${session.exerciseNames[0]}${
                              session.exerciseNames.length > 1
                                ? ` 외 ${session.exerciseNames.length - 1}개`
                                : ""
                            }`
                          : "기록한 운동이 없어요"}
                      </span>
                      {session.isPt ? <PtBadge /> : null}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground tabular-nums">
                      {formatKstDateLabel(session.startedAt)} · {session.totalSets}세트
                      {session.isPt && session.recordedByName
                        ? ` · ${session.recordedByName} 트레이너`
                        : session.durationSec
                          ? ` · ${formatDuration(session.durationSec)}`
                          : ""}
                    </span>
                  </span>

                  <ChevronRight className="size-4 shrink-0 text-faint" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}

function RoundLink({
  href,
  label,
  children,
}: {
  href: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-label={label}
      className="relative flex size-10.5 shrink-0 items-center justify-center rounded-full border border-border text-ink transition-colors hover:bg-surface"
    >
      {children}
    </Link>
  );
}

/** 진행 링. 딥그린 카드 안에서 쓴다. */
function ProgressRing({
  ratio,
  value,
  caption,
}: {
  ratio: number;
  value: string;
  caption: string;
}) {
  const radius = 38;
  const length = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(ratio, 1));

  return (
    <span className="relative size-24 shrink-0">
      <svg viewBox="0 0 96 96" className="size-24" aria-hidden>
        <circle
          cx="48"
          cy="48"
          r={radius}
          fill="none"
          stroke="rgb(255 255 255 / 14%)"
          strokeWidth="9"
        />
        <circle
          cx="48"
          cy="48"
          r={radius}
          fill="none"
          stroke="var(--brand)"
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={length}
          strokeDashoffset={length * (1 - clamped)}
          transform="rotate(-90 48 48)"
        />
      </svg>
      <span className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xl leading-none font-extrabold tabular-nums">{value}</span>
        <span className="text-[0.6875rem] text-white/75">{caption}</span>
      </span>
    </span>
  );
}

/** 체중 추이. 실제로 적은 값만 잇는다 — 두 점 미만이면 빈 줄만 남긴다. */
function Sparkline({ values }: { values: number[] }) {
  const width = 140;
  const height = 26;

  if (values.length < 2) return <span aria-hidden className="block h-6.5" />;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const path = values
    .map((value, index) => {
      const x = 2 + (index / (values.length - 1)) * (width - 4);
      const y = 4 + (1 - (value - min) / span) * (height - 8);
      return `${index === 0 ? "M" : "L"}${x},${y}`;
    })
    .join(" ");

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      aria-hidden
      className="block h-6.5 w-full"
    >
      <path
        d={path}
        fill="none"
        stroke="var(--brand)"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

function PtBadge() {
  return (
    <span className="shrink-0 rounded-full border border-brand px-1.5 py-px text-[0.6875rem] font-bold text-primary">
      PT
    </span>
  );
}
