import Link from "next/link";

import {
  CalendarClock,
  ChevronRight,
  MessageSquare,
  NotebookPen,
} from "lucide-react";

import { requireUser } from "@/app/lib/dal";
import { formatKstDateLabel } from "@/lib/date";
import {
  getTrainerToday,
  getTrainerTodos,
} from "@/server/trainers/trainer-board.service";
import { getTrainerHome } from "@/server/trainers/trainer.service";

import { MemberCard, NoMembers } from "./member-card";
import { EmptyDay, SessionRow } from "./session-row";

export const metadata = { title: "트레이너 | FitNote" };

/**
 * 요약 카드.
 *
 * 전부 눌린다. 예전에는 숫자만 보여 주고 막다른 길이었는데, 트레이너가 알고
 * 싶은 건 "2" 가 아니라 누구인지다. 숫자를 보여 줬으면 그 뒤를 열어 줘야 한다.
 */
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
      className="flex-1 rounded-2xl border border-border bg-card p-3.5"
    >
      <span className="flex items-center justify-between">
        <span className="flex size-8 items-center justify-center rounded-xl bg-accent text-brand-strong">
          <Icon className="size-4" aria-hidden />
        </span>
        <ChevronRight className="size-3.5 text-muted-foreground" aria-hidden />
      </span>
      <span className="mt-2.5 block text-xl leading-none font-bold tabular-nums">
        {value}
      </span>
      <span className="mt-1 block text-xs text-muted-foreground">{label}</span>
    </Link>
  );
}

/**
 * 트레이너 홈.
 *
 * 회원 목록이 아니라 오늘 할 일이 먼저다. 트레이너는 회원·계약 단위로 일하지
 * 않고 시간과 할 일 단위로 일한다 — 다음이 몇 시에 누구인지, 뭘 안 썼는지.
 * 회원 전체 목록은 "회원" 탭으로 옮겼고, 여기에는 손이 가야 할 몇 명만 둔다.
 */
export default async function TrainerHomePage() {
  const user = await requireUser();

  const [today, todos, home] = await Promise.all([
    getTrainerToday(user.id),
    getTrainerTodos(user.id),
    getTrainerHome(user.id),
  ]);

  const remaining = today.filter(
    (session) => session.status === "SCHEDULED",
  ).length;

  return (
    <main className="px-5 pt-5 pb-16">
      <h1 className="text-xl font-bold">오늘</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {formatKstDateLabel(new Date())}
      </p>

      <div className="mt-4 flex gap-2.5">
        <SummaryCard
          icon={CalendarClock}
          label={remaining > 0 ? `남은 수업 ${remaining}` : "오늘 수업"}
          value={today.length}
          href="/trainer/schedule"
        />
        {/*
          두 숫자를 한 칸에 번갈아 넣으면 지금 보는 게 뭔지 매번 다시 읽어야
          한다. 그래서 "밀린 일" 하나로 합치고, 눌러서 들어간 화면에서 완료 안
          한 수업과 안 쓴 알림장으로 갈라 보여 준다.
        */}
        <SummaryCard
          icon={NotebookPen}
          label="밀린 일"
          value={todos.needComplete.length + todos.needJournal.length}
          href="/trainer/journals"
        />
        <SummaryCard
          icon={MessageSquare}
          label="답장 대기"
          value={todos.awaitingReply.length}
          href="/trainer/journals"
        />
      </div>

      <section className="mt-7">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-base font-bold">오늘 수업</h2>
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
              <SessionRow key={session.id} session={session} />
            ))}
          </ul>
        )}
      </section>

      <section className="mt-7">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-base font-bold">담당 회원</h2>
          <Link
            href="/trainer/members"
            className="shrink-0 text-xs font-semibold text-brand-strong"
          >
            {home.members.length}명 전체
          </Link>
        </div>

        {home.members.length === 0 ? (
          <NoMembers />
        ) : (
          <ul className="mt-3 flex flex-col gap-2.5">
            {/*
              홈에서는 손이 가야 할 회원만 몇 명 보여 준다. 정렬이 이미 할 일
              순이라 위에서 자르면 그게 오늘 신경 쓸 사람들이다.
            */}
            {home.members.slice(0, 5).map((member) => (
              <MemberCard key={member.connectionId} member={member} />
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
