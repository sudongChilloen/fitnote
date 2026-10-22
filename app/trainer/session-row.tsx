import Link from "next/link";

import {
  AlertCircle,
  CalendarDays,
  Check,
  ChevronRight,
  Dumbbell,
  MessageSquare,
} from "lucide-react";

import { toKstTimeValue } from "@/lib/date";
import { cn } from "@/lib/utils";
import type { TrainerSessionRow } from "@/server/trainers/trainer-board.service";

import { enterSessionRecord } from "./sessions/[id]/actions";

function ManagementEventIcon({ type }: { type: string }) {
  switch (type) {
    case "SESSION_JOURNAL":
      return <AlertCircle className="size-3.5 shrink-0" aria-hidden />;

    case "JOURNAL_REPLY":
      return <MessageSquare className="size-3.5 shrink-0" aria-hidden />;

    default:
      return null;
  }
}

/**
 * 시간표 한 줄.
 *
 * 트레이너가 가장 먼저 알아야 하는 정보는
 * "언제 / 누구 / 몇 회차 / 지금 무엇을 해야 하는가"다.
 *
 * 시간은 왼쪽에 고정하고,
 * 회원 정보와 회차를 가운데에 두며,
 * 현재 해야 할 행동은 오른쪽에 하나만 보여준다.
 *
 * SessionRow는 일정 / 할 일 화면에서 함께 사용하기 때문에
 * 수업 데이터 자체의 표현은 여기에서 일관되게 유지한다.
 */
export function SessionRow({ session }: { session: TrainerSessionRow }) {
  const cancelled = session.status === "CANCELLED";

  const done = session.status === "COMPLETED";

  const noShow = session.status === "NO_SHOW";

  /*
    수업과 직접 연결된 관리 이벤트.

    현재 서비스에서 SESSION_JOURNAL 이벤트가 들어온다.
    회원 전체에 걸린 이벤트는 일정에 반복하지 않는다.
  */
  const managementEvent = session.managementEvents[0] ?? null;

  /*
    수업에서 트레이너가 이동할 곳은 하나로 통일한다.

    - 아직 기록하지 않은 수업 → 수업 기록
    - 알림장까지 작성된 수업 → 기록 보기
    - 취소된 수업 → 이동할 필요 없음
  */
  const label = cancelled
    ? null
    : session.journalStatus === "PUBLISHED"
      ? "기록 보기"
      : "수업 기록";

  const body = (
    <div
      className={cn(
        "flex min-h-23 items-center gap-3 rounded-2xl border border-border/70 bg-card p-3.5 shadow-card",
        "transition-colors duration-200",
        !cancelled &&
          "hover:border-primary/30 hover:bg-secondary/20 active:bg-secondary/40",
        cancelled && "opacity-55",
      )}
    >
      {/* 수업 시간 */}
      <div className="w-15 shrink-0 text-center">
        <p
          className={cn(
            "text-base font-bold leading-none tabular-nums",
            session.status === "SCHEDULED" && "text-primary",
            cancelled && "line-through",
          )}
        >
          {toKstTimeValue(session.scheduledAt)}
        </p>

        <p className="mt-2 text-[11px] leading-none text-muted-foreground tabular-nums">
          {session.durationMinutes}분
        </p>
      </div>

      {/* 회원 정보 */}
      <div className="min-w-0 flex-1 border-l border-border/70 pl-3.5">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          <p
            className={cn(
              "truncate text-sm font-bold tracking-tight",
              cancelled && "text-muted-foreground line-through",
            )}
          >
            {session.memberName}
          </p>

          {done ? (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-status-ok-bg px-2 py-1 text-[10px] font-bold text-status-ok">
              <Check className="size-3" aria-hidden />
              완료
            </span>
          ) : null}

          {noShow ? (
            <span className="shrink-0 rounded-full bg-status-urgent-bg px-2 py-1 text-[10px] font-bold text-status-urgent">
              노쇼
            </span>
          ) : null}

          {cancelled ? (
            <span className="shrink-0 rounded-full bg-secondary px-2 py-1 text-[10px] font-semibold text-muted-foreground">
              취소
            </span>
          ) : null}
        </div>

        <div className="mt-2 flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
          <span className="shrink-0 tabular-nums">
            {session.sessionNumber}회차
          </span>

          {session.hasWorkout ? (
            <>
              <span
                className="size-1 shrink-0 rounded-full bg-border"
                aria-hidden
              />
              <span className="inline-flex min-w-0 items-center gap-1 truncate text-primary">
                <Dumbbell className="size-3.5 shrink-0" aria-hidden />
                운동 기록 있음
              </span>
            </>
          ) : null}
        </div>

        {managementEvent ? (
          <div
            className={cn(
              "mt-2.5 flex min-w-0 items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-semibold",
              managementEvent.status === "urgent"
                ? "bg-status-urgent-bg text-status-urgent"
                : "bg-status-check-bg text-status-check",
            )}
          >
            <ManagementEventIcon type={managementEvent.type} />
            <span className="truncate">{managementEvent.reason}</span>
          </div>
        ) : null}
      </div>

      {/* 기존 기록 진입 액션 */}
      {label ? (
        <span
          className={cn(
            "inline-flex min-h-10 shrink-0 items-center gap-1 rounded-xl px-3 py-2 text-xs font-bold transition-colors",
            session.journalStatus === "PUBLISHED"
              ? "bg-secondary text-muted-foreground"
              : "bg-accent text-accent-foreground",
          )}
        >
          {label}
          <ChevronRight className="size-3.5" aria-hidden />
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
    수업 기록이 필요한 경우에는 기존처럼 Server Action을 사용한다.

    링크로 이동시키지 않고 action을 호출하는 이유는
    기존 enterSessionRecord 흐름을 그대로 유지하기 위해서다.
  */
  if (label) {
    return (
      <form action={enterSessionRecord}>
        <input type="hidden" name="ptSessionId" value={session.id} />

        <button
          type="submit"
          className="block w-full text-left"
          aria-label={`${session.memberName} ${session.sessionNumber}회차 ${label}`}
        >
          {body}
        </button>
      </form>
    );
  }

  if (session.connectionId) {
    return (
      <Link href={`/trainer/members/${session.connectionId}`} className="block">
        {body}
      </Link>
    );
  }

  return body;
}

export function EmptyDay({ message }: { message: string }) {
  return (
    <div className="mt-3 overflow-hidden rounded-3xl border border-dashed border-border bg-card px-5 py-8 text-center">
      <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
        <CalendarDays className="size-6" aria-hidden />
      </div>

      <p className="mt-4 text-sm font-bold tracking-tight text-foreground">
        {message}
      </p>

      <p className="mx-auto mt-2 max-w-xs text-xs leading-relaxed text-muted-foreground">
        새로운 수업이 등록되면 이곳에서 시간과 회원 정보를 확인할 수 있어요.
      </p>
    </div>
  );
}
