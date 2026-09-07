import Link from "next/link";

import { CalendarClock, MessageSquare, NotebookPen, Users } from "lucide-react";

import { requireUser } from "@/app/lib/dal";
import { formatKstDateLabel } from "@/lib/date";
import {
  getTrainerHome,
  type TrainerMemberRow,
} from "@/server/trainers/trainer.service";

export const metadata = { title: "트레이너 | FitNote" };

function formatTime(date: Date) {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

/** 이 회원에게 지금 해야 할 일. 없으면 null 이고, 그러면 조용히 둔다. */
function todoOf(member: TrainerMemberRow) {
  if (member.todaySession && member.todaySession.journal === null) {
    return { label: "알림장 작성", tone: "strong" as const };
  }
  if (member.todaySession && member.todaySession.journal?.status === "DRAFT") {
    return { label: "알림장 초안", tone: "strong" as const };
  }
  if (member.awaitingReply.length > 0) {
    return { label: "답장 대기", tone: "soft" as const };
  }
  return null;
}

function SummaryCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Users;
  label: string;
  value: number;
}) {
  return (
    <div className="flex-1 rounded-2xl border border-border bg-card p-3.5">
      <span className="flex size-8 items-center justify-center rounded-xl bg-accent text-brand-strong">
        <Icon className="size-4" aria-hidden />
      </span>
      <p className="mt-2.5 text-xl leading-none font-bold tabular-nums">
        {value}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

export default async function TrainerHomePage() {
  const user = await requireUser();
  const home = await getTrainerHome(user.id);

  return (
    <main className="px-5 pt-5 pb-16">
      <h1 className="text-xl font-bold">오늘의 회원</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {formatKstDateLabel(new Date())}
      </p>

      <div className="mt-4 flex gap-2.5">
        <SummaryCard
          icon={CalendarClock}
          label="오늘 수업"
          value={home.todayCount}
        />
        <SummaryCard
          icon={NotebookPen}
          label="알림장 남음"
          value={home.pendingJournalCount}
        />
        <SummaryCard
          icon={MessageSquare}
          label="답장 대기"
          value={home.awaitingReplyCount}
        />
      </div>

      <div className="mt-7 flex items-baseline justify-between">
        <h2 className="text-base font-bold">담당 회원</h2>
        <span className="text-xs text-muted-foreground tabular-nums">
          {home.members.length}명
        </span>
      </div>

      {home.members.length === 0 ? (
        <div className="mt-3 rounded-2xl border border-border bg-card p-5">
          <p className="text-sm font-bold">아직 담당 회원이 없어요</p>
          <p className="mt-1 text-xs text-muted-foreground">
            내 정보에서 회원 초대 코드를 만들어 전달하면, 회원이 코드를 넣는
            순간 담당으로 배정돼요.
          </p>
          <Link
            href="/profile"
            className="mt-3 inline-flex h-10 items-center rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground"
          >
            초대 코드 만들기
          </Link>
        </div>
      ) : (
        <ul className="mt-3 flex flex-col gap-2.5">
          {home.members.map((member) => {
            const todo = todoOf(member);

            return (
              <li key={member.membershipId}>
                <Link
                  href={`/trainer/members/${member.membershipId}`}
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

                    <span className="mt-1 block truncate text-xs text-muted-foreground">
                      {member.todaySession
                        ? `오늘 ${formatTime(member.todaySession.scheduledAt)} 수업`
                        : member.lastJournalAt
                          ? `마지막 알림장 ${formatKstDateLabel(member.lastJournalAt)}`
                          : "알림장 없음"}
                    </span>
                  </span>

                  {member.awaitingReply.length > 0 ? (
                    <span className="flex shrink-0 items-center gap-1 text-xs font-bold text-brand-strong">
                      <MessageSquare className="size-3.5" aria-hidden />
                      <span className="tabular-nums">
                        {member.awaitingReply.reduce(
                          (sum, r) => sum + r.count,
                          0,
                        )}
                      </span>
                    </span>
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
