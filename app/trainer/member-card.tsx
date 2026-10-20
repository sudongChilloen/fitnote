import Link from "next/link";

import {
  AlertCircle,
  CalendarClock,
  ChevronRight,
  MessageSquare,
  NotebookPen,
  UserPlus,
} from "lucide-react";
import { cn } from "@/lib/utils";

import { Avatar } from "@/components/ui/avatar";
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
        className="group block rounded-3xl border border-border/60 bg-card p-4 shadow-card transition-all duration-200 hover:border-primary/25 hover:shadow-md active:scale-[0.99]"
      >
        {/* 회원 기본 정보 */}
        <div className="flex items-center gap-3">
          <Avatar name={member.name} className="size-12 shrink-0" />

          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 flex-wrap items-center gap-1.5">
              <span className="truncate text-base font-bold tracking-tight">
                {member.name}
              </span>

              {member.pending ? (
                <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
                  미가입
                </span>
              ) : null}
            </div>

            <p
              className={cn(
                "mt-1.5 truncate text-xs font-medium",
                contract.urgent
                  ? "text-status-urgent"
                  : "text-muted-foreground",
              )}
            >
              {contract.text}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {replyCount > 0 ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-accent px-2.5 py-1.5 text-xs font-bold text-accent-foreground">
                <MessageSquare className="size-3.5" aria-hidden />
                {replyCount}
              </span>
            ) : null}

            <span className="flex size-8 items-center justify-center rounded-full bg-secondary/70 text-muted-foreground transition-colors group-hover:bg-accent group-hover:text-accent-foreground">
              <ChevronRight className="size-4" aria-hidden />
            </span>
          </div>
        </div>

        {/* 처리할 일 */}
        {managementReasonText || todo ? (
          <div className="mt-4 flex items-center gap-2.5 rounded-2xl border border-border/50 bg-secondary/50 p-3">
            <span
              className={cn(
                "flex size-9 shrink-0 items-center justify-center rounded-xl",
                todo?.tone === "strong"
                  ? "bg-status-check-bg text-status-check"
                  : "bg-accent text-accent-foreground",
              )}
            >
              {todo?.tone === "strong" ? (
                <AlertCircle className="size-4" aria-hidden />
              ) : (
                <MessageSquare className="size-4" aria-hidden />
              )}
            </span>

            <span className="min-w-0 flex-1">
              <span className="block text-xs font-bold">
                {managementReasonText ?? todo?.label}
              </span>

              {managementReasonText && todo ? (
                <span className="mt-1 block text-[11px] text-muted-foreground">
                  {todo.label}
                </span>
              ) : null}
            </span>

            {replyCount > 0 ? (
              <span className="shrink-0 text-[11px] font-semibold text-muted-foreground">
                답변 {replyCount}건
              </span>
            ) : null}
          </div>
        ) : null}

        {/* 오늘 수업 */}
        {member.todaySessions.length > 0 ? (
          <div className="mt-4">
            <div className="mb-2 flex items-center gap-1.5">
              <CalendarClock className="size-4 text-primary" aria-hidden />
              <span className="text-xs font-bold">오늘 수업</span>
              <span className="rounded-full bg-secondary px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-muted-foreground">
                {member.todaySessions.length}
              </span>
            </div>

            <div className="flex flex-col gap-1.5">
              {member.todaySessions.map((session) => (
                <div
                  key={session.id}
                  className="flex items-center justify-between gap-3 rounded-xl bg-tint-sky/70 px-3 py-2.5 text-tint-sky-foreground"
                >
                  <span className="text-xs font-bold tabular-nums">
                    {formatKstTimeLabel(session.scheduledAt)}
                  </span>

                  <span className="text-[11px] font-semibold">
                    {session.status === "SCHEDULED"
                      ? "예정"
                      : session.status === "COMPLETED"
                        ? "완료"
                        : session.status === "NO_SHOW"
                          ? "노쇼"
                          : session.status === "CANCELLED"
                            ? "취소"
                            : session.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {/* 최근 기록 */}
        <div className="mt-4 flex items-center gap-2 border-t border-border/60 pt-3.5 text-xs text-muted-foreground">
          <NotebookPen className="size-4 shrink-0" aria-hidden />

          <span className="min-w-0 flex-1 truncate">
            {member.lastJournalAt
              ? `마지막 알림장 ${formatKstDateLabel(member.lastJournalAt)}`
              : "작성된 알림장이 없어요"}
          </span>

          {contract.urgent ? (
            <span className="shrink-0 rounded-full bg-status-urgent-bg px-2 py-1 text-[10px] font-bold text-status-urgent">
              계약 만료 임박
            </span>
          ) : null}
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
    <section className="mt-6 overflow-hidden rounded-3xl border border-border/60 bg-card shadow-card">
      <div className="flex flex-col items-center px-6 pb-6 pt-8 text-center">
        <div className="flex size-16 items-center justify-center rounded-2xl bg-accent text-brand-strong">
          <UserPlus className="size-7" aria-hidden />
        </div>

        <p className="mt-5 text-lg font-bold tracking-tight">
          아직 담당 회원이 없어요
        </p>

        <p className="mt-2 max-w-xs text-sm leading-relaxed text-muted-foreground">
          회원을 추가하면 PT 계약과 수업 일정을 관리할 수 있어요. 회원이 나중에
          가입해도 그동안 쌓인 기록을 이어갈 수 있어요.
        </p>

        <div className="mt-6 flex w-full flex-col gap-2 sm:flex-row sm:justify-center">
          <Link
            href="/trainer/profile"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-border/70 px-4 text-sm font-semibold transition-colors hover:bg-secondary"
          >
            초대 코드 만들기
            <ChevronRight className="size-4" aria-hidden />
          </Link>
        </div>

        <p className="mt-4 text-[11px] leading-relaxed text-muted-foreground">
          회원을 추가하려면 화면 상단의 회원 추가 버튼을 이용하세요.
        </p>
      </div>
    </section>
  );
}
