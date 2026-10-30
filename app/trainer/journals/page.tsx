import Link from "next/link";

import { Check } from "lucide-react";

import { requireUser } from "@/app/lib/dal";
import { formatKstDateLabel, formatKstTimeLabel } from "@/lib/date";
import { cn } from "@/lib/utils";
import {
  getTrainerTodos,
  type TrainerSessionRow,
} from "@/server/trainers/trainer-board.service";

import { enterSessionRecord } from "../sessions/[id]/actions";

export const metadata = { title: "할 일 | FitNote" };

type Tab = "all" | "session" | "journal" | "reply";

const TABS: { key: Tab; label: string }[] = [
  { key: "all", label: "전체" },
  { key: "session", label: "수업" },
  { key: "journal", label: "알림장" },
  { key: "reply", label: "답장" },
];

function Avatar({ name }: { name: string }) {
  return (
    <span className="flex size-9.5 shrink-0 items-center justify-center rounded-full bg-surface text-sm font-extrabold">
      {name.trim().slice(0, 1)}
    </span>
  );
}

/**
 * 수업 한 줄. 누르면 기존처럼 서버 액션으로 수업 기록 화면에 들어간다.
 * 오른쪽 알약 하나가 지금 할 일이다.
 */
function SessionTodo({
  session,
  sub,
  cta,
  primary,
}: {
  session: TrainerSessionRow;
  sub: string;
  cta: string;
  primary: boolean;
}) {
  return (
    <li>
      <form action={enterSessionRecord}>
        <input type="hidden" name="ptSessionId" value={session.id} />
        <button
          type="submit"
          aria-label={`${session.memberName} ${session.sessionNumber}회차 ${cta}`}
          className="flex w-full items-center gap-3 border-b border-line px-1 py-2.5 text-left"
        >
          <Avatar name={session.memberName} />
          <span className="min-w-0 flex-1">
            <b className="block truncate text-sm">{session.memberName}</b>
            <span className="block truncate text-xs text-muted-foreground tabular-nums">{sub}</span>
          </span>
          <span
            className={cn(
              "flex h-8.5 shrink-0 items-center rounded-full border px-3 text-xs font-bold whitespace-nowrap",
              primary
                ? "border-primary bg-primary text-white"
                : "border-border bg-card text-ink",
            )}
          >
            {cta}
          </span>
        </button>
      </form>
    </li>
  );
}

function Group({
  title,
  count,
  dot,
  children,
}: {
  title: string;
  count: number;
  dot: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mx-1 mt-1.5 mb-1 flex items-center gap-2">
        <span aria-hidden className={`size-2 shrink-0 rounded-full ${dot}`} />
        <h2 className="min-w-0 flex-1 text-[0.9375rem] font-extrabold">
          {title} <span className="font-semibold text-muted-foreground tabular-nums">{count}</span>
        </h2>
      </div>
      <ul>{children}</ul>
    </section>
  );
}

/**
 * 트레이너의 관리 업무 Inbox (v3).
 *
 * 종류별로 묶고 줄마다 바로 처리하는 버튼 하나를 둔다.
 * 실제 업무 데이터는 getTrainerTodos() 를 그대로 사용한다.
 */
export default async function TrainerJournalsPage({
  searchParams,
}: PageProps<"/trainer/journals">) {
  const user = await requireUser();
  const [todos, query] = await Promise.all([getTrainerTodos(user.id), searchParams]);

  const tab: Tab = TABS.some((item) => item.key === query.tab) ? (query.tab as Tab) : "all";
  const counts: Record<Tab, number> = {
    all: todos.needComplete.length + todos.needJournal.length + todos.awaitingReply.length,
    session: todos.needComplete.length,
    journal: todos.needJournal.length,
    reply: todos.awaitingReply.length,
  };
  const show = (key: Exclude<Tab, "all">) => tab === "all" || tab === key;

  return (
    <main className="flex flex-col pb-6">
      <header className="flex items-center gap-2 py-3.5 pr-4 pl-5">
        <h1 className="min-w-0 flex-1 text-xl font-extrabold">
          할 일{" "}
          <span className="text-sm font-semibold text-muted-foreground tabular-nums">
            {counts.all}건
          </span>
        </h1>
      </header>

      <nav aria-label="종류" className="grid grid-cols-4 border-b border-line px-4 text-center">
        {TABS.map((item) => {
          const active = item.key === tab;
          return (
            <Link
              key={item.key}
              href={item.key === "all" ? "/trainer/journals" : `/trainer/journals?tab=${item.key}`}
              scroll={false}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex h-10 items-center justify-center gap-1 text-[0.8125rem] whitespace-nowrap",
                active
                  ? "font-extrabold text-ink shadow-[inset_0_-3px_0_var(--primary)]"
                  : "font-semibold text-faint",
              )}
            >
              {item.label}
              <small className={cn("text-[0.6875rem] tabular-nums", active ? "text-primary" : "text-faint")}>
                {counts[item.key]}
              </small>
            </Link>
          );
        })}
      </nav>

      <div className="flex flex-col gap-3 px-4 pt-3">
        {counts[tab] === 0 ? (
          <div className="flex flex-col items-center rounded-3xl bg-brand-muted px-5 py-10 text-ink">
            <span className="flex size-12 items-center justify-center rounded-full bg-primary text-white">
              <Check className="size-5" aria-hidden />
            </span>
            <p className="mt-3 text-sm font-bold">지금 처리할 일이 없어요</p>
            <p className="mt-1 text-center text-xs text-primary">
              수업이 끝나거나 회원의 답변이 도착하면
              <br />
              여기에 표시돼요.
            </p>
          </div>
        ) : null}

        {show("session") && todos.needComplete.length > 0 ? (
          <Group title="수업 완료 처리" count={todos.needComplete.length} dot="bg-coral">
            {todos.needComplete.map((session) => (
              <SessionTodo
                key={session.id}
                session={session}
                sub={`${formatKstDateLabel(session.scheduledAt)} ${formatKstTimeLabel(session.scheduledAt)} · ${session.sessionNumber}회차 · 출석 처리 전`}
                cta="마무리"
                primary
              />
            ))}
          </Group>
        ) : null}

        {show("journal") && todos.needJournal.length > 0 ? (
          <Group title="알림장 작성" count={todos.needJournal.length} dot="bg-primary">
            {todos.needJournal.map((session) => (
              <SessionTodo
                key={session.id}
                session={session}
                sub={`${formatKstDateLabel(session.scheduledAt)} 수업 · ${session.sessionNumber}회차`}
                cta="수업 기록"
                primary
              />
            ))}
          </Group>
        ) : null}

        {show("reply") && todos.awaitingReply.length > 0 ? (
          <Group title="답장 대기" count={todos.awaitingReply.length} dot="bg-brand">
            {todos.awaitingReply.map((row) => (
              <li key={row.journalId}>
                <Link
                  href={`/trainer/journals/${row.journalId}`}
                  className="flex items-center gap-3 border-b border-line px-1 py-2.5"
                >
                  <Avatar name={row.memberName} />
                  <span className="min-w-0 flex-1">
                    <b className="block truncate text-sm">{row.memberName}</b>
                    <span className="block truncate text-xs text-muted-foreground">
                      {row.content ? `“${row.content.replace(/\s+/g, " ")}”` : `${formatKstDateLabel(row.date)} 알림장`}
                      {row.count > 1 ? ` 외 ${row.count - 1}개` : ""}
                    </span>
                  </span>
                  <span className="flex h-8.5 shrink-0 items-center rounded-full border border-border px-3 text-xs font-bold">
                    답장
                  </span>
                </Link>
              </li>
            ))}
          </Group>
        ) : null}
      </div>
    </main>
  );
}
