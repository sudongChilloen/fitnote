import Link from "next/link";

import {
  AlertCircle,
  CalendarClock,
  MessageSquare,
  UserPlus,
} from "lucide-react";

import { formatKstDateLabel, formatKstTimeLabel } from "@/lib/date";
import { memberContractGroup } from "@/server/trainers/trainer.service";
import type { TrainerMemberRow } from "@/server/trainers/trainer.service";

function managementReason(member: TrainerMemberRow): string | null {
  const hasPendingJournal = member.todaySessions.some(
    (session) =>
      session.journal === null || session.journal.status !== "PUBLISHED",
  );

  if (hasPendingJournal) {
    return "오늘 수업 기록 필요";
  }

  if (member.awaitingReply.length > 0) {
    return "회원 답변 필요";
  }

  return null;
}

function contractLine(member: TrainerMemberRow) {
  const contract = member.contract;

  if (!contract) {
    return {
      text: "진행 중인 PT 없음",
      urgent: false,
    };
  }

  const parts = [`PT ${contract.remaining}회 남음`];

  if (contract.daysLeft !== null) {
    parts.push(
      contract.daysLeft === 0 ? "오늘 만료" : `만료 D-${contract.daysLeft}`,
    );
  }

  return {
    text: parts.join(" · "),
    urgent: memberContractGroup(member) === "soon",
  };
}

function todoOf(member: TrainerMemberRow) {
  const hasPendingJournal = member.todaySessions.some(
    (session) =>
      session.journal === null || session.journal.status !== "PUBLISHED",
  );

  if (hasPendingJournal) {
    return {
      label: "수업 기록",
      tone: "strong" as const,
    };
  }

  if (member.awaitingReply.length > 0) {
    return {
      label: "답변 필요",
      tone: "normal" as const,
    };
  }

  return null;
}

export function MemberCard({ member }: { member: TrainerMemberRow }) {
  const managementReasonText = managementReason(member);
  const todo = todoOf(member);
  const contract = contractLine(member);

  const replyCount = member.awaitingReply.reduce(
    (sum, item) => sum + item.count,
    0,
  );

  return (
    <li>
      <Link
        href={`/trainer/members/${member.connectionId}`}
        className="
          block
          rounded-2xl
          border
          border-border
          bg-card
          p-4
          transition
          hover:bg-muted/40
          active:scale-[0.99]
        "
      >
        {/* 회원 기본 정보 */}
        <div className="flex items-start gap-3">
          <span
            className="
              flex
              size-11
              shrink-0
              items-center
              justify-center
              rounded-full
              bg-secondary
              text-sm
              font-bold
            "
          >
            {member.name.slice(-2)}
          </span>

          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-1.5">
              <span className="truncate text-[15px] font-bold">
                {member.name}
              </span>

              {member.pending ? (
                <span
                  className="
                    shrink-0
                    rounded-full
                    bg-secondary
                    px-2
                    py-0.5
                    text-[11px]
                    font-bold
                    text-muted-foreground
                  "
                >
                  미가입
                </span>
              ) : null}
            </div>

            {/* 관리 필요: 상태 대신 실제로 해야 할 일을 보여준다. */}
            {managementReasonText ? (
              <div className="mt-1.5 flex min-w-0 items-center gap-1.5">
                <span
                  className="size-1.5 shrink-0 rounded-full bg-brand"
                  aria-hidden
                />
                <span className="truncate text-xs font-bold text-brand-strong">
                  {managementReasonText}
                </span>
              </div>
            ) : null}
          </div>

          {/* 답변 대기 */}
          {replyCount > 0 ? (
            <span
              className="
                flex
                shrink-0
                items-center
                gap-1
                rounded-full
                bg-accent
                px-2
                py-1
                text-xs
                font-bold
                text-brand-strong
              "
            >
              <MessageSquare className="size-3.5" aria-hidden />
              <span className="tabular-nums">{replyCount}</span>
            </span>
          ) : null}
        </div>

        {/* 오늘 수업 */}
        {member.todaySessions.length > 0 ? (
          <div className="mt-3 rounded-xl bg-muted px-3 py-2.5">
            <div className="flex items-center gap-2">
              <CalendarClock
                className="size-4 shrink-0 text-brand-strong"
                aria-hidden
              />

              <p className="text-xs font-bold">
                오늘 수업 {member.todaySessions.length}개
              </p>
            </div>

            <div className="mt-2 space-y-1.5">
              {member.todaySessions.map((session) => (
                <div
                  key={session.id}
                  className="flex items-center justify-between gap-3 rounded-lg bg-background/60 px-2.5 py-2"
                >
                  <span className="text-xs font-bold">
                    {formatKstTimeLabel(session.scheduledAt)}
                  </span>

                  <span className="text-[11px] text-muted-foreground">
                    {session.status === "SCHEDULED" ? "예정" : session.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {/* 하단 정보 */}
        <div
          className="
            mt-3
            flex
            min-w-0
            items-center
            justify-between
            gap-3
          "
        >
          <span
            className={`
              min-w-0
              truncate
              text-xs
              tabular-nums
              ${
                contract.urgent
                  ? "font-bold text-brand-strong"
                  : "text-muted-foreground"
              }
            `}
          >
            {contract.text}
          </span>

          {todo ? (
            <span
              className={`
                shrink-0
                rounded-full
                px-2
                py-1
                text-[11px]
                font-bold
                ${
                  todo.tone === "strong"
                    ? "bg-brand text-primary"
                    : "bg-accent text-brand-strong"
                }
              `}
            >
              {todo.label}
            </span>
          ) : null}
        </div>

        {/* 최근 관리 기록 */}
        <div className="mt-1.5 truncate text-xs text-muted-foreground">
          {member.todaySessions.length > 0
            ? `오늘 수업 ${member.todaySessions.length}개`
            : member.lastJournalAt
              ? `마지막 알림장 ${formatKstDateLabel(member.lastJournalAt)}`
              : "알림장 없음"}
        </div>
      </Link>
    </li>
  );
}

/**
 * 담당 회원이 없을 때.
 */
export function NoMembers() {
  return (
    <div className="mt-3 rounded-2xl border border-border bg-card p-5">
      <span
        className="
          flex
          size-9
          items-center
          justify-center
          rounded-xl
          bg-accent
          text-brand-strong
        "
      >
        <UserPlus className="size-4.5" aria-hidden />
      </span>

      <p className="mt-2.5 text-sm font-bold">아직 담당 회원이 없어요</p>

      <p className="mt-1 text-xs text-muted-foreground">
        위의 <b className="font-bold text-foreground">회원 추가</b>로 이름만
        적어 두면 바로 PT 계약과 수업을 잡을 수 있어요. 회원이 나중에 가입하면
        그동안 쌓인 기록을 그대로 이어받아요.
      </p>

      <Link
        href="/trainer/profile"
        className="
          mt-3
          inline-flex
          h-10
          items-center
          rounded-xl
          border
          border-border
          px-4
          text-sm
          font-bold
        "
      >
        초대 코드 만들기
      </Link>
    </div>
  );
}
