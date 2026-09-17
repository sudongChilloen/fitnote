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

const STATUS_LABEL: Record<string, string> = {
  SCHEDULED: "예정",
  COMPLETED: "완료",
  NO_SHOW: "노쇼",
  CANCELLED: "취소",
};

function ManagementEventIcon({
  type,
}: {
  type: string;
}) {
  switch (type) {
    case "SESSION_JOURNAL":
      return (
        <AlertCircle
          className="size-3.5 shrink-0"
          aria-hidden
        />
      );

    case "JOURNAL_REPLY":
      return (
        <MessageSquare
          className="size-3.5 shrink-0"
          aria-hidden
        />
      );

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
export function SessionRow({
  session,
}: {
  session: TrainerSessionRow;
}) {
  const cancelled =
    session.status === "CANCELLED";

  const done =
    session.status === "COMPLETED";

  const noShow =
    session.status === "NO_SHOW";

  /*
    수업과 직접 연결된 관리 이벤트.

    현재 서비스에서 SESSION_JOURNAL 이벤트가 들어온다.
    회원 전체에 걸린 이벤트는 일정에 반복하지 않는다.
  */
  const managementEvent =
    session.managementEvents[0] ?? null;

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
        "flex min-h-18 items-center gap-3 rounded-2xl border border-border bg-card p-3.5",
        "transition-colors",
        !cancelled && "hover:bg-muted/40",
        cancelled && "opacity-55",
      )}
    >
      {/* 시간 */}
      <div className="w-12 shrink-0 text-center">
        <p
          className={cn(
            "text-base leading-none font-bold tabular-nums",
            cancelled && "line-through",
          )}
        >
          {toKstTimeValue(session.scheduledAt)}
        </p>

        <p className="mt-1 text-[0.6875rem] leading-none text-muted-foreground tabular-nums">
          {session.durationMinutes}분
        </p>
      </div>

      {/* 회원 정보 */}
      <div className="min-w-0 flex-1 border-l border-border pl-3">
        <div className="flex min-w-0 items-center gap-1.5">
          <p
            className={cn(
              "truncate text-sm font-bold",
              cancelled &&
                "text-muted-foreground line-through",
            )}
          >
            {session.memberName}
          </p>

          {done ? (
            <span
              className="flex size-4 shrink-0 items-center justify-center rounded-full bg-accent text-brand-strong"
              aria-label="완료"
            >
              <Check
                className="size-2.5"
                aria-hidden
              />
            </span>
          ) : null}

          {noShow || cancelled ? (
            <span className="shrink-0 rounded-full bg-secondary px-1.5 py-0.5 text-[0.625rem] font-semibold text-muted-foreground">
              {STATUS_LABEL[session.status]}
            </span>
          ) : null}
        </div>

        <div className="mt-1 flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
          <span className="shrink-0 tabular-nums">
            {session.sessionNumber}회차
          </span>

          {session.hasWorkout ? (
            <>
              <span
                className="size-0.5 shrink-0 rounded-full bg-muted-foreground/50"
                aria-hidden
              />

              <span className="inline-flex min-w-0 items-center gap-0.5 truncate text-brand-strong">
                <Dumbbell
                  className="size-3 shrink-0"
                  aria-hidden
                />
                운동 기록 있음
              </span>
            </>
          ) : null}
        </div>

        {managementEvent ? (
          <div
            className={cn(
              "mt-1.5 flex min-w-0 items-center gap-1 text-xs font-semibold",
              managementEvent.status === "urgent"
                ? "text-destructive"
                : "text-brand-strong",
            )}
          >
            <ManagementEventIcon
              type={managementEvent.type}
            />

            <span className="truncate">
              {managementEvent.reason}
            </span>
          </div>
        ) : null}
      </div>

      {/* 액션 */}
      {label ? (
        <span
          className={cn(
            "shrink-0 rounded-full px-2.5 py-1.5 text-xs font-bold",
            session.journalStatus === "PUBLISHED"
              ? "bg-secondary text-muted-foreground"
              : "bg-accent text-brand-strong",
          )}
        >
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
    수업 기록이 필요한 경우에는 기존처럼 Server Action을 사용한다.

    링크로 이동시키지 않고 action을 호출하는 이유는
    기존 enterSessionRecord 흐름을 그대로 유지하기 위해서다.
  */
  if (label) {
    return (
      <li>
        <form action={enterSessionRecord}>
          <input
            type="hidden"
            name="ptSessionId"
            value={session.id}
          />

          <button
            type="submit"
            className="block w-full text-left"
            aria-label={`${session.memberName} ${session.sessionNumber}회차 ${label}`}
          >
            {body}
          </button>
        </form>
      </li>
    );
  }

  /*
    취소되었거나 기록이 끝난 수업 중
    회원 상세로 이동할 수 있는 경우.
  */
  if (session.connectionId) {
    return (
      <li>
        <Link
          href={`/trainer/members/${session.connectionId}`}
          className="block"
        >
          {body}
        </Link>
      </li>
    );
  }

  return <li>{body}</li>;
}

export function EmptyDay({
  message,
}: {
  message: string;
}) {
  return (
    <div className="mt-3 flex flex-col items-center rounded-2xl border border-dashed border-border px-5 py-8">
      <CalendarDays
        className="size-5 text-muted-foreground"
        aria-hidden
      />

      <p className="mt-2 text-sm text-muted-foreground">
        {message}
      </p>
    </div>
  );
}