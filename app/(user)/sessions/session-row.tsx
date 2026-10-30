import Link from "next/link";

import { ChevronRight } from "lucide-react";

import { formatKstDateLabel, formatKstTimeLabel, kstWeekdayLabel } from "@/lib/date";
import { cn } from "@/lib/utils";
import type { MyPtSessionRow } from "@/server/pt/pt.service";

/**
 * 회차 상태를 회원의 말로 옮긴다.
 *
 * 차감 여부는 상태에서 유추하지 않고 기록된 값으로 따로 쓴다. 트레이너가 봐주기로
 * 하고 안 뺀 경우가 있는데, 화면이 "빠졌다" 고 단정하면 그게 거짓말이 된다.
 */
function labelOf(session: MyPtSessionRow) {
  switch (session.status) {
    case "COMPLETED":
      return { text: "완료", tone: "done" as const };
    case "NO_SHOW":
      return { text: "노쇼", tone: "bad" as const };
    case "CANCELLED":
      return { text: "취소", tone: "muted" as const };
    default:
      return { text: "예정", tone: "next" as const };
  }
}

const FILLED = {
  done: "bg-brand-muted text-primary",
  bad: "bg-status-urgent-bg text-status-urgent",
  muted: "bg-surface text-muted-foreground",
  next: "bg-surface text-muted-foreground",
} as const;

function noteOf(session: MyPtSessionRow) {
  const moved = session.reschedules[0] ?? null;
  if (session.status === "CANCELLED") {
    return [
      session.cancelledBy === "MEMBER" ? "회원 취소" : session.cancelledBy === "TRAINER" ? "트레이너 취소" : null,
      session.deducted ? "1회 차감" : "차감 안 함",
      session.cancelReason,
    ]
      .filter(Boolean)
      .join(" · ");
  }
  if (session.status === "NO_SHOW") {
    return session.deducted ? "당일 미참석 · 1회 차감" : "당일 미참석 · 차감 안 됨";
  }
  if (moved) {
    return `${formatKstDateLabel(moved.fromScheduledAt)}에서 옮김`;
  }
  return null;
}

/** 앞으로 받을 회차. 큰 날짜 숫자 + 시간 + 상태 테두리 알약. */
function kstMonthOf(date: Date) {
  return new Date(date.getTime() + 9 * 60 * 60 * 1000).getUTCMonth();
}

function currentKstMonth() {
  return kstMonthOf(new Date());
}

export function UpcomingPtRow({
  session,
  trainerName,
}: {
  session: MyPtSessionRow;
  trainerName: string;
}) {
  const moved = session.reschedules[0] ?? null;
  const cancelled = session.status === "CANCELLED";
  const kst = new Date(session.scheduledAt.getTime() + 9 * 60 * 60 * 1000);
  const sameMonth = kst.getUTCMonth() === currentKstMonth();

  return (
    <li className="flex items-center gap-3 border-b border-line px-1 py-2.75">
      <span className="w-12 shrink-0 text-center">
        <b className="block text-lg leading-tight text-primary tabular-nums">{kst.getUTCDate()}</b>
        <span className="text-[0.6875rem] text-muted-foreground">
          {sameMonth ? "" : `${kst.getUTCMonth() + 1}월 `}
          {kstWeekdayLabel(session.scheduledAt)}
        </span>
      </span>
      <span className="min-w-0 flex-1">
        <b className={cn("block text-sm tabular-nums", cancelled && "text-muted-foreground line-through")}>
          {formatKstTimeLabel(session.scheduledAt)} · {session.durationMinutes}분
        </b>
        <span className="block truncate text-xs text-muted-foreground">
          {session.sessionNumber}회차 · {trainerName} 트레이너
          {cancelled && session.cancelReason ? ` · ${session.cancelReason}` : ""}
        </span>
      </span>
      <span
        className={cn(
          "shrink-0 rounded-full border px-2.25 py-0.5 text-[0.6875rem] font-bold",
          cancelled || moved ? "border-coral text-status-urgent" : "border-input text-muted-foreground",
        )}
      >
        {cancelled ? "취소됨" : moved ? "일정 변경" : "예정"}
      </span>
    </li>
  );
}

/** 지난 회차. 회차 · 날짜 · 사정 한 줄 · 상태 알약. 기록이 있으면 누르면 열린다. */
export function PastPtRow({ session }: { session: MyPtSessionRow }) {
  const label = labelOf(session);
  const note = noteOf(session);
  const href = session.journalId
    ? `/journal/${session.journalId}`
    : session.workoutSessionId
      ? `/workouts/${session.workoutSessionId}`
      : null;

  const body = (
    <>
      <span className="w-12 shrink-0 text-center text-xs font-bold text-muted-foreground tabular-nums">
        {session.status === "CANCELLED" ? "—" : `${session.sessionNumber}회차`}
      </span>
      <span className="min-w-0 flex-1">
        <b className="block truncate text-[0.8125rem] tabular-nums">
          {formatKstDateLabel(session.scheduledAt)} {formatKstTimeLabel(session.scheduledAt)}
        </b>
        {note ? (
          <span className="block truncate text-[0.6875rem] text-faint">{note}</span>
        ) : href ? (
          <span className="block truncate text-[0.6875rem] text-faint">
            {session.journalId ? "알림장 보기" : "운동 기록 보기"}
          </span>
        ) : null}
      </span>
      <span className={cn("shrink-0 rounded-full px-2.25 py-0.75 text-[0.6875rem] font-bold", FILLED[label.tone])}>
        {label.text}
      </span>
      {href ? <ChevronRight className="size-4 shrink-0 text-faint" aria-hidden /> : null}
    </>
  );

  return (
    <li>
      {href ? (
        <Link href={href} className="flex items-center gap-3 border-b border-line px-1 py-2.5">
          {body}
        </Link>
      ) : (
        <div className="flex items-center gap-3 border-b border-line px-1 py-2.5">{body}</div>
      )}
    </li>
  );
}
