import Link from "next/link";

import {
  CalendarClock,
  ChevronRight,
  ClipboardCheck,
  MessageSquare,
  NotebookPen,
  House,
} from "lucide-react";

import { requireUser } from "@/app/lib/dal";
import { Avatar } from "@/components/ui/avatar";
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

/** 간결한 숫자 요약 타일 */
function SummaryCard({
  icon: Icon,
  label,
  value,
  href,
  tint,
}: {
  icon: typeof CalendarClock;
  label: string;
  value: number;
  href: string;
  tint: string;
}) {
  return (
    <Link
      href={href}
      className={`group flex min-w-0 flex-1 items-center gap-2.5 rounded-2xl p-3 transition-transform active:scale-[0.98] ${tint}`}
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-white/75">
        <Icon className="size-[1.125rem]" aria-hidden />
      </span>

      <span className="min-w-0">
        <span className="block text-2xl leading-none font-bold tracking-tight tabular-nums">
          {value}
        </span>

        <span className="mt-1.5 block truncate text-[0.6875rem] font-semibold opacity-80">
          {label}
        </span>
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
  const urgent = tone === "urgent";

  return (
    <li>
      <Link
        href={href}
        className="group flex items-center gap-3 rounded-2xl border border-border/60 bg-card p-3.5 shadow-card transition-all duration-200 hover:border-primary/20 hover:bg-secondary/30 active:scale-[0.99]"
      >
        <div
          className={cn(
            "flex size-11 shrink-0 items-center justify-center rounded-2xl",
            urgent
              ? "bg-status-urgent-bg text-status-urgent"
              : "bg-status-check-bg text-status-check",
          )}
        >
          <Avatar name={name} className="size-9 text-sm" />
        </div>

        <span className="min-w-0 flex-1">
          <span className="flex min-w-0 flex-wrap items-center gap-1.5">
            <span className="truncate text-sm font-bold tracking-tight">
              {name}
            </span>

            <span
              className={cn(
                "shrink-0 rounded-md px-2 py-1 text-[10px] font-bold",
                urgent
                  ? "bg-status-urgent-bg text-status-urgent"
                  : "bg-status-check-bg text-status-check",
              )}
            >
              {urgent ? "즉시 확인" : "확인 필요"}
            </span>
          </span>

          <span className="mt-1.5 block text-xs leading-relaxed text-muted-foreground">
            {reason}
          </span>
        </span>

        <ChevronRight
          className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
          aria-hidden
        />
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

  const totalAttentionCount = todoCount + todos.awaitingReply.length;

  return (
    <main className="px-5 pt-4 pb-24">
      {/* Dashboard Header */}
      <header className="relative overflow-hidden rounded-3xl border border-border/60 bg-card px-5 py-5 shadow-card">
        <div className="absolute -right-8 -top-10 size-32 rounded-full bg-primary/5" />
        <div className="absolute -right-2 top-12 size-16 rounded-full bg-primary/5" />

        <div className="relative flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-2.5 py-1">
              <CalendarClock className="size-3.5 text-primary" aria-hidden />
              <span className="text-xs font-semibold text-muted-foreground">
                {formatKstDateLabel(new Date())}
              </span>
            </div>

            <h1 className="mt-4 text-2xl font-extrabold leading-tight tracking-tight">
              안녕하세요,
              <br />
              <span className="text-primary">
                {user.trainerDisplayName ?? user.name}
              </span>
              <span className="ml-1">님!</span>
            </h1>

            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              오늘도 회원들과 좋은 하루를 만들어 봐요.
            </p>
          </div>

          <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-tint-mint text-tint-mint-foreground">
            <House className="size-5" aria-hidden />
          </div>
        </div>
      </header>
      {/* Today's Summary */}
      <section aria-label="오늘 요약" className="mt-5 grid grid-cols-3 gap-2.5">
        <SummaryCard
          icon={CalendarClock}
          label={remaining > 0 ? `남은 수업 ${remaining}` : "오늘 수업"}
          value={today.length}
          href="/trainer/schedule"
          tint="bg-tint-sky text-tint-sky-foreground"
        />

        <SummaryCard
          icon={ClipboardCheck}
          label="처리할 일"
          value={todoCount}
          href="/trainer/journals"
          tint="bg-tint-butter text-tint-butter-foreground"
        />

        <SummaryCard
          icon={MessageSquare}
          label="답장 대기"
          value={todos.awaitingReply.length}
          href="/trainer/journals"
          tint="bg-tint-mint text-tint-mint-foreground"
        />
      </section>
      {/* ─────────────────────────
          Today's Schedule
      ───────────────────────── */}
      <section className="mt-7">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold tracking-tight">오늘 수업</h2>

              <span className="rounded-full bg-tint-sky px-2 py-0.5 text-xs font-bold text-tint-sky-foreground tabular-nums">
                {today.length}
              </span>
            </div>

            <p className="mt-1 text-xs text-muted-foreground">
              {remaining > 0
                ? `아직 ${remaining}개의 수업이 남아 있어요`
                : today.length > 0
                  ? "오늘 예정된 수업을 확인해 보세요"
                  : "잠시 여유를 가져도 좋은 하루예요"}
            </p>
          </div>

          <Link
            href="/trainer/schedule"
            className="flex shrink-0 items-center gap-1 rounded-xl px-2.5 py-2 text-xs font-semibold text-primary transition-colors hover:bg-accent"
          >
            전체 일정
            <ChevronRight className="size-3.5" aria-hidden />
          </Link>
        </div>

        {today.length === 0 ? (
          <EmptyDay message="오늘은 잡힌 수업이 없어요" />
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {today.map((session) => (
              <SessionRow key={session.id} session={session} />
            ))}
          </ul>
        )}
      </section>
      {/* ─────────────────────────
          Members needing attention
      ───────────────────────── */}
      {attention.length > 0 && (
        <section className="mt-7">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold tracking-tight">
                  확인 필요한 회원
                </h2>

                <span className="rounded-full bg-status-check-bg px-2 py-0.5 text-xs font-bold text-status-check tabular-nums">
                  {totalAttentionCount}
                </span>
              </div>

              <p className="mt-1 text-xs text-muted-foreground">
                수업 기록과 회원 답변을 확인해 주세요
              </p>
            </div>

            <Link
              href="/trainer/journals"
              className="flex shrink-0 items-center gap-1 rounded-xl px-2.5 py-2 text-xs font-semibold text-primary transition-colors hover:bg-accent"
            >
              전체 보기
              <ChevronRight className="size-3.5" aria-hidden />
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
      {/* Expiring PT contracts */}
      {expiring.length > 0 && (
        <Link
          href="/trainer/members?filter=soon"
          className="group mt-4 flex items-center gap-3 rounded-2xl border border-status-urgent/15 bg-status-urgent-bg/50 p-4 transition-all duration-200 hover:border-status-urgent/30 hover:bg-status-urgent-bg active:scale-[0.99]"
        >
          <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-card text-status-urgent shadow-sm">
            <CalendarClock className="size-5" aria-hidden />
          </span>

          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-bold tracking-tight">
                PT 만료 임박
              </span>
              <span className="rounded-full bg-status-urgent px-2 py-0.5 text-[10px] font-bold text-white">
                {expiring.length}명
              </span>
            </span>

            <span className="mt-1.5 block truncate text-xs leading-relaxed text-muted-foreground">
              {expiring
                .slice(0, 2)
                .map((member) => member.name)
                .join(", ")}
              {expiring.length > 2 ? " 외 추가 회원" : ""}
            </span>
          </span>

          <span className="flex shrink-0 items-center gap-1 text-xs font-bold text-status-urgent">
            확인하기
            <ChevronRight
              className="size-4 transition-transform group-hover:translate-x-0.5"
              aria-hidden
            />
          </span>
        </Link>
      )}

      {/* Members */}
      <section className="mt-8">
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-lg font-bold tracking-tight">담당 회원</h2>

            <p className="mt-1 text-xs text-muted-foreground">
              현재 관리 중인 회원{" "}
              <span className="font-semibold text-foreground">
                {home.members.length}명
              </span>
            </p>
          </div>

          <Link
            href="/trainer/members"
            className="inline-flex shrink-0 items-center gap-1 rounded-full border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground transition-colors hover:bg-muted"
          >
            전체 보기
            <ChevronRight className="size-3.5" aria-hidden />
          </Link>
        </div>

        {home.members.length === 0 ? (
          <div className="mt-4">
            <NoMembers />
          </div>
        ) : (
          <ul className="mt-4 flex flex-col gap-3">
            {home.members.slice(0, 5).map((member) => (
              <MemberCard key={member.connectionId} member={member} />
            ))}
          </ul>
        )}

        {home.members.length > 5 && (
          <Link
            href="/trainer/members"
            className="mt-3 flex w-full items-center justify-center gap-1 rounded-xl border border-dashed border-border py-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            회원 {home.members.length - 5}명 더 보기
            <ChevronRight className="size-3.5" aria-hidden />
          </Link>
        )}
      </section>

      {/* ─────────────────────────
          Todo shortcut
      ───────────────────────── */}
      <Link
        href="/trainer/journals"
        className="mt-7 flex items-center justify-between rounded-3xl bg-tint-lavender px-4 py-4 text-tint-lavender-foreground"
      >
        <span className="flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-full bg-white/70">
            <NotebookPen className="size-4" aria-hidden />
          </span>

          <span>
            <span className="block text-sm font-bold">할 일 모아보기</span>

            <span className="mt-0.5 block text-xs opacity-80">
              수업 기록 · 알림장 · 답장 대기
            </span>
          </span>
        </span>

        <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
      </Link>
    </main>
  );
}
