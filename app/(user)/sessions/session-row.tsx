import Link from "next/link";

import { Dumbbell, NotebookPen } from "lucide-react";

import { formatKstDateLabel, formatKstTimeLabel } from "@/lib/date";
import { cn } from "@/lib/utils";
import type { MyPtSessionRow } from "@/server/pt/pt.service";

/**
 * 회차 상태를 회원의 말로 옮긴다.
 *
 * 노쇼를 "노쇼" 라고 쓰지 않는다. 회원이 자기 기록에서 볼 말은 아니고,
 * 정작 알아야 하는 건 그래서 횟수가 빠졌는지다. 차감 여부는 상태에서
 * 유추하지 않고 기록된 값으로 따로 쓴다. 트레이너가 봐주기로 하고 안 뺀
 * 경우가 있는데, 화면이 "빠졌다" 고 단정하면 그게 거짓말이 된다.
 */
function labelOf(session: MyPtSessionRow) {
  switch (session.status) {
    case "COMPLETED":
      return { text: "완료", tone: "done" as const };
    case "NO_SHOW":
      return { text: "미참석", tone: "bad" as const };
    case "CANCELLED":
      return { text: "취소", tone: "muted" as const };
    default:
      return { text: "예정", tone: "next" as const };
  }
}

const TONE = {
  done: "bg-secondary text-foreground",
  bad: "bg-destructive/10 text-destructive",
  muted: "bg-secondary text-muted-foreground",
  next: "bg-brand text-brand-foreground",
} as const;

export function PtSessionRow({ session }: { session: MyPtSessionRow }) {
  const label = labelOf(session);
  const cancelled = session.status === "CANCELLED";
  const moved = session.reschedules[0] ?? null;

  return (
    <li className="flex gap-3 py-3">
      <span className="w-14 shrink-0 pt-0.5">
        <span className="block text-xs font-bold tabular-nums">
          {formatKstDateLabel(session.scheduledAt)}
        </span>
        <span className="mt-0.5 block text-[0.6875rem] text-muted-foreground tabular-nums">
          {formatKstTimeLabel(session.scheduledAt)}
        </span>
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-1.5">
          <span
            className={cn(
              "text-sm font-bold tabular-nums",
              cancelled && "text-muted-foreground line-through",
            )}
          >
            {session.sessionNumber}회차
          </span>
          <span
            className={cn(
              "rounded-full px-1.5 py-0.5 text-[0.625rem] font-bold",
              TONE[label.tone],
            )}
          >
            {label.text}
          </span>
          {/*
            빠진 회차에만 표시를 단다. 완료된 회차는 빠지는 게 당연해서 매 줄에
            "차감" 을 달면 글자만 늘고, 정작 눈에 걸려야 하는 건 안 갔는데
            빠진 회차다.
          */}
          {session.deducted && session.status !== "COMPLETED" ? (
            <span className="rounded-full bg-destructive/10 px-1.5 py-0.5 text-[0.625rem] font-bold text-destructive">
              횟수 차감
            </span>
          ) : null}
          {!session.deducted && session.status === "NO_SHOW" ? (
            <span className="rounded-full bg-secondary px-1.5 py-0.5 text-[0.625rem] font-bold text-muted-foreground">
              차감 안 됨
            </span>
          ) : null}
        </span>

        {moved ? (
          <span className="mt-0.5 block text-xs text-muted-foreground tabular-nums">
            {formatKstDateLabel(moved.fromScheduledAt)} →{" "}
            {formatKstDateLabel(moved.toScheduledAt)} 로 옮김
          </span>
        ) : null}

        {cancelled && session.cancelReason ? (
          <span className="mt-0.5 block text-xs text-muted-foreground">
            {session.cancelReason}
          </span>
        ) : null}

        {/*
          수업에서 남은 것으로 데려간다. 회차 줄에서 끝나면 "그날 뭐 했더라" 를
          다시 캘린더에서 찾아야 한다.
        */}
        {session.workoutSessionId || session.journalId ? (
          <span className="mt-1.5 flex flex-wrap gap-1.5">
            {session.workoutSessionId ? (
              <Link
                href={`/workouts/${session.workoutSessionId}`}
                className="inline-flex h-7 items-center gap-1 rounded-lg border border-border px-2 text-[0.6875rem] font-bold"
              >
                <Dumbbell className="size-3" aria-hidden />
                운동 기록
              </Link>
            ) : null}
            {session.journalId ? (
              <Link
                href={`/journal/${session.journalId}`}
                className="inline-flex h-7 items-center gap-1 rounded-lg border border-border px-2 text-[0.6875rem] font-bold"
              >
                <NotebookPen className="size-3" aria-hidden />
                알림장
              </Link>
            ) : null}
          </span>
        ) : null}
      </span>
    </li>
  );
}
