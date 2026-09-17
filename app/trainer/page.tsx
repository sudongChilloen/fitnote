import Link from "next/link";

import {
  CalendarClock,
  ChevronRight,
  ClipboardCheck,
  MessageSquare,
  NotebookPen,
} from "lucide-react";

import { requireUser } from "@/app/lib/dal";
import { formatKstDateLabel, formatKstTimeLabel } from "@/lib/date";
import {
  getTrainerToday,
  getTrainerTodos,
  type TrainerReplyRow,
} from "@/server/trainers/trainer-board.service";
import {
  getTrainerHome,
  memberContractGroup,
} from "@/server/trainers/trainer.service";

import { MemberCard, NoMembers } from "./member-card";
import { EmptyDay, SessionRow } from "./session-row";

export const metadata = { title: "트레이너 | FitNote" };

function SummaryCard({
  icon: Icon,
  label,
  value,
  href,
}: {
  icon: typeof CalendarClock;
  label: string;
  value: number;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="min-w-0 flex-1 rounded-2xl border border-border bg-card p-3.5 transition-colors hover:bg-secondary/40"
    >
      <span className="flex items-center justify-between">
        <span className="flex size-8 items-center justify-center rounded-xl bg-accent text-brand-strong">
          <Icon className="size-4" aria-hidden />
        </span>

        <ChevronRight
          className="size-3.5 text-muted-foreground"
          aria-hidden
        />
      </span>

      <span className="mt-2.5 block text-xl leading-none font-bold tabular-nums">
        {value}
      </span>

      <span className="mt-1 block truncate text-xs text-muted-foreground">
        {label}
      </span>
    </Link>
  );
}

function AttentionItem({
  name,
  reason,
  href,
  tone = "attention",
}: {
  name: string;
  reason: string;
  href: string;
  tone?: "attention" | "urgent";
}) {
  return (
    <li>
      <Link
        href={href}
        className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3.5 transition-colors hover:bg-secondary/40"
      >
        <span
          className={
            tone === "urgent"
              ? "size-2.5 shrink-0 rounded-full bg-brand-strong"
              : "size-2.5 shrink-0 rounded-full bg-brand-muted"
          }
          aria-hidden
        />

        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-bold">
            {name}
          </span>

          <span className="mt-0.5 block truncate text-xs text-muted-foreground">
            {reason}
          </span>
        </span>

        <ChevronRight
          className="size-4 shrink-0 text-muted-foreground"
          aria-hidden
        />
      </Link>
    </li>
  );
}

function replyReason(reply: TrainerReplyRow) {
  return `알림장 답변 대기 ${reply.count}건`;
}

export default async function TrainerHomePage() {
  const user = await requireUser();

  const [today, todos, home] = await Promise.all([
    getTrainerToday(user.id),
    getTrainerTodos(user.id),
    getTrainerHome(user.id),
  ]);

  /**
   * 오늘 남은 예정 수업
   */
  const remaining = today.filter(
    (session) => session.status === "SCHEDULED",
  ).length;

  /**
   * 계약 만료가 임박한 회원
   */
  const expiring = home.members.filter(
    (member) => memberContractGroup(member) === "soon",
  );

  /**
   * 트레이너가 지금 확인해야 하는 관리 항목
   *
   * 중요:
   * 단순 운동 미기록 같은 데이터를 여기서 임의로
   * "위험" 또는 "즉시 확인"으로 판단하지 않는다.
   *
   * 현재 실제 서비스에서 제공하는
   * - 수업 완료 처리 필요
   * - 수업 알림장 작성 필요
   * - 회원 답변 대기
   * 만 사용한다.
   */
  const attention = [
    ...todos.needComplete.map((session) => ({
      key: `complete-${session.id}`,
      name: session.memberName,
      reason: `${formatKstTimeLabel(
        session.scheduledAt,
      )} 수업 완료 처리 필요`,
      href: session.connectionId
        ? `/trainer/members/${session.connectionId}`
        : "/trainer/schedule",
      tone: "urgent" as const,
    })),

    ...todos.needJournal.map((session) => ({
      key: `journal-${session.id}`,
      name: session.memberName,
      reason: `${formatKstDateLabel(
        session.scheduledAt,
      )} 수업 알림장 작성 필요`,
      href: session.connectionId
        ? `/trainer/members/${session.connectionId}`
        : "/trainer/journals",
      tone: "attention" as const,
    })),

    ...todos.awaitingReply.map((reply) => ({
      key: `reply-${reply.journalId}`,
      name: reply.memberName,
      reason: replyReason(reply),
      href: `/trainer/journals/${reply.journalId}`,
      tone: "attention" as const,
    })),
  ].slice(0, 5);

  const todoCount =
    todos.needComplete.length + todos.needJournal.length;

  const totalAttentionCount =
    todoCount + todos.awaitingReply.length;

  return (
    <main className="px-5 pt-5 pb-24">
      {/* ─────────────────────────
          Header
      ───────────────────────── */}
      <header>
        <h1 className="text-xl font-bold">
          오늘
        </h1>

        <p className="mt-1 text-sm text-muted-foreground">
          {formatKstDateLabel(new Date())}
        </p>
      </header>

      {/* ─────────────────────────
          Today Summary
      ───────────────────────── */}
      <section
        aria-label="오늘 요약"
        className="mt-4 flex gap-2.5"
      >
        <SummaryCard
          icon={CalendarClock}
          label={
            remaining > 0
              ? `남은 수업 ${remaining}`
              : "오늘 수업"
          }
          value={today.length}
          href="/trainer/schedule"
        />

        <SummaryCard
          icon={ClipboardCheck}
          label="처리할 일"
          value={todoCount}
          href="/trainer/journals"
        />

        <SummaryCard
          icon={MessageSquare}
          label="답장 대기"
          value={todos.awaitingReply.length}
          href="/trainer/journals"
        />
      </section>

      {/* ─────────────────────────
          Today's Schedule
      ───────────────────────── */}
      <section className="mt-7">
        <div className="flex items-baseline justify-between gap-2">
          <div>
            <h2 className="text-base font-bold">
              오늘 수업
            </h2>

            <p className="mt-0.5 text-xs text-muted-foreground">
              {today.length > 0
                ? `오늘 ${today.length}개의 수업`
                : "잡힌 수업이 없어요"}
            </p>
          </div>

          <Link
            href="/trainer/schedule"
            className="shrink-0 text-xs font-semibold text-brand-strong"
          >
            일정 전체
          </Link>
        </div>

        {today.length === 0 ? (
          <EmptyDay message="오늘은 잡힌 수업이 없어요" />
        ) : (
          <ul className="mt-3 flex flex-col gap-2.5">
            {today.map((session) => (
              <SessionRow
                key={session.id}
                session={session}
              />
            ))}
          </ul>
        )}
      </section>

      {/* ─────────────────────────
          Members needing attention
      ───────────────────────── */}
      {attention.length > 0 && (
        <section className="mt-7">
          <div className="flex items-baseline justify-between gap-2">
            <div>
              <h2 className="text-base font-bold">
                확인 필요한 회원
              </h2>

              <p className="mt-0.5 text-xs text-muted-foreground">
                {totalAttentionCount}건의 관리 항목이 있어요
              </p>
            </div>

            <Link
              href="/trainer/journals"
              className="shrink-0 text-xs font-semibold text-brand-strong"
            >
              전체 보기
            </Link>
          </div>

          <ul className="mt-3 flex flex-col gap-2.5">
            {attention.map((item) => (
              <AttentionItem
                key={item.key}
                name={item.name}
                reason={item.reason}
                href={item.href}
                tone={item.tone}
              />
            ))}
          </ul>
        </section>
      )}

      {/* ─────────────────────────
          Expiring PT contracts
      ───────────────────────── */}
      {expiring.length > 0 && (
        <Link
          href="/trainer/members?filter=soon"
          className="mt-3 flex items-center gap-2.5 rounded-2xl border border-border bg-card px-4 py-3 transition-colors hover:bg-secondary/40"
        >
          <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-accent text-brand-strong">
            <CalendarClock
              className="size-4"
              aria-hidden
            />
          </span>

          <span className="min-w-0 flex-1 text-sm font-bold">
            PT가 곧 끝나는 회원 {expiring.length}명
          </span>

          <span className="max-w-[42%] shrink-0 truncate text-xs text-muted-foreground">
            {expiring
              .slice(0, 2)
              .map((member) => member.name)
              .join(", ")}

            {expiring.length > 2 ? " 외" : ""}
          </span>

          <ChevronRight
            className="size-4 shrink-0 text-muted-foreground"
            aria-hidden
          />
        </Link>
      )}

      {/* ─────────────────────────
          Members
      ───────────────────────── */}
      <section className="mt-7">
        <div className="flex items-baseline justify-between gap-2">
          <div>
            <h2 className="text-base font-bold">
              담당 회원
            </h2>

            <p className="mt-0.5 text-xs text-muted-foreground">
              관리 중인 회원 {home.members.length}명
            </p>
          </div>

          <Link
            href="/trainer/members"
            className="shrink-0 text-xs font-semibold text-brand-strong"
          >
            전체 보기
          </Link>
        </div>

        {home.members.length === 0 ? (
          <NoMembers />
        ) : (
          <ul className="mt-3 flex flex-col gap-2.5">
            {home.members
              .slice(0, 5)
              .map((member) => (
                <MemberCard
                  key={member.connectionId}
                  member={member}
                />
              ))}
          </ul>
        )}
      </section>

      {/* ─────────────────────────
          Todo shortcut
      ───────────────────────── */}
      <Link
        href="/trainer/journals"
        className="mt-7 flex items-center justify-between rounded-2xl bg-secondary px-4 py-3.5"
      >
        <span className="flex items-center gap-2.5">
          <span className="flex size-8 items-center justify-center rounded-xl bg-card text-brand-strong">
            <NotebookPen
              className="size-4"
              aria-hidden
            />
          </span>

          <span>
            <span className="block text-sm font-bold">
              할 일 모아보기
            </span>

            <span className="mt-0.5 block text-xs text-muted-foreground">
              수업 기록 · 알림장 · 답장 대기
            </span>
          </span>
        </span>

        <ChevronRight
          className="size-4 text-muted-foreground"
          aria-hidden
        />
      </Link>
    </main>
  );
}