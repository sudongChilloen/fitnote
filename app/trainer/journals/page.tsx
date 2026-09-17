import Link from "next/link";

import {
  AlertCircle,
  Check,
  MessageSquare,
  NotebookPen,
} from "lucide-react";

import { requireUser } from "@/app/lib/dal";
import { formatKstDateLabel } from "@/lib/date";
import { getTrainerTodos } from "@/server/trainers/trainer-board.service";

import { SessionRow } from "../session-row";

export const metadata = { title: "할 일 | FitNote" };

/**
 * 트레이너의 관리 업무 Inbox.
 *
 * 단순히 밀린 기록을 나열하는 것이 아니라
 * "지금 무엇을 처리해야 하는가"를 먼저 보여준다.
 *
 * 실제 업무 데이터는 getTrainerTodos()를 그대로 사용한다.
 * 수업 정보는 일정 화면과 동일한 SessionRow를 사용해 표현을 통일한다.
 */
export default async function TrainerJournalsPage() {
  const user = await requireUser();
  const todos = await getTrainerTodos(user.id);

  const totalCount =
    todos.needComplete.length +
    todos.needJournal.length +
    todos.awaitingReply.length;

  const clear = totalCount === 0;

  return (
    <main className="px-5 pt-5 pb-16">
      {/* Header */}
      <header>
        <h1 className="text-xl font-bold">할 일</h1>

        {!clear ? (
          <p className="mt-1 text-sm text-muted-foreground">
            지금 처리해야 할 업무를 확인해 주세요.
          </p>
        ) : null}
      </header>

      {clear ? (
        <EmptyTodo />
      ) : (
        <>
          {/* Summary */}
          <section className="mt-5 rounded-2xl bg-accent px-4 py-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-muted-foreground">
                  지금 처리할 일
                </p>

                <p className="mt-0.5 text-lg font-bold tabular-nums">
                  {totalCount}
                  <span className="ml-1 text-sm font-semibold">
                    건
                  </span>
                </p>
              </div>

              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-card text-brand-strong">
                <NotebookPen className="size-5" aria-hidden />
              </span>
            </div>
          </section>

          {/* 완료 처리 */}
          {todos.needComplete.length > 0 ? (
            <TodoSection
              title="완료하지 않은 수업"
              count={todos.needComplete.length}
              description="수업을 완료 처리해야 PT 횟수에 반영돼요."
              tone="attention"
            >
              <ul className="flex flex-col gap-2.5">
                {todos.needComplete.map((session) => (
                  <li key={session.id}>
                    <p className="mb-1 pl-1 text-xs text-muted-foreground">
                      {formatKstDateLabel(session.scheduledAt)}
                    </p>

                    <SessionRow session={session} />
                  </li>
                ))}
              </ul>
            </TodoSection>
          ) : null}

          {/* 알림장 작성 */}
          {todos.needJournal.length > 0 ? (
            <TodoSection
              title="작성하지 않은 알림장"
              count={todos.needJournal.length}
              description="수업 기록을 남기고 회원에게 알림장을 보내 주세요."
            >
              <ul className="flex flex-col gap-2.5">
                {todos.needJournal.map((session) => (
                  <li key={session.id}>
                    <p className="mb-1 pl-1 text-xs text-muted-foreground">
                      {formatKstDateLabel(session.scheduledAt)}
                    </p>

                    <SessionRow session={session} />
                  </li>
                ))}
              </ul>
            </TodoSection>
          ) : null}

          {/* 회원 답변 */}
          {todos.awaitingReply.length > 0 ? (
            <TodoSection
              title="회원 답변 확인"
              count={todos.awaitingReply.length}
              description="회원이 알림장에 남긴 답변을 확인해 주세요."
            >
              <ul className="flex flex-col gap-2.5">
                {todos.awaitingReply.map((row) => (
                  <li key={row.journalId}>
                    <Link
                      href={`/trainer/journals/${row.journalId}`}
                      className="group flex items-center gap-3 rounded-2xl border border-border bg-card p-4 transition-colors hover:bg-muted/40"
                    >
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent text-brand-strong">
                        <MessageSquare
                          className="size-4"
                          aria-hidden
                        />
                      </span>

                      <span className="min-w-0 flex-1">
                        <span className="flex min-w-0 items-center gap-2">
                          <span className="truncate text-sm font-bold">
                            {row.memberName}
                          </span>

                          <span className="shrink-0 rounded-full bg-brand px-2 py-0.5 text-[0.625rem] font-bold text-primary tabular-nums">
                            답변 {row.count}
                          </span>
                        </span>

                        <span className="mt-1 block text-xs text-muted-foreground">
                          {formatKstDateLabel(row.date)} 알림장
                        </span>
                      </span>

                      <span
                        className="text-sm text-muted-foreground transition-transform group-hover:translate-x-0.5"
                        aria-hidden
                      >
                        ›
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </TodoSection>
          ) : null}
        </>
      )}
    </main>
  );
}

function EmptyTodo() {
  return (
    <div className="mt-5 flex flex-col items-center rounded-2xl border border-border bg-card px-5 py-10">
      <span className="flex size-11 items-center justify-center rounded-full bg-accent text-brand-strong">
        <Check className="size-5" aria-hidden />
      </span>

      <p className="mt-3 text-sm font-bold">
        지금 처리할 일이 없어요
      </p>

      <p className="mt-1 text-center text-xs text-muted-foreground">
        수업이 끝나거나 회원의 답변이 도착하면
        <br />
        여기에 표시돼요.
      </p>
    </div>
  );
}

function TodoSection({
  title,
  count,
  description,
  tone = "default",
  children,
}: {
  title: string;
  count: number;
  description: string;
  tone?: "default" | "attention";
  children: React.ReactNode;
}) {
  return (
    <section className="mt-7">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-base font-bold">{title}</h2>

        <span className="shrink-0 text-xs font-semibold text-muted-foreground tabular-nums">
          {count}건
        </span>
      </div>

      <p
        className={[
          "mt-1 flex items-start gap-1.5 text-xs",
          tone === "attention"
            ? "text-muted-foreground"
            : "text-muted-foreground",
        ].join(" ")}
      >
        {tone === "attention" ? (
          <AlertCircle
            className="mt-0.5 size-3.5 shrink-0"
            aria-hidden
          />
        ) : null}

        <span>{description}</span>
      </p>

      <div className="mt-3">{children}</div>
    </section>
  );
}