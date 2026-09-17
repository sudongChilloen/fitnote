import Link from "next/link";

import {
  AlertCircle,
  CalendarClock,
  MessageSquare,
  UserPlus,
} from "lucide-react";

import {
  formatKstDateLabel,
  formatKstTimeLabel,
} from "@/lib/date";
import { memberContractGroup } from "@/server/trainers/trainer.service";
import type { TrainerMemberRow } from "@/server/trainers/trainer.service";

type ManagementStatus =
  | "normal"
  | "attention"
  | "urgent";

function statusLabel(
  status: ManagementStatus,
) {
  switch (status) {
    case "urgent":
      return "즉시 확인";

    case "attention":
      return "확인 필요";

    default:
      return "정상";
  }
}

function statusClassName(
  status: ManagementStatus,
) {
  switch (status) {
    case "urgent":
      return {
        dot: "bg-destructive",
        text: "text-destructive",
        badge:
          "bg-destructive/10 text-destructive",
      };

    case "attention":
      return {
        dot: "bg-brand",
        text: "text-brand-strong",
        badge:
          "bg-accent text-brand-strong",
      };

    default:
      return {
        dot: "bg-emerald-600",
        text: "text-emerald-700",
        badge:
          "bg-emerald-50 text-emerald-700",
      };
  }
}

function contractLine(
  member: TrainerMemberRow,
) {
  const contract = member.contract;

  if (!contract) {
    return {
      text: "진행 중인 PT 없음",
      urgent: false,
    };
  }

  const parts = [
    `PT ${contract.remaining}회 남음`,
  ];

  if (contract.daysLeft !== null) {
    parts.push(
      contract.daysLeft === 0
        ? "오늘 만료"
        : `만료 D-${contract.daysLeft}`,
    );
  }

  return {
    text: parts.join(" · "),
    urgent:
      memberContractGroup(member) ===
      "soon",
  };
}

function todoOf(
  member: TrainerMemberRow,
) {
  if (
    member.todaySession &&
    member.todaySession.journal === null
  ) {
    return {
      label: "수업 기록",
      tone: "strong" as const,
    };
  }

  if (
    member.todaySession &&
    member.todaySession.journal
      ?.status === "DRAFT"
  ) {
    return {
      label: "쓰는 중",
      tone: "strong" as const,
    };
  }

  if (
    member.awaitingReply.length > 0
  ) {
    return {
      label: "답장 대기",
      tone: "soft" as const,
    };
  }

  return null;
}

function getManagementReason(
  member: TrainerMemberRow,
) {
  return (
    member.managementEvents[0]
      ?.reason ?? null
  );
}

export function MemberCard({
  member,
}: {
  member: TrainerMemberRow;
}) {
  /*
   * 관리 상태는 trainer.service.ts에서
   * 실제 회원 데이터를 기준으로 계산한다.
   *
   * 여기서 다시 상태를 계산하지 않는다.
   *
   * UI에서는 서버에서 결정된
   * - normal
   * - attention
   * - urgent
   *
   * 와 그 이유만 표시한다.
   */
  const managementStatus =
    member.managementStatus as ManagementStatus;

  const statusStyle =
    statusClassName(
      managementStatus,
    );

  const managementReason =
    getManagementReason(member);

  const todo = todoOf(member);
  const contract = contractLine(member);

  const replyCount =
    member.awaitingReply.reduce(
      (sum, item) =>
        sum + item.count,
      0,
    );

  const primaryManagementEvent =
    member.managementEvents[0];

  return (
    <li>
      <Link
        href={
          primaryManagementEvent?.href ??
          `/trainer/members/${member.connectionId}`
        }
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
          focus-visible:outline-none
          focus-visible:ring-2
          focus-visible:ring-ring
        "
      >
        {/* 회원 기본 정보 */}
        <div className="flex items-start gap-3">
          {/* 아바타 */}
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

          {/* 이름 + 관리 상태 */}
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

            {/* 관리 상태 */}
            <div className="mt-1.5 flex min-w-0 items-center gap-1.5">
              <span
                className={`size-1.5 shrink-0 rounded-full ${statusStyle.dot}`}
                aria-hidden
              />

              <span
                className={`shrink-0 text-xs font-bold ${statusStyle.text}`}
              >
                {statusLabel(
                  managementStatus,
                )}
              </span>

              {managementReason ? (
                <>
                  <span
                    className="
                      shrink-0
                      text-xs
                      text-muted-foreground
                    "
                    aria-hidden
                  >
                    ·
                  </span>

                  <span className="truncate text-xs text-muted-foreground">
                    {managementReason}
                  </span>
                </>
              ) : null}
            </div>
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
              aria-label={`답변 대기 ${replyCount}건`}
            >
              <MessageSquare
                className="size-3.5"
                aria-hidden
              />

              <span className="tabular-nums">
                {replyCount}
              </span>
            </span>
          ) : null}
        </div>

        {/* 관리 이벤트가 여러 개라면 추가 상태 표시 */}
        {member.managementEvents
          .length > 1 ? (
          <div className="mt-3 space-y-1.5">
            {member.managementEvents
              .slice(1, 3)
              .map((event) => {
                const eventStyle =
                  statusClassName(
                    event.status as ManagementStatus,
                  );

                return (
                  <div
                    key={`${event.type}-${event.status}-${event.reason}`}
                    className="
                      flex
                      min-w-0
                      items-center
                      gap-2
                      rounded-xl
                      bg-muted
                      px-3
                      py-2
                    "
                  >
                    <span
                      className={`size-1.5 shrink-0 rounded-full ${eventStyle.dot}`}
                      aria-hidden
                    />

                    <span
                      className="
                        min-w-0
                        truncate
                        text-xs
                        font-medium
                        text-muted-foreground
                      "
                    >
                      {event.reason}
                    </span>
                  </div>
                );
              })}
          </div>
        ) : null}

        {/* 오늘 수업 */}
        {member.todaySession ? (
          <div
            className="
              mt-3
              flex
              items-center
              gap-2
              rounded-xl
              bg-muted
              px-3
              py-2.5
            "
          >
            <CalendarClock
              className="size-4 shrink-0 text-brand-strong"
              aria-hidden
            />

            <div className="min-w-0">
              <p className="text-xs font-bold">
                오늘{" "}
                {formatKstTimeLabel(
                  member
                    .todaySession
                    .scheduledAt,
                )}{" "}
                수업
              </p>

              <p className="mt-0.5 text-[11px] text-muted-foreground">
                {member.todaySession
                  .status ===
                "SCHEDULED"
                  ? "예정"
                  : member.todaySession
                      .status}
              </p>
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
                  todo.tone ===
                  "strong"
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
        <div className="mt-1.5 flex min-w-0 items-center gap-1.5 truncate text-xs text-muted-foreground">
          {managementStatus ===
          "urgent" ? (
            <AlertCircle
              className="size-3.5 shrink-0 text-destructive"
              aria-hidden
            />
          ) : null}

          <span className="truncate">
            {member.todaySession
              ? `오늘 ${formatKstTimeLabel(
                  member.todaySession
                    .scheduledAt,
                )} 수업`
              : member.lastJournalAt
                ? `마지막 알림장 ${formatKstDateLabel(
                    member.lastJournalAt,
                  )}`
                : "알림장 없음"}
          </span>
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
        <UserPlus
          className="size-4.5"
          aria-hidden
        />
      </span>

      <p className="mt-2.5 text-sm font-bold">
        아직 담당 회원이 없어요
      </p>

      <p className="mt-1 text-xs text-muted-foreground">
        위의{" "}
        <b className="font-bold text-foreground">
          회원 추가
        </b>{" "}
        로 이름만 적어 두면 바로 PT 계약과
        수업을 잡을 수 있어요. 회원이 나중에
        가입하면 그동안 쌓인 기록을 그대로
        이어받아요.
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
          transition
          hover:bg-muted
          focus-visible:outline-none
          focus-visible:ring-2
          focus-visible:ring-ring
        "
      >
        초대 코드 만들기
      </Link>
    </div>
  );
}