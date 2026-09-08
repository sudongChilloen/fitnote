import Link from "next/link";

import { Check, MessageSquare } from "lucide-react";

import { requireUser } from "@/app/lib/dal";
import { formatKstDateLabel } from "@/lib/date";
import { getTrainerTodos } from "@/server/trainers/trainer-board.service";

import { SessionRow } from "../session-row";

export const metadata = { title: "알림장 | FitNote" };

/**
 * 알림장 할 일.
 *
 * 홈의 "알림장 남음 2" 는 숫자만 보여 주고 눌리지 않았다. 트레이너가 알고
 * 싶은 건 2가 아니라 누구인지다. 그걸 알려면 회원 목록을 다시 뒤져야 했다.
 *
 * 그래서 안 쓴 것과 답장 기다리는 것을 한 화면에 모은다. 이 화면이 비면
 * 오늘 할 일이 끝난 것이다.
 */
export default async function TrainerJournalsPage() {
  const user = await requireUser();
  const todos = await getTrainerTodos(user.id);

  const clear =
    todos.needJournal.length === 0 && todos.awaitingReply.length === 0;

  return (
    <main className="px-5 pt-5 pb-16">
      <h1 className="text-xl font-bold">알림장</h1>

      {clear ? (
        <div className="mt-4 flex flex-col items-center rounded-2xl border border-border bg-card px-5 py-10">
          <span className="flex size-11 items-center justify-center rounded-full bg-accent text-brand-strong">
            <Check className="size-5" aria-hidden />
          </span>
          <p className="mt-3 text-sm font-bold">밀린 알림장이 없어요</p>
          <p className="mt-1 text-center text-xs text-muted-foreground">
            수업을 완료로 바꾸면 여기에 올라와요.
          </p>
        </div>
      ) : null}

      {todos.needJournal.length > 0 ? (
        <section className="mt-6">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="text-base font-bold">아직 안 쓴 수업</h2>
            <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
              {todos.needJournal.length}건
            </span>
          </div>

          <ul className="mt-3 flex flex-col gap-2.5">
            {todos.needJournal.map((session) => (
              <li key={session.id}>
                <p className="mb-1 pl-1 text-xs text-muted-foreground">
                  {formatKstDateLabel(session.scheduledAt)}
                </p>
                <ul>
                  <SessionRow session={session} />
                </ul>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {todos.awaitingReply.length > 0 ? (
        <section className="mt-7">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="text-base font-bold">답장 기다리는 중</h2>
            <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
              {todos.awaitingReply.length}건
            </span>
          </div>

          <ul className="mt-3 flex flex-col gap-2.5">
            {todos.awaitingReply.map((row) => (
              <li key={row.journalId}>
                <Link
                  href={`/trainer/journals/${row.journalId}`}
                  className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4"
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-accent text-brand-strong">
                    <MessageSquare className="size-4" aria-hidden />
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-bold">
                      {row.memberName}
                    </span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {formatKstDateLabel(row.date)} 알림장
                    </span>
                  </span>

                  <span className="shrink-0 rounded-full bg-brand px-2 py-0.5 text-[0.6875rem] font-bold text-primary tabular-nums">
                    {row.count}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}
