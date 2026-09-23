import Link from "next/link";

import {
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  MessageSquare,
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
  type TrainerManagementStatus,
} from "@/server/trainers/trainer.service";

import { MemberCard, NoMembers } from "./member-card";
import { EmptyDay, SessionRow } from "./session-row";

export const metadata = { title: "트레이너 | FitNote" };

type TodoItem = {
  key: string;
  name: string;
  reason: string;
  href: string;
  status: "urgent" | "attention";
};

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

function TodoItemCard({
  name,
  reason,
  href,
  status,
}: TodoItem) {
  const urgent = status === "urgent";

  return (
    <li>
      <Link
        href={href}
        className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3.5 transition-colors hover:bg-secondary/40"
      >
        <span
          className={
            urgent
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

  /*
   * 오늘 아직 남은 예정 수업.
   */
  const remaining = today.filter(
    (session) => session.status === "SCHEDULED",
  ).length;

  /*
   * 실제로 처리해야 하는 일.
   *
   * 여기서는 getTrainerTodos()만 사용한다.
   *
   * - 완료 처리 필요
   * - 알림장 작성 필요
   * - 회원 답변 대기
   *
   * 회원의 managementEvents를 다시 섞지 않는다.
   */
  const todoItems: TodoItem[] = [
    ...todos.needComplete.map((session) => ({
      key: `complete-${session.id}`,
      name: session.memberName,
      reason: `${formatKstTimeLabel(
        session.scheduledAt,
      )} 수업 완료 처리 필요`,
      href: session.connectionId
        ? `/trainer/members/${session.connectionId}`
        : "/trainer/schedule",
      status: "urgent" as const,
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
      status: "attention" as const,
    })),

    ...todos.awaitingReply.map((reply) => ({
      key: `reply-${reply.journalId}`,
      name: reply.memberName,
      reason: replyReason(reply),
      href: `/trainer/journals/${reply.journalId}`,
      status: "attention" as const,
    })),
  ];

  /*
   * 즉시 처리해야 하는 일 → 확인이 필요한 일 순서.
   */
  const displayedTodos = todoItems
    .sort((a, b) => {
      const priority = {
        urgent: 0,
        attention: 1,
      } as const;

      return priority[a.status] - priority[b.status];
    })
    .slice(0, 5);

  const totalTodoCount = todoItems.length;

  /*
   * 회원 관리 이벤트가 있는 회원을 우선 노출한다.
   *
   * managementStatus / managementEvents는
   * trainer.service.ts에서 이미 계산되어 있다.
   */
  const membersNeedingAttention = home.members.filter(
    (member) => member.managementEvents.length > 0,
  );

  const displayedMembers =
    membersNeedingAttention.length > 0
      ? membersNeedingAttention.slice(0, 5)
      : home.members.slice(0, 5);

  return (
    <main className="px-5 pt-5 pb-24">
      {/* Header */}
      <header>
        <h1 className="text-xl font-bold">오늘</h1>

        <p className="mt-1 text-sm text-muted-foreground">
          {formatKstDateLabel(new Date())}
        </p>
      </header>

      {/* Today summary */}
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
          value={totalTodoCount}
          href="/trainer/journals"
        />

        <SummaryCard
          icon={MessageSquare}
          label="답장 대기"
          value={todos.awaitingReply.length}
          href="/trainer/journals"
        />
      </section>

      {/* Today's schedule */}
      <section className="mt-7">
        <div className="flex items-baseline justify-between gap-2">
          <div>
            <h2 className="text-base font-bold">오늘 수업</h2>

            <p className="mt-0.5 text-xs text-muted-foreground">
              {today.length === 0
                ? "잡힌 수업이 없어요"
                : remaining > 0
                  ? `앞으로 ${remaining}개의 수업이 있어요`
                  : "오늘 수업이 모두 끝났어요"}
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

      {/* Today's todos */}
      <section className="mt-7">
        <div className="flex items-baseline justify-between gap-2">
          <div>
            <h2 className="text-base font-bold">
              지금 처리할 일
            </h2>

            <p className="mt-0.5 text-xs text-muted-foreground">
              {totalTodoCount > 0
                ? `${totalTodoCount}건의 처리할 일이 있어요`
                : "밀린 일이 없어요"}
            </p>
          </div>

          <Link
            href="/trainer/journals"
            className="shrink-0 text-xs font-semibold text-brand-strong"
          >
            전체 보기
          </Link>
        </div>

        {displayedTodos.length === 0 ? (
          <div className="mt-3 flex items-center gap-3 rounded-2xl border border-border bg-card p-4">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-accent text-brand-strong">
              <CheckCircle2
                className="size-4"
                aria-hidden
              />
            </span>

            <div className="min-w-0">
              <p className="text-sm font-bold">
                밀린 일이 없어요
              </p>

              <p className="mt-0.5 text-xs text-muted-foreground">
                수업이 끝나거나 새로운 답장이 오면 여기에 표시돼요.
              </p>
            </div>
          </div>
        ) : (
          <ul className="mt-3 flex flex-col gap-2.5">
            {displayedTodos.map((item) => (
              <TodoItemCard
                key={item.key}
                name={item.name}
                reason={item.reason}
                href={item.href}
                status={item.status}
              />
            ))}
          </ul>
        )}

        {totalTodoCount > displayedTodos.length ? (
          <Link
            href="/trainer/journals"
            className="mt-2.5 flex items-center justify-center gap-1 rounded-2xl border border-border py-3 text-xs font-semibold text-muted-foreground transition-colors hover:bg-secondary/40"
          >
            처리할 일 {totalTodoCount}건 모두 보기
            <ChevronRight
              className="size-3.5"
              aria-hidden
            />
          </Link>
        ) : null}
      </section>

      {/* Members needing management */}
      <section className="mt-7">
        <div className="flex items-baseline justify-between gap-2">
          <div>
            <h2 className="text-base font-bold">
              {membersNeedingAttention.length > 0
                ? "관리할 회원"
                : "담당 회원"}
            </h2>

            <p className="mt-0.5 text-xs text-muted-foreground">
              {membersNeedingAttention.length > 0
                ? `${membersNeedingAttention.length}명의 회원을 확인해 주세요`
                : `관리 중인 회원 ${home.members.length}명`}
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
            {displayedMembers.map((member) => (
              <MemberCard
                key={member.connectionId}
                member={member}
              />
            ))}
          </ul>
        )}

        {home.members.length > displayedMembers.length ? (
          <Link
            href="/trainer/members"
            className="mt-2.5 flex items-center justify-center gap-1 rounded-2xl border border-border py-3 text-xs font-semibold text-muted-foreground transition-colors hover:bg-secondary/40"
          >
            회원 {home.members.length}명 전체 보기
            <ChevronRight
              className="size-3.5"
              aria-hidden
            />
          </Link>
        ) : null}
      </section>
    </main>
  );
}