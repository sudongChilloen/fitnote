import Link from "next/link";

import { ChevronRight, UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";

import { ProgressRing } from "@/components/ui/progress-ring";
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

export function MemberCard({
  member,
  variant = "ring",
}: {
  member: TrainerMemberRow;
  /** ring = 홈의 동그라미, bar = 회원 목록의 숫자 + 막대 */
  variant?: "ring" | "bar";
}) {
  const managementReasonText = managementReason(member);
  const todo = todoOf(member);
  const contract = contractLine(member);

  const replyCount = member.awaitingReply.reduce(
    (sum, item) => sum + item.count,
    0,
  );

  /*
    v2 파스텔: 회원 상태를 아바타 바탕색과 링 색으로 말한다.
    복숭아 = 만료 임박, 노랑 = 할 일 있음, 라벤더 = 미가입, 하늘 = 평소.
    글자 표시(알약)도 함께 둬서 색만으로 뜻을 전하지 않는다.
  */
  const tone = contract.urgent
    ? "urgent"
    : todo || replyCount > 0
      ? "check"
      : member.pending
        ? "pending"
        : "normal";

  const avatarClass = {
    urgent: "bg-surface text-ink",
    check: "bg-surface text-ink",
    pending: "bg-surface text-muted-foreground",
    normal: "bg-brand-muted text-primary",
  }[tone];

  const ringColor = contract.urgent ? "var(--coral)" : "var(--brand)";

  const flag = contract.urgent
    ? "만료 임박"
    : member.pending
      ? "미가입"
      : todo
        ? todo.label
        : replyCount > 0
          ? `답장 ${replyCount}`
          : null;

  const nextToday = member.todaySessions.find(
    (session) => session.status === "SCHEDULED",
  );

  const subline = managementReasonText
    ? managementReasonText
    : nextToday
      ? `오늘 ${formatKstTimeLabel(nextToday.scheduledAt)} 수업`
      : member.lastJournalAt
        ? `마지막 알림장 ${formatKstDateLabel(member.lastJournalAt)}`
        : contract.text;

  return (
    <li>
      <Link
        href={`/trainer/members/${member.connectionId}`}
        className="flex items-center gap-3 border-b border-line py-2.5 pr-1 pl-1 text-ink"
      >
        <span
          aria-hidden
          className={cn(
            "flex size-11 shrink-0 items-center justify-center rounded-full text-[0.9375rem] font-extrabold",
            avatarClass,
          )}
        >
          {member.name.trim().slice(0, 1)}
        </span>

        <span className="min-w-0 flex-1">
          <span className="flex min-w-0 items-center gap-1.5">
            <span className="truncate text-sm font-bold">{member.name}</span>
            {flag ? (
              <span
                className={cn(
                  "shrink-0 rounded-full border px-1.5 text-[0.6875rem] leading-[1.0625rem] font-bold",
                  tone === "urgent"
                    ? "border-coral text-status-urgent"
                    : "border-input text-muted-foreground",
                )}
              >
                {flag}
              </span>
            ) : null}
          </span>
          <span className="mt-0.5 block truncate text-xs text-muted-foreground tabular-nums">
            {subline}
          </span>
        </span>

        {member.contract && variant === "bar" ? (
          <span className="w-16 shrink-0 text-right">
            <b
              className={cn(
                "block text-[0.9375rem] tabular-nums",
                contract.urgent ? "text-status-urgent" : "text-ink",
              )}
            >
              {member.contract.remaining}회
            </b>
            <span className="mt-1 block h-1.25 overflow-hidden rounded-full bg-line">
              <span
                className="block h-full rounded-full"
                style={{
                  width: `${Math.round(
                    (member.contract.remaining / Math.max(member.contract.totalSessions, 1)) * 100,
                  )}%`,
                  background: ringColor,
                }}
              />
            </span>
          </span>
        ) : member.contract ? (
          <ProgressRing
            ratio={member.contract.remaining / Math.max(member.contract.totalSessions, 1)}
            color={ringColor}
          >
            <span className="text-xs leading-none font-extrabold tabular-nums">
              {member.contract.remaining}
            </span>
            <span className="sr-only">회 남음</span>
          </ProgressRing>
        ) : (
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full text-faint">
            <ChevronRight className="size-4" aria-hidden />
          </span>
        )}
      </Link>
    </li>
  );
}

/**
 * 담당 회원이 없을 때.
 */
export function NoMembers() {
  return (
    <section className="mt-6 overflow-hidden rounded-[1.5rem] bg-surface">
      <div className="flex flex-col items-center px-6 pb-6 pt-8 text-center">
        <div className="flex size-16 items-center justify-center rounded-full bg-brand-muted text-primary">
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
            className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-ink px-5 text-sm font-bold text-white"
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
