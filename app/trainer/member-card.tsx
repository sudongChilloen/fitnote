import Link from "next/link";

import { MessageSquare, UserPlus } from "lucide-react";

import { formatKstDateLabel, formatKstTimeLabel } from "@/lib/date";
import { memberContractGroup } from "@/server/trainers/trainer.service";
import type { TrainerMemberRow } from "@/server/trainers/trainer.service";

/**
 * 카드 아랫줄에 쓸 계약 한 줄.
 *
 * 남은 횟수와 만료를 한 줄에 같이 쓴다. 계약이 끝나는 방식이 둘이라 하나만
 * 보여 주면 다른 쪽으로 끝나는 걸 놓친다. 3회 남았는데 기간이 두 달 남은
 * 사람과, 10회 남았는데 다음 주에 만료되는 사람은 둘 다 재계약 이야기를
 * 꺼내야 할 사람이다.
 */
function contractLine(member: TrainerMemberRow) {
  const contract = member.contract;

  if (!contract) return { text: "진행 중인 PT 없음", urgent: false };

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

/** 이 회원에게 지금 해야 할 일. 없으면 null 이고, 그러면 조용히 둔다. */
function todoOf(member: TrainerMemberRow) {
  if (member.todaySession && member.todaySession.journal === null) {
    return { label: "수업 기록", tone: "strong" as const };
  }
  if (member.todaySession && member.todaySession.journal?.status === "DRAFT") {
    return { label: "쓰는 중", tone: "strong" as const };
  }
  if (member.awaitingReply.length > 0) {
    return { label: "답장 대기", tone: "soft" as const };
  }
  return null;
}

export function MemberCard({ member }: { member: TrainerMemberRow }) {
  const todo = todoOf(member);
  const contract = contractLine(member);

  return (
    <li>
      <Link
        href={`/trainer/members/${member.connectionId}`}
        className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4"
      >
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-bold">
          {member.name.slice(-2)}
        </span>

        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className="truncate font-bold">{member.name}</span>
            {todo ? (
              <span
                className={
                  todo.tone === "strong"
                    ? "shrink-0 rounded-full bg-brand px-2 py-0.5 text-[0.6875rem] font-bold text-primary"
                    : "shrink-0 rounded-full bg-accent px-2 py-0.5 text-[0.6875rem] font-bold text-brand-strong"
                }
              >
                {todo.label}
              </span>
            ) : null}
          </span>

          {/*
            계약이 윗줄이다. 트레이너가 회원 목록에서 가장 자주 확인하는 건
            "이 사람 몇 회 남았지" 이고, 마지막 알림장 날짜는 그 다음이다.
          */}
          <span
            className={
              contract.urgent
                ? "mt-1 block truncate text-xs font-bold text-brand-strong tabular-nums"
                : "mt-1 block truncate text-xs text-muted-foreground tabular-nums"
            }
          >
            {contract.text}
          </span>

          <span className="mt-0.5 block truncate text-xs text-muted-foreground">
            {member.todaySession
              ? `오늘 ${formatKstTimeLabel(member.todaySession.scheduledAt)} 수업`
              : member.lastJournalAt
                ? `마지막 알림장 ${formatKstDateLabel(member.lastJournalAt)}`
                : "알림장 없음"}
          </span>
        </span>

        {member.awaitingReply.length > 0 ? (
          <span className="flex shrink-0 items-center gap-1 text-xs font-bold text-brand-strong">
            <MessageSquare className="size-3.5" aria-hidden />
            <span className="tabular-nums">
              {member.awaitingReply.reduce((sum, r) => sum + r.count, 0)}
            </span>
          </span>
        ) : null}
      </Link>
    </li>
  );
}

/**
 * 담당 회원이 없을 때.
 *
 * 빈 목록만 두면 트레이너가 뭘 해야 하는지 모른다. 초대 코드를 만드는 곳까지
 * 데려가 준다.
 */
export function NoMembers() {
  return (
    <div className="mt-3 rounded-2xl border border-border bg-card p-5">
      <span className="flex size-9 items-center justify-center rounded-xl bg-accent text-brand-strong">
        <UserPlus className="size-4.5" aria-hidden />
      </span>
      <p className="mt-2.5 text-sm font-bold">아직 담당 회원이 없어요</p>
      <p className="mt-1 text-xs text-muted-foreground">
        내정보에서 회원 초대 코드를 만들어 전달하면, 회원이 코드를 넣는 순간
        담당으로 배정돼요.
      </p>
      <Link
        href="/trainer/profile"
        className="mt-3 inline-flex h-10 items-center rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground"
      >
        초대 코드 만들기
      </Link>
    </div>
  );
}
