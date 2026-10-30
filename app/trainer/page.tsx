import Link from "next/link";

import {
  CalendarClock,
  ChevronRight,
  ClipboardCheck,
  MessageSquare,
} from "lucide-react";

import { requireUser } from "@/app/lib/dal";
import { SummaryCard } from "@/components/summary-card";
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
import { cn } from "@/lib/utils";

export const metadata = { title: "트레이너 | FitNote" };

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
  const urgent = tone === "urgent";

  return (
    <li>
      <Link
        href={href}
        className="flex items-center gap-3 border-b border-line px-1 py-2.5"
      >
        <span
          aria-hidden
          className="flex size-9.5 shrink-0 items-center justify-center rounded-full bg-surface text-sm font-extrabold"
        >
          {name.trim().slice(0, 1)}
        </span>

        <span className="min-w-0 flex-1">
          <span className="flex min-w-0 items-center gap-1.5">
            <span className="min-w-0 truncate text-sm font-bold tracking-tight">
              {name}
            </span>
            <span
              className={cn(
                "shrink-0 rounded-full border px-1.5 text-[0.6875rem] leading-[1.0625rem] font-bold",
                urgent
                  ? "border-coral text-status-urgent"
                  : "border-input text-muted-foreground",
              )}
            >
              {urgent ? "즉시 확인" : "확인 필요"}
            </span>
          </span>

          <span className="mt-0.5 block truncate text-xs text-muted-foreground">
            {reason}
          </span>
        </span>

        <span className="flex h-8 shrink-0 items-center rounded-full bg-surface px-3 text-xs font-bold">
          처리
        </span>
      </Link>
    </li>
  );
}

function replyReason(reply: TrainerReplyRow) {
  const preview = String(reply.content ?? "")
    .replace(/\s+/g, " ")
    .trim();
  const shortened = preview.length > 44 ? `${preview.slice(0, 44)}…` : preview;

  const journalLabel = reply.title ?? "알림장";
  const dateLabel = formatKstDateLabel(reply.date);

  return preview
    ? `“${shortened}” · ${journalLabel} · ${dateLabel}`
    : `답변 대기 · ${journalLabel} · ${dateLabel}`;
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
      reason: `${formatKstTimeLabel(session.scheduledAt)} 수업 완료 처리 필요`,
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

  const todoCount = todos.needComplete.length + todos.needJournal.length;

  // 아직 안 한 수업 중 가장 빠른 것. 오늘 목록에서 딥그린으로 칠한다.
  const nextSessionId =
    today.find(
      (session) => session.status === "SCHEDULED" && session.managementEvents.length === 0,
    )?.id ?? null;

  const totalAttentionCount = todoCount + todos.awaitingReply.length;

  return (
    <main className="flex flex-col gap-3 px-4 pt-4 pb-6">
      {/* Dashboard Header */}
      <header className="relative overflow-hidden rounded-3xl border border-border bg-card py-4.5 pr-4.5 pl-5">
        <div className="absolute -top-9 -right-7.5 size-30 rounded-full bg-[#f3faf6]" />

        <div className="relative flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-surface px-2.5 py-1">
              <CalendarClock className="size-3.5 text-primary" aria-hidden />
              <span className="text-xs font-bold text-[#4b5650]">
                {formatKstDateLabel(new Date())}
              </span>
            </div>

            <h1 className="mt-3 text-[1.375rem] leading-snug font-extrabold tracking-tight">
              안녕하세요,
              <br />
              <span className="text-primary">
                {user.trainerDisplayName ?? user.name}
              </span>
              <span className="ml-1">님!</span>
            </h1>

            <p className="mt-1.5 text-[0.8125rem] text-muted-foreground">
              {today.length === 0
                ? "오늘은 잡힌 수업이 없어요."
                : remaining > 0
                  ? `오늘 수업 ${today.length}개 중 ${remaining}개가 남았어요.`
                  : `오늘 수업 ${today.length}개를 모두 마쳤어요.`}
            </p>
          </div>

          <div className="relative flex size-12 shrink-0 items-center justify-center rounded-2xl bg-brand-muted text-primary">
            <ClipboardCheck className="size-5.5" aria-hidden />
          </div>
        </div>
      </header>
      {/* Today's Summary */}
      <section aria-label="오늘 요약" className="grid grid-cols-3 gap-2">
        <SummaryCard
          icon={CalendarClock}
          label="오늘 수업"
          value={today.length}
          href="/trainer/schedule"
        />

        <SummaryCard
          icon={ClipboardCheck}
          label="처리할 일"
          value={todoCount}
          href="/trainer/journals"
          highlight={todoCount > 0}
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
      <section>
        <div className="mx-1 mt-2 mb-1.5 flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-1.5 text-[1.0625rem] font-extrabold">
            오늘 수업
            <span className="rounded-full bg-brand-muted px-2 py-px text-xs font-bold text-primary tabular-nums">
              {today.length}
            </span>
          </h2>
          <Link href="/trainer/schedule" className="shrink-0 text-xs font-bold text-primary">
            전체 일정 ›
          </Link>
        </div>

        {today.length === 0 ? (
          <EmptyDay message="오늘은 잡힌 수업이 없어요" />
        ) : (
          <ul className="flex flex-col gap-1.5">
            {today.map((session) => (
              <SessionRow
                key={session.id}
                session={session}
                isNext={session.id === nextSessionId}
              />
            ))}
          </ul>
        )}
      </section>
      {/* ─────────────────────────
          Members needing attention
      ───────────────────────── */}
      {attention.length > 0 && (
        <section>
          <div className="mx-1 mt-2 mb-0.5 flex items-center justify-between gap-3">
            <h2 className="flex items-center gap-1.5 text-[1.0625rem] font-extrabold">
              확인 필요한 회원
              <span className="rounded-full bg-status-urgent-bg px-2 py-px text-xs font-bold text-status-urgent tabular-nums">
                {totalAttentionCount}
              </span>
            </h2>
            <Link href="/trainer/journals" className="shrink-0 text-xs font-bold text-primary">
              전체 보기 ›
            </Link>
          </div>
          <ul className="mt-1 flex flex-col">
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
      {/* Expiring PT contracts */}
      {expiring.length > 0 && (
        <Link
          href="/trainer/members?filter=soon"
          className="flex items-center gap-2.5 rounded-[1.125rem] border-[1.5px] border-coral bg-card py-3 pr-2 pl-3.5 text-ink transition-transform active:scale-[0.99]"
        >
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-bold tracking-tight">
              PT 만료 임박 {expiring.length}명
            </span>

            <span className="mt-0.5 block truncate text-xs text-muted-foreground">
              {expiring
                .slice(0, 2)
                .map((member) => member.name)
                .join(", ")}
              {expiring.length > 2 ? ` 외 ${expiring.length - 2}명` : ""} · 재등록 상담이 필요해요
            </span>
          </span>

          <span className="flex h-8 shrink-0 items-center rounded-full bg-surface px-3 text-xs font-bold text-ink">
            확인
          </span>
        </Link>
      )}

      {/* Members */}
      <section>
        <div className="mx-1 mt-2 mb-0.5 flex items-center justify-between gap-3">
          <h2 className="text-[1.0625rem] font-extrabold">
            담당 회원{" "}
            <span className="text-[0.8125rem] font-semibold text-muted-foreground tabular-nums">
              {home.members.length}명
            </span>
          </h2>
          <Link href="/trainer/members" className="shrink-0 text-xs font-bold text-primary">
            전체 보기 ›
          </Link>
        </div>

        {home.members.length === 0 ? (
          <div className="mt-4">
            <NoMembers />
          </div>
        ) : (
          <ul className="flex flex-col">
            {home.members.slice(0, 5).map((member) => (
              <MemberCard key={member.connectionId} member={member} />
            ))}
          </ul>
        )}

        {home.members.length > 5 && (
          <Link
            href="/trainer/members"
            className="mt-2 flex h-10 w-full items-center justify-center gap-1 rounded-full bg-surface text-xs font-bold text-muted-foreground transition-colors hover:bg-border hover:text-foreground"
          >
            회원 {home.members.length - 5}명 더 보기
            <ChevronRight className="size-3.5" aria-hidden />
          </Link>
        )}
      </section>

    </main>
  );
}
