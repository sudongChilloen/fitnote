import Link from "next/link";
import { notFound } from "next/navigation";

import {
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  Dumbbell,
  Lock,
  MessageSquare,
  PenLine,
  Plus,
  UtensilsCrossed,
} from "lucide-react";

import { requireUser } from "@/app/lib/dal";
import { formatKstDateLabel, toKstDateKey } from "@/lib/date";
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
  TrainerError,
} from "@/server/trainers/trainer.service";

import { beginJournal } from "../../journals/actions";

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

function getContractRatio(usedSessions: number, totalSessions: number) {
  if (totalSessions <= 0) return 0;

  return Math.min(100, Math.max(0, (usedSessions / totalSessions) * 100));
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
    if (error instanceof TrainerError) {
      notFound();
    }

    throw error;
  }

  /*
   * 공유 설정을 먼저 읽는다.
   *
   * 공유하지 않는 데이터는 아예 조회하지 않는다.
   */
  const sharing = await getSharingForTrainer(user.id, id);

  const [contracts, personalWorkouts, recentDiet, body] = await Promise.all([
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

  /*
   * 현재 사용할 계약.
   *
   * listContracts의 정렬에 의존하지 않고
   * 실제 진행 중 + 아직 만료되지 않은 계약을 우선한다.
   */
  const activeContract =
    contracts.find(
      (contract) => contract.status === "ACTIVE" && !contract.expired,
    ) ??
    contracts.find((contract) => contract.status === "ACTIVE") ??
    null;

  /*
   * 오늘 수업인지 KST 기준으로 판단한다.
   */
  const todayKey = toKstDateKey(new Date());

  const nextSession = member.upcomingSessions[0] ?? null;

  /*
   * 오늘 수업 중에는 가장 가까운 수업 하나를
   * 메인 CTA로 보여준다.
   */
  const todaySession =
    member.upcomingSessions.find(
      (session) => toKstDateKey(session.scheduledAt) === todayKey,
    ) ?? null;

  /*
   * 답변이 필요한 알림장.
   */
  const awaitingReplyJournals = member.journals.filter(
    (journal) => journal.awaitingReply,
  );

  /*
   * 계약이 곧 끝나는지 표시한다.
   */
  const contractNeedsAttention =
    activeContract !== null &&
    (activeContract.remaining <= 3 ||
      (activeContract.expiresAt !== null &&
        activeContract.expiresAt.getTime() >=
          // eslint-disable-next-line react-hooks/purity
          Date.now() &&
        activeContract.expiresAt.getTime() -
          // eslint-disable-next-line react-hooks/purity
          Date.now() <=
          14 * 24 * 60 * 60 * 1000));

  /*
   * 최근 기록은 너무 많이 보여주지 않는다.
   *
   * 상세 데이터는 아래 섹션에 있고,
   * 상단에서는 "최근에 무슨 일이 있었는지"만 빠르게 확인한다.
   */
  const latestWorkout = personalWorkouts[0] ?? null;

  const latestDiet = recentDiet[0] ?? null;

  const latestJournal = member.journals[0] ?? null;

  /*
   * 관리가 필요한 내용.
   *
   * 현재 서비스에 존재하는 실제 데이터만 사용한다.
   */
  const managementItems: {
    key: string;
    label: string;
    href?: string;
  }[] = [];

  if (awaitingReplyJournals.length > 0) {
    const journal = awaitingReplyJournals[0];

    managementItems.push({
      key: `reply-${journal.id}`,
      label: `알림장 답변 ${awaitingReplyJournals.length}건`,
      href: `/trainer/journals/${journal.id}`,
    });
  }

  if (contractNeedsAttention) {
    managementItems.push({
      key: `contract-${activeContract?.id}`,
      label:
        activeContract && activeContract.remaining <= 3
          ? `PT ${activeContract.remaining}회 남음`
          : "PT 계약이 곧 만료돼요",
      href: activeContract
        ? `/trainer/members/${id}/contracts/${activeContract.id}`
        : undefined,
    });
  }

  return (
    <main className="px-5 pt-4 pb-20">
      {/* =========================================================
          HEADER
      ========================================================= */}
      <header>
        <Link
          href="/trainer/members"
          className="inline-flex items-center gap-1.5 rounded-full text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronLeft className="size-4" aria-hidden />
          회원 목록
        </Link>

        <div className="mt-5 overflow-hidden rounded-3xl border border-border/60 bg-card shadow-card">
          <div className="p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11px] font-bold tracking-[0.16em] text-brand-strong">
                  MEMBER PROFILE
                </p>
                <h1 className="mt-2 break-words text-2xl font-bold tracking-tight">
                  {member.name}
                </h1>
                <p className="mt-1.5 text-xs text-muted-foreground">
                  {formatKstDateLabel(member.startedAt)} 담당 시작
                </p>
              </div>

              <Link
                href={`/trainer/members/${id}/journey`}
                className="inline-flex shrink-0 items-center gap-1 rounded-full border border-border/70 px-3 py-2 text-xs font-semibold transition-colors hover:bg-secondary"
              >
                변화 보기
                <ChevronRight className="size-3.5" aria-hidden />
              </Link>
            </div>
          </div>

          {activeContract ? (
            <div className="border-t border-border/60 bg-secondary/30 p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-muted-foreground">
                    진행 중인 PT 계약
                  </p>
                  <p className="mt-1.5 break-words text-sm font-bold">
                    {activeContract.title}
                  </p>
                </div>

                <div className="shrink-0 text-right">
                  <p className="text-2xl font-bold tracking-tight text-brand-strong tabular-nums">
                    {activeContract.remaining}
                    <span className="ml-1 text-xs font-semibold">회</span>
                  </p>
                  <p className="text-[11px] text-muted-foreground">남은 횟수</p>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between gap-3 text-xs">
                <span className="font-semibold tabular-nums">
                  {activeContract.usedSessions} / {activeContract.totalSessions}
                  회 사용
                </span>
                <span className="text-muted-foreground">
                  {Math.round(
                    getContractRatio(
                      activeContract.usedSessions,
                      activeContract.totalSessions,
                    ),
                  )}
                  % 진행
                </span>
              </div>

              <div
                className="mt-2 h-2 overflow-hidden rounded-full bg-secondary"
                role="progressbar"
                aria-label="PT 계약 진행률"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(
                  getContractRatio(
                    activeContract.usedSessions,
                    activeContract.totalSessions,
                  ),
                )}
              >
                <div
                  className="h-full rounded-full bg-brand transition-[width]"
                  style={{
                    width: `${getContractRatio(
                      activeContract.usedSessions,
                      activeContract.totalSessions,
                    )}%`,
                  }}
                />
              </div>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                <span>
                  {activeContract.expiresAt
                    ? `${formatKstDateLabel(activeContract.expiresAt)}까지`
                    : "기간 제한 없음"}
                </span>
                {contractNeedsAttention ? (
                  <span className="font-semibold text-brand-strong">
                    계약 확인 필요
                  </span>
                ) : null}
              </div>

              <Link
                href={`/trainer/members/${id}/contracts/${activeContract.id}`}
                className="mt-4 flex h-10 items-center justify-center gap-1.5 rounded-xl border border-border/70 bg-card text-sm font-semibold transition-colors hover:bg-secondary"
              >
                계약 상세 보기
                <ChevronRight className="size-4" aria-hidden />
              </Link>
            </div>
          ) : (
            <div className="border-t border-border/60 p-4">
              <div className="flex items-center justify-between gap-3 rounded-2xl bg-secondary/70 p-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold">
                    진행 중인 PT 계약이 없어요
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    새 계약을 등록해 수업 횟수를 관리하세요.
                  </p>
                </div>

                <Link
                  href={`/trainer/members/${id}/contracts/new`}
                  className="inline-flex h-9 shrink-0 items-center justify-center rounded-xl bg-primary px-3 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90"
                >
                  계약 등록
                </Link>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* =========================================================
          PENDING MEMBER NOTICE
      ========================================================= */}
      {member.pending ? (
        <section className="mt-4 rounded-2xl border border-border bg-secondary px-4 py-3">
          <p className="text-xs leading-5 text-muted-foreground">
            <b className="font-bold text-foreground">아직 가입하지 않은 회원</b>
            이에요. 계약·수업·알림장은 지금부터 그대로 쌓이지만, 회원이 가입해서
            이 계정을 이어받기 전까지는 회원 쪽에 보이지 않아요.
          </p>
        </section>
      ) : null}

      {/* =========================================================
          MAIN CTA — TODAY SESSION
      ========================================================= */}
      {todaySession ? (
        <Link
          href={`/trainer/sessions/${todaySession.id}`}
          className="mt-5 block overflow-hidden rounded-3xl bg-brand p-5 text-primary shadow-card transition-transform active:scale-[0.99]"
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-primary/15 px-2.5 py-1 text-[11px] font-bold">
                  TODAY
                </span>
                <span className="text-xs font-semibold opacity-80">
                  오늘 예정된 수업
                </span>
              </div>

              <p className="mt-3 text-2xl font-bold tracking-tight tabular-nums">
                {formatTime(todaySession.scheduledAt)}
              </p>

              <p className="mt-1 text-sm font-semibold opacity-90">
                {todaySession.sessionNumber}회차 수업
              </p>
            </div>

            <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary/15">
              <ChevronRight className="size-6" aria-hidden />
            </span>
          </div>

          <div className="mt-5 flex items-center justify-between gap-3 border-t border-primary/15 pt-3">
            <p className="text-xs font-medium opacity-85">
              수업 상세에서 기록을 확인하세요.
            </p>
            <span className="text-xs font-bold">수업 열기 ↗</span>
          </div>
        </Link>
      ) : nextSession ? (
        <Link
          href={`/trainer/sessions/${nextSession.id}`}
          className="mt-5 flex items-center gap-3 rounded-3xl border border-border/60 bg-card p-4 shadow-card transition-colors hover:bg-secondary"
        >
          <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-secondary text-muted-foreground">
            <CalendarClock className="size-5" aria-hidden />
          </span>

          <span className="min-w-0 flex-1">
            <span className="block text-xs font-semibold text-muted-foreground">
              다음 수업
            </span>
            <span className="mt-1 block text-base font-bold tabular-nums">
              {formatKstDateLabel(nextSession.scheduledAt)}
            </span>
            <span className="mt-1 block text-xs text-muted-foreground">
              {formatTime(nextSession.scheduledAt)} ·{" "}
              {nextSession.sessionNumber}회차
            </span>
          </span>

          <ChevronRight
            className="size-5 shrink-0 text-muted-foreground"
            aria-hidden
          />
        </Link>
      ) : (
        <div className="mt-5 flex items-center gap-3 rounded-3xl border border-dashed border-border bg-card p-4">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-secondary text-muted-foreground">
            <CalendarClock className="size-5" aria-hidden />
          </span>
          <div>
            <p className="text-sm font-bold">예정된 수업이 없어요</p>
            <p className="mt-1 text-xs text-muted-foreground">
              PT 계약과 수업 일정을 확인해 주세요.
            </p>
          </div>
        </div>
      )}
      {/* =========================================================
          MANAGEMENT / TODO
      ========================================================= */}
      {managementItems.length > 0 ? (
        <section className="mt-5 overflow-hidden rounded-3xl border border-border/60 bg-card shadow-card">
          <div className="flex items-center justify-between px-4 pb-3 pt-4">
            <div>
              <p className="text-base font-bold tracking-tight">
                지금 확인할 것
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                확인이 필요한 항목을 처리해 주세요.
              </p>
            </div>

            <span className="flex size-8 items-center justify-center rounded-full bg-secondary text-sm font-bold tabular-nums">
              {managementItems.length}
            </span>
          </div>

          <ul className="divide-y divide-border/70">
            {managementItems.map((item) => {
              const isReply = item.key.startsWith("reply-");
              const content = (
                <>
                  <span
                    className={`flex size-10 shrink-0 items-center justify-center rounded-2xl ${
                      isReply
                        ? "bg-secondary text-foreground"
                        : "bg-brand/15 text-brand-strong"
                    }`}
                  >
                    {isReply ? (
                      <MessageSquare className="size-4.5" aria-hidden />
                    ) : (
                      <CalendarClock className="size-4.5" aria-hidden />
                    )}
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-bold">
                      {item.label}
                    </span>
                    <span className="mt-1 block text-xs text-muted-foreground">
                      {isReply
                        ? "회원 알림장을 확인하고 답변을 남겨주세요."
                        : "계약 상세에서 남은 횟수와 만료일을 확인하세요."}
                    </span>
                  </span>

                  <ChevronRight
                    className="size-4 shrink-0 text-muted-foreground"
                    aria-hidden
                  />
                </>
              );

              return (
                <li key={item.key}>
                  {item.href ? (
                    <Link
                      href={item.href}
                      className="flex items-center gap-3 px-4 py-4 transition-colors hover:bg-secondary/60"
                    >
                      {content}
                    </Link>
                  ) : (
                    <div className="flex items-center gap-3 px-4 py-4">
                      {content}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
      {/* =========================================================
          STICKY ANCHOR NAV
      ========================================================= */}
      <nav className="sticky top-0 z-20 -mx-5 mt-6 overflow-x-auto border-y border-border bg-background/95 px-5 py-2 backdrop-blur">
        <div className="flex min-w-max gap-1">
          {[
            ["summary", "요약"],
            ["workout", "운동"],
            ["diet", "식단"],
            ["body", "변화"],
            ["journals", "알림장"],
          ].map(([href, label]) => (
            <a
              key={href}
              href={`#${href}`}
              className="rounded-lg px-3 py-2 text-xs font-semibold text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              {label}
            </a>
          ))}
        </div>
      </nav>
      {/* =========================================================
          SUMMARY
      ========================================================= */}
      <section id="summary" className="scroll-mt-20">
        <div className="mt-7">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-xs font-semibold tracking-wide text-brand-strong">
                MEMBER OVERVIEW
              </p>
              <h2 className="mt-1 text-xl font-bold tracking-tight">
                회원 요약
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                최근 기록과 몸의 변화를 한눈에 확인해요.
              </p>
            </div>
            <Link
              href={`/trainer/members/${id}/journey`}
              className="inline-flex shrink-0 items-center gap-1 rounded-full border border-border/70 px-3 py-2 text-xs font-semibold transition-colors hover:bg-secondary"
            >
              변화 보기
              <ChevronRight className="size-3.5" aria-hidden />
            </Link>
          </div>

          {/* 현재 상태 */}
          {sharing.shareBody && body && body.rows.length > 0 ? (
            <div className="mt-4 grid grid-cols-3 gap-2">
              {body.trends.slice(0, 3).map((trend) => (
                <div
                  key={trend.type}
                  className="min-w-0 rounded-2xl border border-border/50 bg-card p-3 shadow-card"
                >
                  <p className="truncate text-xs font-medium text-muted-foreground">
                    {trend.label}
                  </p>
                  <p className="mt-2 truncate text-lg font-bold tracking-tight tabular-nums">
                    {trend.latest === null ? "-" : trend.latest}
                    {trend.latest === null ? "" : trend.unit}
                  </p>
                  <p className="mt-1 truncate text-[11px] text-muted-foreground tabular-nums">
                    {trend.delta === null
                      ? "비교 기록 없음"
                      : trend.delta === 0
                        ? "변화 없음"
                        : `이전 대비 ${trend.delta > 0 ? "+" : ""}${trend.delta}${trend.unit}`}
                  </p>
                </div>
              ))}
            </div>
          ) : null}

          {/* 최근 활동 */}
          <div className="mt-6">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold">최근 활동</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  최근 등록된 운동, 식단, 알림장 기록이에요.
                </p>
              </div>
            </div>

            <div className="overflow-hidden rounded-3xl border border-border/60 bg-card shadow-card">
              {latestWorkout ? (
                <Link
                  href="#workout"
                  className="flex items-center gap-3 border-b border-border/60 px-4 py-4 transition-colors hover:bg-secondary/50"
                >
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-brand/15 text-lg">
                    🏋️
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-bold">개인 운동</span>
                    <span className="mt-1 block truncate text-xs text-muted-foreground">
                      {formatKstDateLabel(latestWorkout.startedAt)}
                      {" · "}
                      {latestWorkout.totalSets}세트
                    </span>
                  </span>
                  <ChevronRight
                    className="size-4 shrink-0 text-muted-foreground"
                    aria-hidden
                  />
                </Link>
              ) : null}

              {latestDiet ? (
                <Link
                  href="#diet"
                  className="flex items-center gap-3 border-b border-border/60 px-4 py-4 transition-colors hover:bg-secondary/50"
                >
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-orange-100 text-lg">
                    🍽️
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-bold">식단 기록</span>
                    <span className="mt-1 block truncate text-xs text-muted-foreground">
                      {formatKstDateLabel(latestDiet.date)}
                      {" · "}
                      {MEAL_LABEL[latestDiet.mealType]}
                    </span>
                  </span>
                  <ChevronRight
                    className="size-4 shrink-0 text-muted-foreground"
                    aria-hidden
                  />
                </Link>
              ) : null}

              {latestJournal ? (
                <Link
                  href={`/trainer/journals/${latestJournal.id}`}
                  className="flex items-center gap-3 px-4 py-4 transition-colors hover:bg-secondary/50"
                >
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-sky-100 text-lg">
                    📝
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-bold">알림장</span>
                    <span className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span>{formatKstDateLabel(latestJournal.date)}</span>
                      {latestJournal.awaitingReply ? (
                        <span className="rounded-full bg-brand/15 px-2 py-0.5 font-semibold text-brand-strong">
                          답장 대기
                        </span>
                      ) : null}
                    </span>
                  </span>
                  <ChevronRight
                    className="size-4 shrink-0 text-muted-foreground"
                    aria-hidden
                  />
                </Link>
              ) : null}

              {!latestWorkout && !latestDiet && !latestJournal ? (
                <div className="px-4 py-7 text-center">
                  <span className="mx-auto flex size-11 items-center justify-center rounded-2xl bg-secondary">
                    <CalendarClock
                      className="size-5 text-muted-foreground"
                      aria-hidden
                    />
                  </span>
                  <p className="mt-3 text-sm font-semibold">
                    아직 최근 활동이 없어요
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    운동이나 식단, 알림장 기록이 등록되면 여기에 표시돼요.
                  </p>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </section>
      {/* =========================================================
          WORKOUT
      ========================================================= */}
      <section id="workout" className="mt-9 scroll-mt-20">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold tracking-wide text-brand-strong">
              TRAINING LOG
            </p>
            <h2 className="mt-1 text-xl font-bold tracking-tight">개인 운동</h2>
            {sharing.sharePersonalWorkout ? (
              <p className="mt-1 text-xs text-muted-foreground">
                회원이 공유한 최근 운동 기록
              </p>
            ) : null}
          </div>
          {sharing.sharePersonalWorkout && personalWorkouts.length > 0 ? (
            <span className="shrink-0 rounded-full bg-secondary px-3 py-1.5 text-xs font-semibold tabular-nums">
              최근 {personalWorkouts.length}건
            </span>
          ) : null}
        </div>

        {!sharing.sharePersonalWorkout ? (
          <div className="mt-4 rounded-3xl border border-dashed border-border bg-card p-5">
            <span className="flex size-11 items-center justify-center rounded-2xl bg-secondary text-muted-foreground">
              <Lock className="size-5" aria-hidden />
            </span>
            <p className="mt-3 text-sm font-bold">
              개인 운동 기록을 공유하지 않았어요
            </p>
            <p className="mt-1.5 text-xs leading-5 text-muted-foreground">
              회원이 내 정보의 공유 설정에서 공유를 켜면 이곳에서 확인할 수
              있어요. PT 수업에서 작성한 기록은 별도로 유지돼요.
            </p>
          </div>
        ) : personalWorkouts.length === 0 ? (
          <div className="mt-4 rounded-3xl border border-border/60 bg-card px-4 py-7 text-center shadow-card">
            <span className="mx-auto flex size-11 items-center justify-center rounded-2xl bg-secondary text-muted-foreground">
              <Dumbbell className="size-5" aria-hidden />
            </span>
            <p className="mt-3 text-sm font-bold">
              아직 개인 운동 기록이 없어요
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              회원이 운동을 기록하고 공유하면 여기에 표시돼요.
            </p>
          </div>
        ) : (
          <ul className="mt-4 flex flex-col gap-3">
            {personalWorkouts.map((session) => (
              <li key={session.id}>
                <div className="rounded-3xl border border-border/60 bg-card p-4 shadow-card">
                  <div className="flex items-start gap-3">
                    <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-brand/15 text-brand-strong">
                      <Dumbbell className="size-5" aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-bold">
                            {formatKstDateLabel(session.startedAt)}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            개인 운동 기록
                          </p>
                        </div>
                        <span className="shrink-0 rounded-full bg-secondary px-2.5 py-1 text-xs font-bold tabular-nums">
                          {session.totalSets}세트
                        </span>
                      </div>

                      <div className="mt-3 rounded-2xl bg-secondary/60 px-3 py-2.5">
                        <p className="text-xs leading-5 text-foreground">
                          {session.exerciseNames.length === 0
                            ? "기록한 운동이 없어요"
                            : session.exerciseNames.join(" · ")}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* =========================================================
          DIET
      ========================================================= */}
      <section id="diet" className="mt-9 scroll-mt-20">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold tracking-wide text-brand-strong">
              NUTRITION LOG
            </p>
            <h2 className="mt-1 text-xl font-bold tracking-tight">식단 기록</h2>
            {sharing.shareDiet ? (
              <p className="mt-1 text-xs text-muted-foreground">
                회원이 공유한 식사와 피드백을 확인해요.
              </p>
            ) : null}
          </div>

          {sharing.shareDiet && recentDiet.length > 0 ? (
            <Link
              href={`/trainer/members/${id}/diet`}
              className="inline-flex shrink-0 items-center gap-1 rounded-full border border-border/70 px-3 py-2 text-xs font-semibold transition-colors hover:bg-secondary"
            >
              전체 보기
              <ChevronRight className="size-3.5" aria-hidden />
            </Link>
          ) : null}
        </div>

        {!sharing.shareDiet ? (
          <div className="mt-4 rounded-3xl border border-dashed border-border bg-card p-5">
            <span className="flex size-11 items-center justify-center rounded-2xl bg-secondary text-muted-foreground">
              <Lock className="size-5" aria-hidden />
            </span>
            <p className="mt-3 text-sm font-bold">
              아직 식단을 공유하지 않았어요
            </p>
            <p className="mt-1.5 text-xs leading-5 text-muted-foreground">
              회원이 내 정보의 공유 설정에서 식단 공유를 켜면 이곳에서 확인할 수
              있어요.
            </p>
          </div>
        ) : recentDiet.length === 0 ? (
          <div className="mt-4 rounded-3xl border border-border/60 bg-card px-4 py-7 text-center shadow-card">
            <span className="mx-auto flex size-11 items-center justify-center rounded-2xl bg-orange-100 text-orange-700">
              <UtensilsCrossed className="size-5" aria-hidden />
            </span>
            <p className="mt-3 text-sm font-bold">아직 등록된 식단이 없어요</p>
            <p className="mt-1 text-xs text-muted-foreground">
              회원이 식단을 기록하면 여기에 표시돼요.
            </p>
          </div>
        ) : (
          <ul className="mt-4 flex flex-col gap-3">
            {recentDiet.map((record) => (
              <li key={record.id}>
                <Link
                  href={`/trainer/members/${id}/diet/${record.id}`}
                  className="group flex items-center gap-3 rounded-3xl border border-border/60 bg-card p-3.5 shadow-card transition-colors hover:bg-secondary/40"
                >
                  {record.thumbnailUrl ? (
                    // 서명 URL은 열 때마다 달라질 수 있어 일반 img를 사용한다.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={record.thumbnailUrl}
                      alt=""
                      loading="lazy"
                      className="size-[76px] shrink-0 rounded-2xl bg-secondary object-cover"
                    />
                  ) : (
                    <span className="flex size-[76px] shrink-0 items-center justify-center rounded-2xl bg-orange-100 text-orange-700">
                      <UtensilsCrossed className="size-6" aria-hidden />
                    </span>
                  )}

                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                      <span>{formatKstDateLabel(record.date)}</span>
                      <span aria-hidden>·</span>
                      <span>{MEAL_LABEL[record.mealType]}</span>
                    </span>

                    <span className="mt-1.5 block truncate text-sm font-bold">
                      {record.foodName ?? record.memo ?? "사진만 올렸어요"}
                    </span>

                    {record.feedbackCount === 0 ? (
                      <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-brand/15 px-2.5 py-1 text-[11px] font-semibold text-brand-strong">
                        <MessageSquare className="size-3" aria-hidden />
                        피드백 대기
                      </span>
                    ) : (
                      <span className="mt-2 block text-[11px] text-muted-foreground">
                        기록 상세 보기
                      </span>
                    )}
                  </span>

                  <ChevronRight
                    className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                    aria-hidden
                  />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* =========================================================
          BODY / JOURNEY
      ========================================================= */}
      <section id="body" className="mt-9 scroll-mt-20">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold tracking-wide text-brand-strong">
              BODY PROGRESS
            </p>
            <h2 className="mt-1 text-xl font-bold tracking-tight">신체 변화</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              측정 기록을 바탕으로 회원의 변화를 확인해요.
            </p>
          </div>

          <Link
            href={`/trainer/members/${id}/journey`}
            className="inline-flex shrink-0 items-center gap-1 rounded-full border border-border/70 px-3 py-2 text-xs font-semibold transition-colors hover:bg-secondary"
          >
            전체 여정
            <ChevronRight className="size-3.5" aria-hidden />
          </Link>
        </div>

        {!sharing.shareBody ? (
          <div className="mt-4 rounded-3xl border border-dashed border-border bg-card p-5">
            <span className="flex size-11 items-center justify-center rounded-2xl bg-secondary text-muted-foreground">
              <Lock className="size-5" aria-hidden />
            </span>
            <p className="mt-3 text-sm font-bold">
              아직 체성분을 공유하지 않았어요
            </p>
            <p className="mt-1.5 text-xs leading-5 text-muted-foreground">
              회원이 내 정보의 공유 설정에서 체성분 공유를 켜면 이곳에서 확인할
              수 있어요.
            </p>
          </div>
        ) : !body || body.rows.length === 0 ? (
          <div className="mt-4 rounded-3xl border border-border/60 bg-card px-4 py-7 text-center shadow-card">
            <span className="mx-auto flex size-11 items-center justify-center rounded-2xl bg-brand/15 text-brand-strong">
              <CalendarClock className="size-5" aria-hidden />
            </span>
            <p className="mt-3 text-sm font-bold">아직 측정 기록이 없어요</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              체성분 측정 기록이 등록되면 이곳에서 변화를 확인할 수 있어요.
            </p>
          </div>
        ) : (
          <>
            <div className="mt-4 grid grid-cols-3 gap-2">
              {body.trends.map((trend) => (
                <div
                  key={trend.type}
                  className="min-w-0 rounded-2xl border border-border/50 bg-card p-3 shadow-card"
                >
                  <p className="truncate text-xs font-medium text-muted-foreground">
                    {trend.label}
                  </p>

                  <p className="mt-2 truncate text-lg font-bold tracking-tight tabular-nums">
                    {trend.latest === null ? "-" : trend.latest}
                    {trend.latest === null ? "" : trend.unit}
                  </p>

                  <p className="mt-1 truncate text-[11px] text-muted-foreground tabular-nums">
                    {trend.delta === null
                      ? "비교 기록 없음"
                      : trend.delta === 0
                        ? "변화 없음"
                        : `이전 대비 ${
                            trend.delta > 0 ? "+" : ""
                          }${trend.delta}${trend.unit}`}
                  </p>
                </div>
              ))}
            </div>

            <Link
              href={`/trainer/members/${id}/journey`}
              className="mt-3 flex items-center gap-3 rounded-3xl border border-border/60 bg-card p-4 shadow-card transition-colors hover:bg-secondary/50"
            >
              <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-brand/15 text-brand-strong">
                <ChevronRight className="size-5" aria-hidden />
              </span>

              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold">
                  회원 여정 자세히 보기
                </span>
                <span className="mt-1 block text-xs text-muted-foreground">
                  PT 수업 · 운동 · 체성분 변화 기록
                </span>
              </span>

              <ChevronRight
                className="size-4 shrink-0 text-muted-foreground"
                aria-hidden
              />
            </Link>
          </>
        )}
      </section>

      {/* =========================================================
          JOURNALS
      ========================================================= */}
      <section id="journals" className="mt-10 scroll-mt-20">
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-bold tracking-[0.16em] text-brand-strong">
              MEMBER COMMUNICATION
            </p>
            <h2 className="mt-1.5 text-xl font-bold tracking-tight">알림장</h2>
            <p className="mt-1.5 text-xs leading-5 text-muted-foreground">
              수업 기록을 공유하고 회원과 소통해요.
            </p>
          </div>

          <form action={beginJournal}>
            <input
              type="hidden"
              name="memberMembershipId"
              value={member.connectionId}
            />
            <button
              type="submit"
              className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-brand px-4 text-xs font-bold text-primary transition-opacity hover:opacity-80"
            >
              <PenLine className="size-3.5" aria-hidden />새 알림장
            </button>
          </form>
        </div>

        {awaitingReplyJournals.length > 0 ? (
          <div className="mt-5 rounded-3xl border border-brand/25 bg-brand/10 p-4">
            <div className="flex items-start gap-3">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-card text-brand-strong">
                <MessageSquare className="size-5" aria-hidden />
              </span>

              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold">회원의 답변을 확인해 주세요</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  답변을 기다리는 알림장이 {awaitingReplyJournals.length}건
                  있어요.
                </p>
                <Link
                  href={`/trainer/journals/${awaitingReplyJournals[0].id}`}
                  className="mt-3 inline-flex items-center gap-1 rounded-full bg-card px-3 py-2 text-xs font-bold text-brand-strong transition-colors hover:bg-background"
                >
                  답변 확인하기
                  <ChevronRight className="size-3.5" aria-hidden />
                </Link>
              </div>
            </div>
          </div>
        ) : null}

        {member.journals.length === 0 ? (
          <div className="mt-5 rounded-3xl border border-dashed border-border bg-card px-5 py-8 text-center">
            <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-secondary text-muted-foreground">
              <PenLine className="size-5" aria-hidden />
            </span>
            <p className="mt-4 text-sm font-bold">
              아직 작성한 알림장이 없어요
            </p>
            <p className="mx-auto mt-1.5 max-w-xs text-xs leading-5 text-muted-foreground">
              새 알림장을 작성하면 수업 기록과 회원의 답변을 이곳에서 확인할 수
              있어요.
            </p>
          </div>
        ) : (
          <ul className="mt-5 flex flex-col gap-3">
            {member.journals.slice(0, 3).map((journal) => (
              <li key={journal.id}>
                <Link
                  href={`/trainer/journals/${journal.id}`}
                  className="group flex items-center gap-3 rounded-3xl border border-border/70 bg-card p-4 transition-colors hover:bg-secondary/40"
                >
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-brand/10 text-brand-strong">
                    <PenLine className="size-5" aria-hidden />
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-1.5">
                      <span className="min-w-0 break-words text-sm font-bold">
                        {journal.title ?? formatKstDateLabel(journal.date)}
                      </span>

                      {journal.status === "DRAFT" ? (
                        <span className="shrink-0 rounded-full bg-secondary px-2 py-1 text-[10px] font-semibold text-muted-foreground">
                          초안
                        </span>
                      ) : null}

                      {journal.awaitingReply ? (
                        <span className="shrink-0 rounded-full bg-brand/15 px-2 py-1 text-[10px] font-bold text-brand-strong">
                          답장 대기
                        </span>
                      ) : null}
                    </span>

                    <span className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted-foreground">
                      <span>{formatKstDateLabel(journal.date)}</span>

                      {journal.commentCount > 0 ? (
                        <span className="inline-flex items-center gap-1">
                          <MessageSquare className="size-3.5" aria-hidden />
                          댓글 {journal.commentCount}
                        </span>
                      ) : null}
                    </span>
                  </span>

                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors group-hover:bg-secondary">
                    <ChevronRight className="size-4" aria-hidden />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}

        {member.journals.length > 3 ? (
          <Link
            href="/trainer/journals"
            className="mt-3 flex h-11 items-center justify-center gap-1 rounded-2xl border border-border/70 text-xs font-semibold text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            알림장 전체 보기
            <ChevronRight className="size-3.5" aria-hidden />
          </Link>
        ) : null}
      </section>

      {/* =========================================================
          TRAINING HISTORY
      ========================================================= */}
      <section className="mt-10">
        <div className="mb-4 flex items-end justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold tracking-[0.16em] text-brand-strong">
              TRAINING HISTORY
            </p>
            <h2 className="mt-1.5 text-xl font-bold tracking-tight">
              최근 수업
            </h2>
            <p className="mt-1.5 text-xs text-muted-foreground">
              완료한 수업과 운동 기록을 확인해요.
            </p>
          </div>

          <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-brand/10 text-brand-strong">
            <Dumbbell className="size-5" aria-hidden />
          </span>
        </div>

        {member.recentSessions.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-border bg-card px-5 py-7 text-center">
            <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-secondary text-muted-foreground">
              <Dumbbell className="size-5" aria-hidden />
            </span>
            <p className="mt-4 text-sm font-bold">아직 완료한 수업이 없어요</p>
            <p className="mt-1.5 text-xs leading-5 text-muted-foreground">
              수업이 완료되면 회차와 운동 기록을 이곳에서 확인할 수 있어요.
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {member.recentSessions.map((session) => (
              <li key={session.id}>
                <Link
                  href={`/trainer/sessions/${session.id}`}
                  className="group flex items-center gap-3 rounded-3xl border border-border/70 bg-card p-4 transition-colors hover:bg-secondary/40"
                >
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-brand/10 text-brand-strong">
                    <Dumbbell className="size-5" aria-hidden />
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-bold">
                        {session.sessionNumber}회차 수업
                      </span>

                      {session.journalStatus === "PUBLISHED" ? (
                        <span className="rounded-full bg-brand/15 px-2 py-1 text-[10px] font-bold text-brand-strong">
                          알림장 게시
                        </span>
                      ) : null}
                    </span>

                    <span className="mt-1.5 block text-xs text-muted-foreground">
                      {formatKstDateLabel(session.scheduledAt)}
                    </span>

                    <span className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <Dumbbell className="size-3.5" aria-hidden />
                        운동 {session.exerciseCount}개
                      </span>
                      <span>{session.setCount}세트</span>
                    </span>
                  </span>

                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors group-hover:bg-secondary">
                    <ChevronRight className="size-4" aria-hidden />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* =========================================================
          UPCOMING SESSIONS
      ========================================================= */}
      <section className="mt-10">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold tracking-widest text-brand-strong">
              SCHEDULE
            </p>
            <h2 className="mt-1 text-lg font-bold tracking-tight">수업 일정</h2>
          </div>
          <span className="flex size-10 items-center justify-center rounded-2xl bg-brand/10 text-brand-strong">
            <CalendarClock className="size-5" aria-hidden />
          </span>
        </div>

        {member.upcomingSessions.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-border bg-card px-5 py-7 text-center">
            <span className="mx-auto flex size-11 items-center justify-center rounded-2xl bg-secondary text-muted-foreground">
              <CalendarClock className="size-5" aria-hidden />
            </span>
            <p className="mt-3 text-sm font-semibold">예정된 수업이 없어요</p>
            <p className="mt-1 text-xs text-muted-foreground">
              새로운 수업을 등록하면 여기에 표시돼요.
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {member.upcomingSessions.map((session) => {
              const isToday = toKstDateKey(session.scheduledAt) === todayKey;

              return (
                <li key={session.id}>
                  <Link
                    href={`/trainer/sessions/${session.id}`}
                    className={`group flex items-center gap-3 rounded-3xl border bg-card p-4 transition-colors hover:bg-secondary/60 ${
                      isToday ? "border-brand/50" : "border-border/70"
                    }`}
                  >
                    <span
                      className={`flex size-12 shrink-0 items-center justify-center rounded-2xl ${
                        isToday
                          ? "bg-brand/15 text-brand-strong"
                          : "bg-secondary text-muted-foreground"
                      }`}
                    >
                      <CalendarClock className="size-5" aria-hidden />
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-bold">
                          {isToday
                            ? "오늘 수업"
                            : formatKstDateLabel(session.scheduledAt)}
                        </span>

                        {isToday ? (
                          <span className="rounded-full bg-brand/15 px-2 py-1 text-[11px] font-bold text-brand-strong">
                            TODAY
                          </span>
                        ) : null}
                      </span>

                      <span className="mt-1.5 block text-xs text-muted-foreground tabular-nums">
                        {formatTime(session.scheduledAt)} ·{" "}
                        {session.sessionNumber}회차
                      </span>
                    </span>

                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors group-hover:bg-background">
                      <ChevronRight className="size-4" aria-hidden />
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* =========================================================
          CONTRACTS
      ========================================================= */}
      <section className="mt-10">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold tracking-widest text-brand-strong">
              PT MEMBERSHIP
            </p>
            <h2 className="mt-1 text-lg font-bold tracking-tight">PT 계약</h2>
          </div>

          <Link
            href={`/trainer/members/${id}/contracts/new`}
            className="inline-flex h-10 items-center gap-1.5 rounded-full bg-brand px-4 text-xs font-bold text-primary transition-opacity hover:opacity-80"
          >
            <Plus className="size-4" aria-hidden />
            계약 등록
          </Link>
        </div>

        {contracts.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-border bg-card px-5 py-7 text-center">
            <span className="mx-auto flex size-11 items-center justify-center rounded-2xl bg-secondary text-muted-foreground">
              <Plus className="size-5" aria-hidden />
            </span>
            <p className="mt-3 text-sm font-semibold">
              등록된 PT 계약이 없어요
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              계약 횟수와 기간을 등록해 회원의 수업을 관리해 보세요.
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {contracts.map((contract) => {
              const ratio = getContractRatio(
                contract.usedSessions,
                contract.totalSessions,
              );

              const isCurrent = activeContract?.id === contract.id;

              return (
                <li key={contract.id}>
                  <Link
                    href={`/trainer/members/${id}/contracts/${contract.id}`}
                    className={`group block rounded-3xl border bg-card p-5 transition-colors hover:bg-secondary/40 ${
                      isCurrent ? "border-brand/60" : "border-border/70"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="break-words text-sm font-bold">
                            {contract.title}
                          </p>

                          {isCurrent ? (
                            <span className="rounded-full bg-brand/15 px-2 py-1 text-[11px] font-bold text-brand-strong">
                              진행 중
                            </span>
                          ) : null}
                        </div>

                        <p className="mt-1.5 text-xs text-muted-foreground">
                          {contract.usedSessions} / {contract.totalSessions}회
                          사용
                        </p>
                      </div>

                      <div className="shrink-0 text-right">
                        <p className="text-xl font-bold tracking-tight text-brand-strong tabular-nums">
                          {contract.remaining}
                          <span className="ml-1 text-xs font-semibold">회</span>
                        </p>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          남은 횟수
                        </p>
                      </div>
                    </div>

                    <div className="mt-4">
                      <div className="mb-2 flex items-center justify-between text-[11px] text-muted-foreground">
                        <span>수업 진행률</span>
                        <span className="font-semibold tabular-nums">
                          {Math.round(ratio)}%
                        </span>
                      </div>
                      <div
                        className="h-2 overflow-hidden rounded-full bg-secondary"
                        role="progressbar"
                        aria-label={`${contract.title} 수업 진행률`}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={Math.round(ratio)}
                      >
                        <div
                          className="h-full rounded-full bg-brand transition-[width]"
                          style={{
                            width: `${ratio}%`,
                          }}
                        />
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-x-3 gap-y-2 text-xs text-muted-foreground">
                      {contract.scheduledCount > 0 ? (
                        <span className="inline-flex items-center gap-1">
                          <CalendarClock className="size-3.5" aria-hidden />
                          예정 {contract.scheduledCount}건
                        </span>
                      ) : null}

                      {contract.expiresAt ? (
                        <span>
                          {formatKstDateLabel(contract.expiresAt)}까지
                        </span>
                      ) : null}
                    </div>

                    {contract.expired ? (
                      <p className="mt-3 rounded-xl bg-destructive/10 px-3 py-2 text-xs font-semibold text-destructive">
                        계약 기간이 지났어요. 연장하거나 마무리해 주세요.
                      </p>
                    ) : contract.status !== "ACTIVE" ? (
                      <p className="mt-3 rounded-xl bg-secondary px-3 py-2 text-xs font-medium text-muted-foreground">
                        {CONTRACT_STATUS_LABEL[contract.status]}
                      </p>
                    ) : null}

                    <div className="mt-4 flex items-center justify-end gap-1 text-xs font-semibold text-muted-foreground transition-colors group-hover:text-foreground">
                      계약 상세 보기
                      <ChevronRight className="size-3.5" aria-hidden />
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
