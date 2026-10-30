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
export function SessionRow({
  session,
  isNext = false,
}: {
  session: TrainerSessionRow;
  /** 지금 바로 다음 수업. 딥그린으로 칠해 한눈에 찾게 한다. */
  isNext?: boolean;
}) {
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

  /*
    v3: 바탕은 흰색·연회색 두 가지, 급한 것만 코랄 테두리.
    - 급한 관리 이벤트(마무리 필요 등) → 흰 바탕 + 코랄 테두리
    - 확인할 것 · 예정 → 흰 바탕 + 회색 테두리
    - 완료·노쇼·취소 → 연회색 (지나간 일)
  */
  const tone = cancelled || done || noShow
    ? "past"
    : isNext && !managementEvent
      ? "next"
      : managementEvent?.status === "urgent"
      ? "urgent"
      : managementEvent
        ? "check"
        : "scheduled";

  const toneClass = {
    past: "bg-surface",
    next: "bg-primary text-white",
    urgent: "bg-card ring-[1.5px] ring-coral ring-inset",
    check: "bg-card ring-1 ring-border ring-inset",
    scheduled: "bg-card ring-1 ring-border ring-inset",
  }[tone];

  const inkClass = {
    past: "text-muted-foreground",
    next: "text-white/75",
    urgent: "text-status-urgent",
    check: "text-muted-foreground",
    scheduled: "text-muted-foreground",
  }[tone];

  const body = (
    <div
      className={cn(
        "flex min-h-16 items-center gap-3 rounded-[1.125rem] py-2.5 pr-2.5 pl-3.5 transition-transform active:scale-[0.99]",
        tone === "next" ? "" : "text-ink",
        toneClass,
        cancelled && "opacity-55",
      )}
    >
      {/* 수업 시간 */}
      <div className="w-12 shrink-0">
        <p
          className={cn(
            "text-base leading-none font-extrabold tabular-nums",
            cancelled && "line-through",
          )}
        >
          {toKstTimeValue(session.scheduledAt)}
        </p>
        <p className={cn("mt-1.5 text-[11px] leading-none tabular-nums", inkClass)}>
          {session.durationMinutes}분
        </p>
      </div>

      {/* 회원 정보 */}
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          <p
            className={cn(
              "truncate text-sm font-bold tracking-tight",
              cancelled && "line-through",
            )}
          >
            {session.memberName}
          </p>

          {done ? (
            <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full border border-brand px-2 py-0.5 text-[0.6875rem] font-bold text-primary">
              <Check className="size-3" aria-hidden />
              완료
            </span>
          ) : null}
          {noShow ? (
            <span className="shrink-0 rounded-full border border-coral px-2 py-0.5 text-[0.6875rem] font-bold text-status-urgent">
              노쇼
            </span>
          ) : null}
          {cancelled ? (
            <span className="shrink-0 rounded-full border border-input px-2 py-0.5 text-[0.6875rem] font-semibold text-muted-foreground">
              취소
            </span>
          ) : null}
        </div>

        <p className={cn("mt-1 flex min-w-0 items-center gap-1 truncate text-xs", inkClass)}>
          <span className="shrink-0 tabular-nums">{session.sessionNumber}회차</span>
          {managementEvent ? (
            <>
              <span aria-hidden>·</span>
              <ManagementEventIcon type={managementEvent.type} />
              <span className="truncate font-semibold">{managementEvent.reason}</span>
            </>
          ) : session.hasWorkout ? (
            <>
              <span aria-hidden>·</span>
              <Dumbbell className="size-3.5 shrink-0" aria-hidden />
              <span className="truncate">운동 기록 있음</span>
            </>
          ) : null}
        </p>
      </div>

      {/* 다음 행동은 하나만, 검정 알약으로 */}
      {label ? (
        <span
          className={cn(
            "inline-flex h-9 shrink-0 items-center gap-0.5 rounded-full px-3.5 text-xs font-bold",
            // 목록 안의 작은 버튼은 흰 알약으로 둔다. 진한 버튼은 화면당 하나
            // (수업 마무리, 운동 시작)만 쓴다.
            session.journalStatus === "PUBLISHED"
              ? tone === "past"
                ? "bg-card text-muted-foreground"
                : "bg-surface text-muted-foreground"
              : tone === "next"
                ? "bg-brand text-ink"
                : tone === "past"
                  ? "bg-card text-ink"
                  : "bg-surface text-ink",
          )}
        >
          {label}
          <ChevronRight className="size-3.5" aria-hidden />
        </span>
      ) : session.connectionId ? (
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full text-faint">
          <ChevronRight className="size-4" aria-hidden />
        </span>
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
    <div className="mt-3 rounded-[1.375rem] bg-surface px-5 py-7 text-center">
      <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-brand-muted text-primary">
        <CalendarDays className="size-5" aria-hidden />
      </div>

      <p className="mt-3 text-sm font-bold tracking-tight">{message}</p>

      <p className="mx-auto mt-1.5 max-w-xs text-xs leading-relaxed text-muted-foreground">
        새로운 수업이 등록되면 이곳에서 시간과 회원 정보를 확인할 수 있어요.
      </p>
    </div>
  );
}
