import Link from "next/link";
import { notFound } from "next/navigation";

import { CalendarClock, Check, Lock, MessageSquare } from "lucide-react";

import { requireUser } from "@/app/lib/dal";
import { formatKstDateLabel } from "@/lib/date";
import {
  getMemberDetail,
  TrainerError,
} from "@/server/trainers/trainer.service";

export async function generateMetadata({
  params,
}: PageProps<"/trainer/members/[id]">) {
  const user = await requireUser();
  const { id } = await params;

  try {
    const member = await getMemberDetail(user.id, id);
    return { title: `${member.name} | FitNote` };
  } catch {
    return { title: "회원 | FitNote" };
  }
}

function formatTime(date: Date) {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

export default async function TrainerMemberPage({
  params,
}: PageProps<"/trainer/members/[id]">) {
  const user = await requireUser();
  const { id } = await params;

  let member;
  try {
    member = await getMemberDetail(user.id, id);
  } catch (error) {
    // 담당이 아닌 회원은 "권한 없음" 이 아니라 없는 것으로 다룬다. 권한 없음이라고
    // 알려주면 그 아이디의 회원이 있다는 사실 자체가 새어 나간다.
    if (error instanceof TrainerError) notFound();
    throw error;
  }

  return (
    <main className="px-5 pt-5 pb-16">
      <h1 className="text-xl font-bold">{member.name}</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {formatKstDateLabel(member.joinedAt)} 담당 시작
      </p>

      <section className="mt-6">
        <h2 className="text-base font-bold">PT 계약</h2>

        {member.contracts.length === 0 ? (
          <p className="mt-2 rounded-2xl border border-border bg-card p-4 text-xs text-muted-foreground">
            진행 중인 PT 계약이 없어요.
          </p>
        ) : (
          <ul className="mt-2 flex flex-col gap-2.5">
            {member.contracts.map((contract) => {
              const left = contract.totalSessions - contract.usedSessions;
              const ratio =
                contract.totalSessions === 0
                  ? 0
                  : (contract.usedSessions / contract.totalSessions) * 100;

              return (
                <li
                  key={contract.id}
                  className="rounded-2xl border border-border bg-card p-4"
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="truncate font-bold">{contract.productName}</p>
                    <p className="shrink-0 text-sm font-bold text-brand-strong tabular-nums">
                      {left}회 남음
                    </p>
                  </div>

                  <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-secondary">
                    <div
                      className="h-full rounded-full bg-brand"
                      style={{ width: `${ratio}%` }}
                    />
                  </div>

                  <p className="mt-2 text-xs text-muted-foreground tabular-nums">
                    {contract.usedSessions} / {contract.totalSessions}회
                    {contract.expiresAt
                      ? ` · ${formatKstDateLabel(contract.expiresAt)} 만료`
                      : ""}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="mt-7">
        <h2 className="text-base font-bold">다가오는 수업</h2>

        {member.upcomingSessions.length === 0 ? (
          <p className="mt-2 rounded-2xl border border-border bg-card p-4 text-xs text-muted-foreground">
            잡힌 수업이 없어요.
          </p>
        ) : (
          <ul className="mt-2 flex flex-col gap-2">
            {member.upcomingSessions.map((session) => (
              <li
                key={session.id}
                className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4"
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-secondary text-muted-foreground">
                  <CalendarClock className="size-4.5" aria-hidden />
                </span>

                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold">
                    {formatKstDateLabel(session.scheduledAt)}{" "}
                    {formatTime(session.scheduledAt)}
                  </span>
                  <span className="mt-0.5 block text-xs text-muted-foreground tabular-nums">
                    {session.sessionNumber}회차
                  </span>
                </span>

                {session.journalId ? (
                  <Link
                    href={`/journal/${session.journalId}`}
                    className="shrink-0 text-xs font-semibold text-brand-strong"
                  >
                    알림장
                  </Link>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-7">
        <h2 className="text-base font-bold">알림장</h2>

        {member.journals.length === 0 ? (
          <p className="mt-2 rounded-2xl border border-border bg-card p-4 text-xs text-muted-foreground">
            아직 쓴 알림장이 없어요.
          </p>
        ) : (
          <ul className="mt-2 flex flex-col gap-2">
            {member.journals.map((journal) => (
              <li key={journal.id}>
                <Link
                  href={`/journal/${journal.id}`}
                  className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4"
                >
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span className="truncate text-sm font-bold">
                        {journal.title ?? formatKstDateLabel(journal.date)}
                      </span>
                      {journal.status === "DRAFT" ? (
                        <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-[0.6875rem] font-bold text-muted-foreground">
                          초안
                        </span>
                      ) : null}
                      {journal.awaitingReply ? (
                        <span className="shrink-0 rounded-full bg-brand px-2 py-0.5 text-[0.6875rem] font-bold text-primary">
                          답장 대기
                        </span>
                      ) : null}
                    </span>

                    <span className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{formatKstDateLabel(journal.date)}</span>
                      {journal.commentCount > 0 ? (
                        <span className="flex items-center gap-0.5">
                          <MessageSquare className="size-3" aria-hidden />
                          <span className="tabular-nums">
                            {journal.commentCount}
                          </span>
                        </span>
                      ) : null}
                      {journal.status === "PUBLISHED" &&
                      journal.readByMember ? (
                        <span className="flex items-center gap-0.5">
                          <Check className="size-3" aria-hidden />
                          읽음
                        </span>
                      ) : null}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-7 rounded-2xl border border-dashed border-border p-4">
        <span className="flex size-8 items-center justify-center rounded-xl bg-secondary text-muted-foreground">
          <Lock className="size-4" aria-hidden />
        </span>
        <p className="mt-2.5 text-sm font-bold">
          식단과 개인 운동기록은 아직 보이지 않아요
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          회원이 무엇을 공유할지 직접 고르는 화면을 만들고 있어요. 회원이 켠
          항목만 여기에 나타나요.
        </p>
      </section>
    </main>
  );
}
