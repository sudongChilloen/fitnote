import Link from "next/link";

import { PageHeader } from "@/components/layout/page-header";
import { notFound } from "next/navigation";

import {
  Award,
  ChevronRight,
  Flag,
  HeartPulse,
  Play,
  Scale,
  Square,
  UserPlus,
} from "lucide-react";

import { requireUser } from "@/app/lib/dal";
import { formatKstDateLabel } from "@/lib/date";
import {
  getMemberJourney,
  type JourneyEvent,
  type JourneyKind,
} from "@/server/journey/journey.service";
import { TrainerError } from "@/server/trainers/trainer.service";

export const metadata = { title: "회원 여정 | FitNote" };

const ICON: Record<JourneyKind, typeof Flag> = {
  CONNECTED: UserPlus,
  CONTRACT_STARTED: Play,
  CONTRACT_CLOSED: Square,
  FIRST_SESSION: Flag,
  SESSION_MILESTONE: Award,
  BODY_MILESTONE: Scale,
  GOAL_REACHED: HeartPulse,
};

/** 마디마다 색을 달리하면 상담 중에 눈으로 훑기 쉬워진다. */
const TONE: Record<JourneyKind, string> = {
  CONNECTED: "bg-secondary text-muted-foreground",
  CONTRACT_STARTED: "bg-brand-muted text-primary",
  CONTRACT_CLOSED: "bg-secondary text-muted-foreground",
  FIRST_SESSION: "bg-brand-muted text-primary",
  SESSION_MILESTONE: "bg-brand-muted text-primary",
  BODY_MILESTONE: "bg-secondary text-foreground",
  GOAL_REACHED: "bg-brand-muted text-primary",
};

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[0.6875rem] text-white/70">{label}</p>
      <p className="mt-0.5 text-base font-bold tabular-nums">{value}</p>
    </div>
  );
}

function EventBody({ event }: { event: JourneyEvent }) {
  return (
    <>
      <p className="text-xs text-muted-foreground">
        {formatKstDateLabel(event.at)}
      </p>
      <p className="mt-0.5 flex items-center gap-1 text-sm font-bold">
        {event.title}
        {event.href ? (
          <ChevronRight
            className="size-3.5 text-muted-foreground"
            aria-hidden
          />
        ) : null}
      </p>
      {event.detail ? (
        <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">
          {event.detail}
        </p>
      ) : null}
    </>
  );
}

export default async function MemberJourneyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();

  let journey;
  try {
    journey = await getMemberJourney(user.id, id);
  } catch (error) {
    if (error instanceof TrainerError) notFound();
    throw error;
  }

  const { summary, events, sharedBody } = journey;
  const months = Math.floor(summary.days / 30);

  return (
    <main className="pb-6">
      <PageHeader
        backHref={`/trainer/members/${id}`}
        backLabel={`${summary.memberName} 회원 상세`}
        title={`${summary.memberName} · 여정`}
        subtitle={`${formatKstDateLabel(summary.startedAt)}부터 함께하고 있어요`}
      />

      <div className="px-4 pt-1.5">
      <div className="rounded-3xl bg-primary px-4.5 py-4 text-white">
        <div className="grid grid-cols-3 gap-3">
          <Stat
            label="함께한 기간"
            value={months >= 1 ? `${months}개월` : `${summary.days}일`}
          />
          <Stat label="수업" value={`${summary.completedSessions}회`} />
          <Stat
            label="재등록"
            value={summary.renewals > 0 ? `${summary.renewals}번` : "-"}
          />
        </div>

        {summary.weight ? (
          <div className="mt-3.5 border-t border-white/15 pt-3">
            <p className="text-[0.6875rem] text-white/70">체중 변화</p>
            <p className="mt-0.5 text-base font-bold tabular-nums">
              {summary.weight.first}kg → {summary.weight.latest}kg
              <span className="ml-2 text-sm font-bold text-brand">
                {summary.weight.delta > 0 ? "+" : ""}
                {summary.weight.delta}kg
              </span>
            </p>
          </div>
        ) : null}

        {/*
          안 온 수업은 상담에서 꺼내기 조심스럽지만 트레이너가 모르고 있으면 더
          곤란하다. 큰 숫자 옆이 아니라 요약 아래쪽에 조용히 둔다.
        */}
        {summary.noShowSessions > 0 ||
        summary.cancelledSessions > 0 ||
        summary.scheduledSessions > 0 ? (
          <p className="mt-3 border-t border-white/15 pt-3 text-xs text-white/75 tabular-nums">
            노쇼 {summary.noShowSessions}회 · 취소 {summary.cancelledSessions}회
            · 남은 예약 {summary.scheduledSessions}건
          </p>
        ) : null}
      </div>

      {!sharedBody ? (
        <p className="mt-3 text-xs text-muted-foreground">
          회원이 체성분을 공유하지 않아 몸의 변화는 빠져 있어요.
        </p>
      ) : null}

      <h2 className="mx-1 mt-5 text-base font-extrabold">
        마디
        <span className="ml-1.5 text-sm font-medium text-muted-foreground tabular-nums">
          {events.length}
        </span>
      </h2>

      <ol className="mt-3">
        {events.map((event, index) => {
          const Icon = ICON[event.kind];
          const last = index === events.length - 1;
          const contentClass = last ? "min-w-0 flex-1" : "min-w-0 flex-1 pb-5";

          return (
            <li key={event.id} className="flex gap-3">
              <div className="flex flex-col items-center">
                <span
                  className={`flex size-8 shrink-0 items-center justify-center rounded-full ${TONE[event.kind]}`}
                >
                  <Icon className="size-4" aria-hidden />
                </span>
                {!last ? <span className="w-0 flex-1 border-l-2 border-dashed border-[#dfe4e1]" /> : null}
              </div>

              {event.href ? (
                <Link href={event.href} className={contentClass}>
                  <EventBody event={event} />
                </Link>
              ) : (
                <div className={contentClass}>
                  <EventBody event={event} />
                </div>
              )}
            </li>
          );
        })}
      </ol>
      </div>
    </main>
  );
}
