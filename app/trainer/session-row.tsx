import Link from "next/link";

import { CalendarDays, Check, ChevronRight, Dumbbell } from "lucide-react";

import { toKstTimeValue } from "@/lib/date";
import type { TrainerSessionRow } from "@/server/trainers/trainer-board.service";
import { cn } from "@/lib/utils";

import { enterSessionRecord } from "./sessions/[id]/actions";

const STATUS_LABEL: Record<string, string> = {
  SCHEDULED: "예정",
  COMPLETED: "완료",
  NO_SHOW: "노쇼",
  CANCELLED: "취소",
};

/**
 * 시간표 한 줄.
 *
 * 트레이너가 이 줄에서 알고 싶은 건 네 가지다 — 몇 시에, 누구를, 몇 회차를,
 * 그리고 지금 뭘 해야 하는지. 그래서 시간을 왼쪽에 세로로 세워 눈이 시간축을
 * 따라 내려가게 하고, 할 일은 오른쪽 끝에 한 개만 둔다. 버튼을 둘 이상 두면
 * 수업 사이 2분 동안 뭘 눌러야 하는지 고민하게 된다.
 */
export function SessionRow({ session }: { session: TrainerSessionRow }) {
  const cancelled = session.status === "CANCELLED";
  const done = session.status === "COMPLETED";
  const noShow = session.status === "NO_SHOW";

  /*
    할 일은 하나만 보여 준다.

    어느 상태든 이 줄에서 가는 곳은 수업 기록 화면 하나다. 수업 중이면 무게를
    적고, 끝난 뒤면 완료를 누르거나 알림장으로 넘어간다. 목적지를 상태별로
    갈라 두면 수업 사이 2분 동안 어디로 가는지 매번 다시 배워야 한다.

    취소한 수업만 예외다. 적을 것도 누를 것도 없다.
  */
  const label = cancelled
    ? null
    : session.journalStatus === "PUBLISHED"
      ? "기록 보기"
      : "수업 기록";

  const body = (
    <div
      className={cn(
        "flex items-center gap-3 rounded-2xl border border-border bg-card p-3.5",
        cancelled && "opacity-55",
      )}
    >
      <div className="w-12 shrink-0 text-center">
        <p
          className={cn(
            "text-base leading-none font-bold tabular-nums",
            cancelled && "line-through",
          )}
        >
          {/*
            시간표에서는 24시간 표기를 쓴다. "오전 7:00" 과 "오후 7:00" 은
            좁은 열에서 한눈에 구분되지 않고, 눈이 시간축을 따라 내려갈 때
            자리수가 맞아야 읽힌다.
          */}
          {toKstTimeValue(session.scheduledAt)}
        </p>
        <p className="mt-1 text-[0.6875rem] leading-none text-muted-foreground tabular-nums">
          {session.durationMinutes}분
        </p>
      </div>

      <div className="min-w-0 flex-1 border-l border-border pl-3">
        <div className="flex items-center gap-1.5">
          <p className="truncate font-bold">{session.memberName}</p>
          {done ? (
            <Check className="size-3.5 shrink-0 text-brand-strong" aria-hidden />
          ) : null}
          {noShow || cancelled ? (
            <span className="shrink-0 rounded-full bg-secondary px-1.5 py-0.5 text-[0.625rem] font-semibold text-muted-foreground">
              {STATUS_LABEL[session.status]}
            </span>
          ) : null}
        </div>

        <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="tabular-nums">{session.sessionNumber}회차</span>
          {session.hasWorkout ? (
            <span className="inline-flex items-center gap-0.5 text-brand-strong">
              <Dumbbell className="size-3" aria-hidden />
              운동 기록 있음
            </span>
          ) : null}
        </p>
      </div>

      {label ? (
        <span className="shrink-0 rounded-full bg-accent px-2.5 py-1.5 text-xs font-bold text-brand-strong">
          {label}
        </span>
      ) : session.connectionId ? (
        <ChevronRight
          className="size-4 shrink-0 text-muted-foreground"
          aria-hidden
        />
      ) : null}
    </div>
  );

  /*
    줄 전체가 버튼이다. 작은 배지를 정확히 눌러야 하면 수업 사이에 쓰기 어렵다.

    링크가 아니라 폼인 이유는, 들어가면서 운동 기록을 미리 열어 두기 위해서다.
    화면에 도착해서 "운동 기록 시작" 을 한 번 더 눌러야 하면 그 한 번이 수업
    중에는 크다.
  */
  if (label) {
    return (
      <li>
        <form action={enterSessionRecord}>
          <input type="hidden" name="ptSessionId" value={session.id} />
          <button type="submit" className="w-full text-left">
            {body}
          </button>
        </form>
      </li>
    );
  }

  if (session.connectionId) {
    return (
      <li>
        <Link href={`/trainer/members/${session.connectionId}`}>{body}</Link>
      </li>
    );
  }

  return <li>{body}</li>;
}

export function EmptyDay({ message }: { message: string }) {
  return (
    <div className="mt-3 flex flex-col items-center rounded-2xl border border-dashed border-border px-5 py-8">
      <CalendarDays className="size-5 text-muted-foreground" aria-hidden />
      <p className="mt-2 text-sm text-muted-foreground">{message}</p>
    </div>
  );
}
