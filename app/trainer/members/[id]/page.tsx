import Link from "next/link";
import { notFound } from "next/navigation";

import {
  AlertCircle,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  Lock,
  MessageSquare,
  PenLine,
  Plus,
  UtensilsCrossed,
} from "lucide-react";

import { requireUser } from "@/app/lib/dal";
import { formatKstDateLabel } from "@/lib/date";
import { getMemberBody } from "@/server/body/body-trainer.service";
import { listMemberDiet } from "@/server/diet/diet-trainer.service";
import { MEAL_LABEL } from "@/server/diet/diet.service";
import {
  getMemberPersonalWorkouts,
  getSharingForTrainer,
} from "@/server/sharing/sharing.service";
import { CONTRACT_STATUS_LABEL, listContracts } from "@/server/pt/pt.service";
import {
  getMemberDetail,
  getTrainerHome,
  TrainerError,
} from "@/server/trainers/trainer.service";

import { beginJournal } from "../../journals/actions";

type ManagementStatus = "normal" | "attention" | "urgent";

export async function generateMetadata({
  params,
}: PageProps<"/trainer/members/[id]">) {
  const user = await requireUser();
  const { id } = await params;

  try {
    const member = await getMemberDetail(user.id, id);

    return {
      title: `${member.name} | FitNote`,
    };
  } catch {
    return {
      title: "회원 | FitNote",
    };
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

function managementStatusLabel(status: ManagementStatus) {
  switch (status) {
    case "urgent":
      return "즉시 확인";
    case "attention":
      return "확인 필요";
    default:
      return "정상";
  }
}

function managementStatusDescription(status: ManagementStatus) {
  switch (status) {
    case "urgent":
      return "빠르게 확인할 관리 업무가 있어요.";
    case "attention":
      return "트레이너가 확인하거나 처리할 일이 있어요.";
    default:
      return "현재 먼저 확인할 관리 업무가 없어요.";
  }
}

function managementStatusClassName(status: ManagementStatus) {
  switch (status) {
    case "urgent":
      return {
        container: "border-destructive/20 bg-destructive/5",
        icon: "bg-destructive/10 text-destructive",
        label: "text-destructive",
        dot: "bg-destructive",
      };

    case "attention":
      return {
        container: "border-brand/20 bg-accent/60",
        icon: "bg-brand/10 text-brand-strong",
        label: "text-brand-strong",
        dot: "bg-brand",
      };

    default:
      return {
        container: "border-border bg-card",
        icon: "bg-secondary text-muted-foreground",
        label: "text-foreground",
        dot: "bg-muted-foreground",
      };
  }
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
    // 담당이 아닌 회원은 "권한 없음"이 아니라 없는 것으로 다룬다.
    // 권한 없음이라고 알려주면 그 아이디의 회원이 있다는 사실 자체가 새어 나간다.
    if (error instanceof TrainerError) {
      notFound();
    }

    throw error;
  }

  /*
    회원 목록에서 사용하는 관리 상태를 그대로 재사용한다.

    관리 상태를 상세 페이지에서 다시 계산하지 않는 이유:
    - 회원 목록과 상세의 상태가 달라지는 문제 방지
    - 관리 이벤트 계산 로직 중복 방지
    - "회원 관리 상태"를 하나의 도메인 기준으로 유지
  */
  const trainerHome = await getTrainerHome(user.id);

  const memberSummary = trainerHome.members.find(
    (item) => item.connectionId === member.connectionId,
  );

  const managementStatus: ManagementStatus =
    memberSummary?.managementStatus ?? "normal";

  const managementEvents = memberSummary?.managementEvents ?? [];

  const managementStyles =
    managementStatusClassName(managementStatus);

  /*
    공유 설정을 먼저 읽고, 켜진 것만 가져온다.

    꺼져 있으면 조회 자체를 하지 않으므로
    "안 보여주는데 읽기는 했다"는 상황을 막는다.
  */
  const sharing = await getSharingForTrainer(user.id, id);

  const [contracts, personalWorkouts, recentDiet, body] =
    await Promise.all([
      listContracts(user.id, id),

      sharing.sharePersonalWorkout
        ? getMemberPersonalWorkouts(user.id, id, 5)
        : [],

      sharing.shareDiet
        ? listMemberDiet(user.id, id, 3).then(({ days }) =>
            days.flatMap((day) => day.records),
          )
        : [],

      sharing.shareBody ? getMemberBody(user.id, id, 30) : null,
    ]);

  const activeContract = contracts.find(
    (contract) => contract.status === "ACTIVE" && !contract.expired,
  );

  const awaitingReplyJournals = member.journals.filter(
    (journal) => journal.awaitingReply,
  );

  const awaitingReplyCount = awaitingReplyJournals.length;

  const firstAwaitingReplyJournal = awaitingReplyJournals[0];

  const nextSession = member.upcomingSessions[0];

  return (
    <main className="px-5 pt-5 pb-16">
      {/* 회원 헤더 */}
      <header>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl font-bold">{member.name}</h1>

            <p className="mt-1 text-sm text-muted-foreground">
              {formatKstDateLabel(member.startedAt)} 담당 시작
            </p>
          </div>

          <Link
            href={`/trainer/members/${id}/journey`}
            className="flex shrink-0 items-center gap-1 rounded-full border border-border bg-card px-3 py-2 text-xs font-bold"
          >
            여정
            <ChevronRight className="size-3.5" aria-hidden />
          </Link>
        </div>

        {member.pending ? (
          <p className="mt-3 rounded-2xl border border-border bg-secondary px-4 py-3 text-xs text-muted-foreground">
            <b className="font-bold text-foreground">
              아직 가입하지 않은 회원
            </b>
            이에요. 계약·수업·알림장은 지금부터 그대로 쌓이지만, 회원이
            가입해서 이 계정을 이어받기 전까지는 회원 쪽에 보이지 않아요.
          </p>
        ) : null}
      </header>

      {/* 지금 관리할 것 */}
      <section
        className={`mt-5 rounded-2xl border p-4 ${managementStyles.container}`}
      >
        <div className="flex items-start gap-3">
          <span
            className={`flex size-9 shrink-0 items-center justify-center rounded-xl ${managementStyles.icon}`}
          >
            {managementStatus === "normal" ? (
              <CheckCircle2 className="size-4.5" aria-hidden />
            ) : (
              <AlertCircle className="size-4.5" aria-hidden />
            )}
          </span>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p
                className={`text-sm font-bold ${managementStyles.label}`}
              >
                {managementStatus === "normal"
                  ? "현재 관리할 내용"
                  : "지금 관리할 것"}
              </p>

              {managementEvents.length > 0 ? (
                <span className="text-xs text-muted-foreground tabular-nums">
                  {managementEvents.length}건
                </span>
              ) : null}
            </div>

            <p className="mt-0.5 text-xs text-muted-foreground">
              {managementStatusDescription(managementStatus)}
            </p>
          </div>

          <span
            className={`shrink-0 rounded-full px-2 py-1 text-[0.6875rem] font-bold ${
              managementStatus === "urgent"
                ? "bg-destructive/10 text-destructive"
                : managementStatus === "attention"
                  ? "bg-brand/10 text-brand-strong"
                  : "bg-secondary text-muted-foreground"
            }`}
          >
            {managementStatusLabel(managementStatus)}
          </span>
        </div>

        {managementEvents.length > 0 ? (
          <ul className="mt-3 flex flex-col gap-1.5">
            {managementEvents.slice(0, 3).map((event) => (
              <li key={`${event.type}-${event.reason}-${event.href}`}>
                <Link
                  href={event.href}
                  className="flex items-center justify-between gap-3 rounded-xl bg-background/70 px-3 py-2.5 transition hover:bg-background"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span
                      className={`size-1.5 shrink-0 rounded-full ${
                        event.status === "urgent"
                          ? "bg-destructive"
                          : "bg-brand"
                      }`}
                    />

                    <span className="truncate text-xs font-semibold">
                      {event.reason}
                    </span>
                  </span>

                  <ChevronRight
                    className="size-3.5 shrink-0 text-muted-foreground"
                    aria-hidden
                  />
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <div className="mt-3 rounded-xl bg-background/60 px-3 py-3">
            <p className="text-xs text-muted-foreground">
              지금 먼저 처리할 관리 업무가 없어요.
            </p>
          </div>
        )}
      </section>

      {/* 다음 수업 */}
      {nextSession ? (
        <section className="mt-6">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-base font-bold">다음 수업</h2>

            <Link
              href="/trainer/schedule"
              className="text-xs font-semibold text-brand-strong"
            >
              일정 보기
            </Link>
          </div>

          <div className="mt-2 rounded-2xl border border-border bg-card p-4">
            <div className="flex items-center gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-muted-foreground">
                <CalendarClock className="size-4.5" aria-hidden />
              </span>

              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold">
                  {formatKstDateLabel(nextSession.scheduledAt)}{" "}
                  {formatTime(nextSession.scheduledAt)}
                </p>

                <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">
                  {nextSession.sessionNumber}회차
                </p>
              </div>
            </div>

            <div className="mt-3">
              {nextSession.journalId ? (
                <Link
                  href={`/trainer/journals/${nextSession.journalId}`}
                  className="flex h-10 items-center justify-center rounded-xl bg-secondary text-xs font-bold"
                >
                  알림장 보기
                </Link>
              ) : (
                <form action={beginJournal}>
                  <input
                    type="hidden"
                    name="memberMembershipId"
                    value={member.connectionId}
                  />

                  <input
                    type="hidden"
                    name="ptSessionId"
                    value={nextSession.id}
                  />

                  <button
                    type="submit"
                    className="flex h-10 w-full items-center justify-center rounded-xl bg-brand text-xs font-bold text-primary"
                  >
                    알림장 쓰기
                  </button>
                </form>
              )}
            </div>
          </div>
        </section>
      ) : null}

      {/* PT 계약 */}
      <section className="mt-7">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-base font-bold">PT 계약</h2>

          <div className="flex items-center gap-3">
            <Link
              href={`/trainer/members/${id}/contracts`}
              className="text-xs font-semibold text-muted-foreground"
            >
              전체 보기
            </Link>

            <Link
              href={`/trainer/members/${id}/contracts/new`}
              className="inline-flex h-8 items-center gap-1 rounded-full border border-border px-3 text-xs font-bold"
            >
              <Plus className="size-3.5" aria-hidden />
              등록
            </Link>
          </div>
        </div>

        {contracts.length === 0 ? (
          <p className="mt-2 rounded-2xl border border-border bg-card p-4 text-xs text-muted-foreground">
            아직 등록한 PT 계약이 없어요. 횟수와 기간만 넣으면 돼요.
          </p>
        ) : (
          <ul className="mt-2 flex flex-col gap-2.5">
            {contracts.map((contract) => {
              const ratio =
                contract.totalSessions === 0
                  ? 0
                  : (contract.usedSessions /
                      contract.totalSessions) *
                    100;

              return (
                <li key={contract.id}>
                  <Link
                    href={`/trainer/members/${id}/contracts/${contract.id}`}
                    className="block rounded-2xl border border-border bg-card p-4"
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="truncate font-bold">
                        {contract.title}
                      </p>

                      <p className="shrink-0 text-sm font-bold text-brand-strong tabular-nums">
                        {contract.remaining}회 남음
                      </p>
                    </div>

                    <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-secondary">
                      <div
                        className="h-full rounded-full bg-brand"
                        style={{
                          width: `${Math.min(
                            100,
                            Math.max(0, ratio),
                          )}%`,
                        }}
                      />
                    </div>

                    <p className="mt-2 text-xs text-muted-foreground tabular-nums">
                      {contract.usedSessions} /{" "}
                      {contract.totalSessions}회
                      {contract.scheduledCount > 0
                        ? ` · 예정 ${contract.scheduledCount}건`
                        : ""}
                      {contract.expiresAt
                        ? ` · ${formatKstDateLabel(
                            contract.expiresAt,
                          )}까지`
                        : ""}
                    </p>

                    {contract.expired ? (
                      <p className="mt-1.5 text-xs font-bold text-destructive">
                        기간이 지났어요. 연장하거나 마무리해주세요.
                      </p>
                    ) : contract.status !== "ACTIVE" ? (
                      <p className="mt-1.5 text-xs font-medium text-muted-foreground">
                        {CONTRACT_STATUS_LABEL[contract.status]}
                      </p>
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* 알림장 */}
      <section className="mt-7">
        <div className="flex items-baseline justify-between">
          <div>
            <h2 className="text-base font-bold">알림장</h2>

            {awaitingReplyCount > 0 ? (
              <p className="mt-0.5 text-xs text-brand-strong">
                답변 대기 {awaitingReplyCount}건
              </p>
            ) : null}
          </div>

          <form action={beginJournal}>
            <input
              type="hidden"
              name="memberMembershipId"
              value={member.connectionId}
            />

            <button
              type="submit"
              className="flex items-center gap-1 text-sm font-semibold text-brand-strong"
            >
              <PenLine className="size-3.5" aria-hidden />
              새로 쓰기
            </button>
          </form>
        </div>

        {member.journals.length === 0 ? (
          <p className="mt-2 rounded-2xl border border-border bg-card p-4 text-xs text-muted-foreground">
            아직 쓴 알림장이 없어요.
          </p>
        ) : (
          <>
            {firstAwaitingReplyJournal ? (
              <Link
                href={`/trainer/journals/${firstAwaitingReplyJournal.id}`}
                className="mt-2 flex items-center justify-between gap-3 rounded-2xl border border-brand/20 bg-accent/60 p-4"
              >
                <span className="flex min-w-0 items-center gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand-strong">
                    <MessageSquare
                      className="size-4"
                      aria-hidden
                    />
                  </span>

                  <span className="min-w-0">
                    <span className="block text-xs font-bold text-brand-strong">
                      답변을 확인해주세요
                    </span>

                    <span className="mt-0.5 block truncate text-sm font-bold">
                      {firstAwaitingReplyJournal.title ??
                        formatKstDateLabel(
                          firstAwaitingReplyJournal.date,
                        )}
                    </span>
                  </span>
                </span>

                <ChevronRight
                  className="size-4 shrink-0 text-muted-foreground"
                  aria-hidden
                />
              </Link>
            ) : null}

            <ul className="mt-2 flex flex-col gap-2">
              {member.journals.map((journal) => (
                <li key={journal.id}>
                  <Link
                    href={`/trainer/journals/${journal.id}`}
                    className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5">
                        <span className="truncate text-sm font-bold">
                          {journal.title ??
                            formatKstDateLabel(journal.date)}
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
                        <span>
                          {formatKstDateLabel(journal.date)}
                        </span>

                        {journal.commentCount > 0 ? (
                          <span className="flex items-center gap-0.5">
                            <MessageSquare
                              className="size-3"
                              aria-hidden
                            />

                            <span className="tabular-nums">
                              {journal.commentCount}
                            </span>
                          </span>
                        ) : null}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      {/* 다가오는 수업 */}
      <section className="mt-7">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-base font-bold">다가오는 수업</h2>

          <Link
            href="/trainer/schedule"
            className="text-xs font-semibold text-muted-foreground"
          >
            전체 일정
          </Link>
        </div>

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
                  <CalendarClock
                    className="size-4.5"
                    aria-hidden
                  />
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
                    href={`/trainer/journals/${session.journalId}`}
                    className="shrink-0 text-xs font-semibold text-brand-strong"
                  >
                    알림장
                  </Link>
                ) : (
                  <form
                    action={beginJournal}
                    className="shrink-0"
                  >
                    <input
                      type="hidden"
                      name="memberMembershipId"
                      value={member.connectionId}
                    />

                    <input
                      type="hidden"
                      name="ptSessionId"
                      value={session.id}
                    />

                    <button
                      type="submit"
                      className="text-xs font-semibold text-brand-strong"
                    >
                      알림장 쓰기
                    </button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 개인 운동 기록 */}
      <section className="mt-7">
        <div className="flex items-baseline justify-between">
          <h2 className="text-base font-bold">개인 운동 기록</h2>

          {sharing.sharePersonalWorkout ? (
            <span className="text-xs text-muted-foreground">
              회원이 공유 중
            </span>
          ) : null}
        </div>

        {!sharing.sharePersonalWorkout ? (
          <div className="mt-2 rounded-2xl border border-dashed border-border p-4">
            <span className="flex size-8 items-center justify-center rounded-xl bg-secondary text-muted-foreground">
              <Lock className="size-4" aria-hidden />
            </span>

            <p className="mt-2.5 text-sm font-bold">
              회원이 개인 운동 기록을 공유하지 않았어요
            </p>

            <p className="mt-1 text-xs text-muted-foreground">
              회원이 내 정보 &gt; 공유 설정에서 켜면 여기에 나타나요.
              PT 수업에서 직접 적은 기록은 알림장에서 계속 볼 수 있어요.
            </p>
          </div>
        ) : personalWorkouts.length === 0 ? (
          <p className="mt-2 rounded-2xl border border-border bg-card p-4 text-xs text-muted-foreground">
            아직 혼자 한 운동 기록이 없어요.
          </p>
        ) : (
          <ul className="mt-2 flex flex-col gap-2">
            {personalWorkouts.map((session) => (
              <li
                key={session.id}
                className="rounded-2xl border border-border bg-card p-4"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-sm font-bold">
                    {formatKstDateLabel(session.startedAt)}
                  </p>

                  <p className="shrink-0 text-xs text-muted-foreground tabular-nums">
                    {session.totalSets}세트
                  </p>
                </div>

                <p className="mt-1 truncate text-xs text-muted-foreground">
                  {session.exerciseNames.length === 0
                    ? "기록한 운동이 없어요"
                    : session.exerciseNames.join(" · ")}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 체성분 */}
      <section className="mt-7">
        <h2 className="text-base font-bold">체성분</h2>

        {!sharing.shareBody ? (
          <div className="mt-2 rounded-2xl border border-dashed border-border p-4">
            <span className="flex size-8 items-center justify-center rounded-xl bg-secondary text-muted-foreground">
              <Lock className="size-4" aria-hidden />
            </span>

            <p className="mt-2.5 text-sm font-bold">
              회원이 체성분을 공유하지 않았어요
            </p>

            <p className="mt-1 text-xs text-muted-foreground">
              회원이 내 정보 &gt; 공유 설정에서 켜면 여기에 나타나요.
            </p>
          </div>
        ) : !body || body.rows.length === 0 ? (
          <p className="mt-2 rounded-2xl border border-border bg-card p-4 text-xs text-muted-foreground">
            담당을 시작한 뒤로 잰 기록이 없어요.
          </p>
        ) : (
          <ul className="mt-2 grid grid-cols-3 gap-2">
            {body.trends.map((trend) => (
              <li
                key={trend.type}
                className="rounded-2xl border border-border bg-card p-3"
              >
                <p className="text-xs text-muted-foreground">
                  {trend.label}
                </p>

                <p className="mt-1 text-lg font-bold tabular-nums">
                  {trend.latest === null ? "-" : trend.latest}
                  {trend.latest === null ? "" : trend.unit}
                </p>

                <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">
                  {trend.delta === null
                    ? "비교할 값 없음"
                    : trend.delta === 0
                      ? "변화 없음"
                      : `${
                          trend.delta > 0 ? "+" : ""
                        }${trend.delta}${trend.unit}`}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 식단 */}
      <section className="mt-7">
        <div className="flex items-baseline justify-between">
          <h2 className="text-base font-bold">식단</h2>

          {sharing.shareDiet ? (
            <Link
              href={`/trainer/members/${id}/diet`}
              className="text-sm font-semibold text-brand-strong"
            >
              전체 보기
            </Link>
          ) : null}
        </div>

        {!sharing.shareDiet ? (
          <div className="mt-2 rounded-2xl border border-dashed border-border p-4">
            <span className="flex size-8 items-center justify-center rounded-xl bg-secondary text-muted-foreground">
              <Lock className="size-4" aria-hidden />
            </span>

            <p className="mt-2.5 text-sm font-bold">
              회원이 식단을 공유하지 않았어요
            </p>

            <p className="mt-1 text-xs text-muted-foreground">
              회원이 내 정보 &gt; 공유 설정에서 켜면 여기에 나타나요.
            </p>
          </div>
        ) : recentDiet.length === 0 ? (
          <p className="mt-2 rounded-2xl border border-border bg-card p-4 text-xs text-muted-foreground">
            아직 올린 식단이 없어요.
          </p>
        ) : (
          <ul className="mt-2 flex flex-col gap-2">
            {recentDiet.map((record) => (
              <li key={record.id}>
                <Link
                  href={`/trainer/members/${id}/diet/${record.id}`}
                  className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3"
                >
                  {record.thumbnailUrl ? (
                    // 서명 주소는 열 때마다 값이 달라 최적화 캐시가 빗나간다.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={record.thumbnailUrl}
                      alt=""
                      loading="lazy"
                      className="size-14 shrink-0 rounded-xl bg-secondary object-cover"
                    />
                  ) : (
                    <span className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-secondary text-muted-foreground">
                      <UtensilsCrossed
                        className="size-4.5"
                        aria-hidden
                      />
                    </span>
                  )}

                  <span className="min-w-0 flex-1">
                    <span className="text-xs text-muted-foreground">
                      {formatKstDateLabel(record.date)} ·{" "}
                      {MEAL_LABEL[record.mealType]}
                    </span>

                    <span className="mt-0.5 block truncate text-sm font-bold">
                      {record.foodName ??
                        record.memo ??
                        "사진만 올렸어요"}
                    </span>
                  </span>

                  {record.feedbackCount === 0 ? (
                    <span className="shrink-0 rounded-full bg-brand px-2 py-0.5 text-[0.6875rem] font-bold text-primary">
                      피드백 대기
                    </span>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}