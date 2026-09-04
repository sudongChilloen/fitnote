import { ChevronRight, Dumbbell, Flame } from "lucide-react";
import Link from "next/link";

import { logout } from "@/app/actions/auth";
import { requireUser } from "@/app/lib/dal";
import { ElapsedTime } from "@/components/elapsed-time";
import { Button } from "@/components/ui/button";
import { kstDaysAgo, kstWeekdayLabel, toKstDateKey } from "@/lib/date";
import { cn } from "@/lib/utils";
import {
  getActiveSession,
  getRecentWorkoutDays,
} from "@/server/workouts/workout.service";

import { LogPastWorkoutButton } from "../workouts/log-past-button";
import { StartWorkoutButton } from "../workouts/start-workout-button";

export const metadata = {
  title: "홈 | FitNote",
};

/** 최근 7일을 오늘이 마지막에 오도록 나열한다. */
function recentDays() {
  return Array.from({ length: 7 }, (_, index) => kstDaysAgo(6 - index));
}

export default async function HomePage() {
  const user = await requireUser();

  const [activeSession, workoutDays] = await Promise.all([
    getActiveSession(user.id),
    getRecentWorkoutDays(user.id),
  ]);

  const days = recentDays();
  const todayKey = toKstDateKey(new Date());

  return (
    <main className="flex flex-col gap-5 px-5 pt-8">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">안녕하세요</p>
          <h1 className="text-2xl font-bold tracking-tight">{user.name}님</h1>
        </div>

        <form action={logout}>
          <Button variant="ghost" size="sm" type="submit" className="text-muted-foreground">
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

            return (
              <li key={key} className="flex flex-col items-center gap-1.5">
                <span className="text-[0.6875rem] text-muted-foreground">
                  {kstWeekdayLabel(day)}
                </span>
                <span
                  className={cn(
                    "flex aspect-square w-full items-center justify-center rounded-xl text-xs font-bold",
                    done
                      ? "bg-brand text-brand-foreground"
                      : "bg-muted text-muted-foreground",
                    isToday && !done && "ring-2 ring-brand ring-offset-2 ring-offset-card",
                  )}
                >
                  {done ? <Dumbbell className="size-4" /> : key.slice(-2)}
                </span>
              </li>
            );
          })}
        </ul>
      </section>

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
