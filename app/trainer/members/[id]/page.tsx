import Link from "next/link";

import { ProgressRing } from "@/components/ui/progress-ring";
import { notFound } from "next/navigation";

import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Dumbbell,
  Lock,
  NotebookPen,
  PenLine,
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
  getMemberStats,
  TrainerError,
} from "@/server/trainers/trainer.service";
import {
  BODY_PART_MUSCLES,
  MuscleFigure,
  type MuscleLevels,
  type MuscleRegion,
} from "@/components/fitness/muscle-figure";
import { BODY_PART_LABEL } from "@/lib/exercise-labels";

import { getMemberClaimCode } from "@/server/trainers/connection.service";

import { beginJournal } from "../../journals/actions";
import { ClaimLinkPanel } from "./claim-link-panel";

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
  const claimCode = member.pending
    ? await getMemberClaimCode(user.id, id)
    : null;

  const [contracts, personalWorkouts, recentDiet, body, stats] = await Promise.all([
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

    getMemberStats(user.id, id, sharing.sharePersonalWorkout),
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

  /*
   * 최근 4주 부위별 세트 → 근육 그림 칠하기.
   * 주로 쓰는 근육에는 세트 수 그대로, 보조 근육에는 40% 만 더한다.
   */
  const regionScore = new Map<MuscleRegion, number>();
  for (const { bodyPart, sets } of stats.bodyPartSets) {
    const muscles = BODY_PART_MUSCLES[bodyPart];
    for (const region of muscles.main) regionScore.set(region, (regionScore.get(region) ?? 0) + sets);
    for (const region of muscles.assist)
      regionScore.set(region, (regionScore.get(region) ?? 0) + sets * 0.4);
  }
  const maxScore = Math.max(0, ...regionScore.values());
  const muscleLevels: MuscleLevels = {};
  for (const [region, score] of regionScore) {
    const ratio = maxScore > 0 ? score / maxScore : 0;
    muscleLevels[region] = ratio >= 0.66 ? 3 : ratio >= 0.33 ? 2 : ratio > 0 ? 1 : 0;
  }
  const topParts = stats.bodyPartSets.slice(0, 4);
  const maxPartSets = Math.max(1, ...topParts.map((part) => part.sets));
  const totalPartSets = stats.bodyPartSets.reduce((sum, part) => sum + part.sets, 0);
  // 큰 부위 중 가장 적게 한 곳을 한 줄로 짚는다. 기록이 없으면 말하지 않는다.
  const majorParts = ["CHEST", "BACK", "SHOULDER", "ARM", "LEG"] as const;
  const weakest =
    totalPartSets > 0
      ? majorParts
          .map((part) => ({
            part,
            sets: stats.bodyPartSets.find((row) => row.bodyPart === part)?.sets ?? 0,
          }))
          .sort((a, b) => a.sets - b.sets)[0]
      : null;

  const weightTrend = body?.trends.find((trend) => trend.type === "WEIGHT") ?? null;
  const usedRatio = activeContract
    ? getContractRatio(activeContract.usedSessions, activeContract.totalSessions) / 100
    : 0;

  const sectionTitle = "mx-1 mb-1 flex items-center justify-between gap-2";
  const lockedBox =
    "flex items-start gap-3 rounded-[1.125rem] bg-[#f7f8f7] px-3.5 py-3 text-xs leading-relaxed text-muted-foreground";

  return (
    <main className="px-4 pt-3.5 pb-6">
      {/* =========================================================
          HEADER
      ========================================================= */}
      <header className="flex items-center gap-2.5">
        <Link
          href="/trainer/members"
          aria-label="회원 목록"
          className="flex size-10 shrink-0 items-center justify-center rounded-full border border-border text-ink"
        >
          <ChevronLeft className="size-4.5" aria-hidden />
        </Link>
        <span className="flex size-9.5 shrink-0 items-center justify-center rounded-full bg-brand-muted text-sm font-extrabold text-primary">
          {member.name.trim().slice(0, 1)}
        </span>
        <div className="min-w-0 flex-1 leading-tight">
          <h1 className="truncate text-[1.0625rem] font-extrabold">{member.name}</h1>
          <p className="truncate text-xs text-muted-foreground">
            {formatKstDateLabel(member.startedAt)}부터 담당
          </p>
        </div>
        <form action={beginJournal} className="shrink-0">
          <input type="hidden" name="memberMembershipId" value={member.connectionId} />
          <button
            type="submit"
            aria-label="새 알림장 쓰기"
            className="flex size-10 items-center justify-center rounded-full border border-border text-ink"
          >
            <PenLine className="size-4.25" aria-hidden />
          </button>
        </form>
      </header>

      {/* =========================================================
          PT HERO
      ========================================================= */}
      {activeContract ? (
        <section className="mt-3 rounded-3xl bg-primary px-4.5 py-4 text-white">
          <Link
            href={`/trainer/members/${id}/contracts/${activeContract.id}`}
            className="flex items-center gap-3.5"
          >
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs text-white/75">
                남은 PT · {activeContract.title}
              </span>
              <span className="block text-[2.5rem] leading-[1.05] font-extrabold tracking-tight tabular-nums">
                {activeContract.remaining}
                <span className="text-[0.9375rem] font-semibold">
                  {" "}
                  / {activeContract.totalSessions}회
                </span>
              </span>
              <span className="mt-2 flex flex-wrap gap-1.5">
                <span className="rounded-full border border-white/35 px-2.5 py-0.75 text-[0.6875rem] font-semibold whitespace-nowrap">
                  {nextSession
                    ? `다음 ${toKstDateKey(nextSession.scheduledAt) === todayKey ? "오늘" : formatKstDateLabel(nextSession.scheduledAt)} ${formatTime(nextSession.scheduledAt)}`
                    : "다음 수업 없음"}
                </span>
                {contractNeedsAttention ? (
                  <span className="rounded-full bg-coral px-2.5 py-0.75 text-[0.6875rem] font-bold whitespace-nowrap">
                    계약 확인 필요
                  </span>
                ) : null}
              </span>
            </span>
            <span
              role="progressbar"
              aria-label="PT 계약 진행률"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(usedRatio * 100)}
            >
              <ProgressRing
                ratio={usedRatio}
                size={84}
                stroke={8}
                color="var(--brand)"
                track="rgb(255 255 255 / 14%)"
                fill="transparent"
              >
                <span className="text-[0.9375rem] leading-none font-extrabold tabular-nums">
                  {Math.round(usedRatio * 100)}%
                </span>
                <span className="mt-0.5 text-[0.625rem] text-white/70">
                  {activeContract.expiresAt
                    ? `${formatKstDateLabel(activeContract.expiresAt).replace(/ \(.\)$/, "")} 만료`
                    : "기간 없음"}
                </span>
              </ProgressRing>
            </span>
          </Link>
          <div className="mt-3.5 flex gap-1.5">
            {todaySession ? (
              <Link
                href={`/trainer/sessions/${todaySession.id}`}
                className="flex h-10 min-w-0 flex-1 items-center justify-center rounded-full bg-brand text-[0.8125rem] font-extrabold text-ink"
              >
                오늘 수업 기록
              </Link>
            ) : nextSession ? (
              <Link
                href={`/trainer/sessions/${nextSession.id}`}
                className="flex h-10 min-w-0 flex-1 items-center justify-center rounded-full bg-brand text-[0.8125rem] font-extrabold text-ink"
              >
                다음 수업 보기
              </Link>
            ) : null}
            <Link
              href={`/trainer/members/${id}/contracts/${activeContract.id}`}
              className="flex h-10 min-w-0 flex-1 items-center justify-center rounded-full border border-white/35 text-[0.8125rem] font-bold"
            >
              수업 잡기
            </Link>
          </div>
        </section>
      ) : (
        <div className="mt-3 flex items-center justify-between gap-3 rounded-[1.375rem] bg-[#f7f8f7] py-3.5 pr-3 pl-4">
          <div className="min-w-0">
            <p className="text-sm font-bold">진행 중인 PT 계약이 없어요</p>
            <p className="mt-0.5 text-xs text-muted-foreground">새 계약을 등록해 수업 횟수를 관리하세요.</p>
          </div>
          <Link
            href={`/trainer/members/${id}/contracts/new`}
            className="inline-flex h-9 shrink-0 items-center justify-center rounded-full bg-ink px-3.5 text-xs font-bold text-white"
          >
            계약 등록
          </Link>
        </div>
      )}

      {/* =========================================================
          PENDING MEMBER NOTICE
      ========================================================= */}
      {member.pending ? (
        <p className="mt-3 rounded-[1.125rem] bg-[#f7f8f7] px-4 py-3 text-xs leading-5 text-muted-foreground">
          <b className="font-bold text-foreground">아직 가입하지 않은 회원</b>
          이에요. 계약·수업·알림장은 지금부터 그대로 쌓이지만, 회원이 가입해서 이 계정을 이어받기
          전까지는 회원 쪽에 보이지 않아요.
        </p>
      ) : null}

      {member.pending ? (
        <ClaimLinkPanel
          connectionId={id}
          initialCode={claimCode?.code ?? null}
          initialExpiresAt={claimCode?.expiresAt.toISOString() ?? null}
        />
      ) : null}

      {/* =========================================================
          확인할 것 (코랄 테두리 한 줄씩)
      ========================================================= */}
      {managementItems.length > 0 ? (
        <ul className="mt-3 flex flex-col gap-1.5">
          {managementItems.map((item) => {
            const isReply = item.key.startsWith("reply-");
            const row = (
              <>
                <AlertCircle className="size-4 shrink-0 text-status-urgent" aria-hidden />
                <b className="min-w-0 flex-1 truncate text-[0.8125rem]">
                  {isReply ? `${item.label}이 기다려요` : item.label}
                </b>
                <span className="shrink-0 rounded-full bg-surface px-3 py-1.75 text-xs font-bold">
                  {isReply ? "답장" : "확인"}
                </span>
              </>
            );
            return (
              <li key={item.key}>
                {item.href ? (
                  <Link
                    href={item.href}
                    className="flex min-h-11 items-center gap-2 rounded-full border-[1.5px] border-coral py-1.5 pr-1.5 pl-3.5"
                  >
                    {row}
                  </Link>
                ) : (
                  <div className="flex min-h-11 items-center gap-2 rounded-full border-[1.5px] border-coral py-1.5 pr-1.5 pl-3.5">
                    {row}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      ) : null}

      {/* =========================================================
          TABS (밑줄)
      ========================================================= */}
      <nav className="sticky top-[3.75rem] z-20 -mx-4 mt-3 border-b border-line bg-background px-4">
        <div className="grid grid-cols-5">
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
              className="flex h-10 items-center justify-center text-[0.8125rem] font-semibold whitespace-nowrap text-muted-foreground transition-colors hover:text-ink hover:shadow-[inset_0_-3px_0_var(--primary)]"
            >
              {label}
            </a>
          ))}
        </div>
      </nav>

      {/* =========================================================
          SUMMARY
      ========================================================= */}
      <section id="summary" className="flex scroll-mt-28 flex-col gap-3 pt-3">
        <div className="grid grid-cols-3 gap-2">
          <span className="min-w-0 rounded-2xl bg-[#f7f8f7] px-3 py-2.5">
            <span className="block text-[0.6875rem] text-muted-foreground">체중</span>
            {weightTrend && weightTrend.latest !== null ? (
              <>
                <b className="block truncate text-[1.0625rem] tabular-nums">
                  {weightTrend.latest}
                  <span className="text-[0.6875rem]">kg</span>
                </b>
                <span className="block truncate text-[0.6875rem] font-bold text-primary tabular-nums">
                  {weightTrend.delta === null || weightTrend.delta === 0
                    ? "변화 없음"
                    : `${weightTrend.delta > 0 ? "▲" : "▼"}${Math.abs(weightTrend.delta)}`}
                </span>
              </>
            ) : (
              <>
                <b className="block text-[1.0625rem] text-faint">-</b>
                <span className="block truncate text-[0.6875rem] text-muted-foreground">
                  {sharing.shareBody ? "기록 없음" : "공유 안 함"}
                </span>
              </>
            )}
          </span>
          <span className="min-w-0 rounded-2xl bg-[#f7f8f7] px-3 py-2.5">
            <span className="block text-[0.6875rem] text-muted-foreground">출석률</span>
            <b className="block truncate text-[1.0625rem] tabular-nums">
              {stats.attendanceRate === null ? "-" : stats.attendanceRate}
              {stats.attendanceRate === null ? "" : <span className="text-[0.6875rem]">%</span>}
            </b>
            <span className="block truncate text-[0.6875rem] text-muted-foreground tabular-nums">
              {stats.completedCount}/{stats.completedCount + stats.noShowCount}회
            </span>
          </span>
          <span className="min-w-0 rounded-2xl bg-[#f7f8f7] px-3 py-2.5">
            <span className="block text-[0.6875rem] text-muted-foreground">개인 운동</span>
            <b className="block truncate text-[1.0625rem] tabular-nums">
              {stats.personalThisMonth === null ? "-" : stats.personalThisMonth}
              {stats.personalThisMonth === null ? "" : <span className="text-[0.6875rem]">회</span>}
            </b>
            <span className="block truncate text-[0.6875rem] text-muted-foreground">
              {stats.personalThisMonth === null ? "공유 안 함" : "이번 달"}
            </span>
          </span>
        </div>

        <section className="rounded-[1.375rem] border border-border px-4 py-3.5">
          <div className="flex items-baseline justify-between gap-2">
            <b className="text-[0.9375rem]">최근 4주 많이 한 부위</b>
            <span className="shrink-0 text-[0.6875rem] text-muted-foreground">
              {sharing.sharePersonalWorkout ? "PT + 개인 운동" : "PT 수업만"}
            </span>
          </div>
          {totalPartSets === 0 ? (
            <p className="mt-2.5 rounded-xl bg-[#f7f8f7] px-3 py-3 text-xs text-muted-foreground">
              최근 4주 동안 기록된 세트가 없어요.
            </p>
          ) : (
            <>
              <div className="mt-2.5 flex items-center gap-3">
                <MuscleFigure
                  levels={muscleLevels}
                  label={`최근 4주 부위별: ${topParts
                    .map((part) => `${BODY_PART_LABEL[part.bodyPart]} ${part.sets}세트`)
                    .join(", ")}`}
                  className="h-32 w-17.5 shrink-0"
                />
                <span className="flex min-w-0 flex-1 flex-col gap-2">
                  {topParts.map((part, index) => (
                    <span key={part.bodyPart} className="flex items-center gap-2 text-xs">
                      <span className="w-14.5 shrink-0 truncate font-bold">
                        {BODY_PART_LABEL[part.bodyPart]}
                      </span>
                      <span className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-[#f0f2f0]">
                        <span
                          className="block h-full rounded-full"
                          style={{
                            width: `${Math.round((part.sets / maxPartSets) * 100)}%`,
                            background:
                              index === 0 ? "#2f6b53" : index === topParts.length - 1 && topParts.length > 2 ? "#cfd6d2" : "#5fd3a8",
                          }}
                        />
                      </span>
                      <span className="w-9.5 shrink-0 text-right text-muted-foreground tabular-nums">
                        {part.sets}세트
                      </span>
                    </span>
                  ))}
                </span>
              </div>
              {weakest && weakest.sets < maxPartSets / 3 ? (
                <p className="mt-2.5 rounded-xl bg-[#f7f8f7] px-2.5 py-2 text-xs text-[#4b5650]">
                  {BODY_PART_LABEL[weakest.part]} 운동이 적어요. 다음 수업에 넣어보세요.
                </p>
              ) : null}
            </>
          )}
        </section>

        {/* 최근 수업 */}
        <section>
          <div className={sectionTitle}>
            <h2 className="text-base font-extrabold">최근 수업</h2>
            <Link href={`/trainer/members/${id}/journey`} className="shrink-0 text-xs font-bold text-primary">
              변화 보기 ›
            </Link>
          </div>
          {member.recentSessions.length === 0 ? (
            <p className="rounded-[1.125rem] bg-[#f7f8f7] px-4 py-5 text-center text-xs text-muted-foreground">
              아직 완료한 수업이 없어요
            </p>
          ) : (
            <ul>
              {member.recentSessions.map((session) => {
                const kst = new Date(session.scheduledAt.getTime() + 9 * 3_600_000);
                const label =
                  session.status === "COMPLETED"
                    ? { text: "완료", cls: "bg-brand-muted text-primary" }
                    : session.status === "NO_SHOW"
                      ? { text: "노쇼", cls: "bg-status-urgent-bg text-status-urgent" }
                      : session.status === "CANCELLED"
                        ? { text: "취소", cls: "bg-surface text-muted-foreground" }
                        : { text: "예정", cls: "bg-surface text-[#4b5650]" };
                return (
                  <li key={session.id}>
                    <Link
                      href={`/trainer/sessions/${session.id}`}
                      className="flex items-center gap-3 border-b border-line px-1 py-2.5"
                    >
                      <span className="w-11 shrink-0 text-center">
                        <b className="block text-base leading-tight tabular-nums">{kst.getUTCDate()}</b>
                        <span className="text-[0.6875rem] text-muted-foreground">
                          {kst.getUTCMonth() + 1}월
                        </span>
                      </span>
                      <span className="min-w-0 flex-1">
                        <b className="block truncate text-[0.8125rem]">{session.sessionNumber}회차 수업</b>
                        <span className="block truncate text-[0.6875rem] text-muted-foreground tabular-nums">
                          운동 {session.exerciseCount}개 · {session.setCount}세트
                          {session.journalStatus === "PUBLISHED" ? " · 알림장 보냄" : ""}
                        </span>
                      </span>
                      <span className={`shrink-0 rounded-full px-2.25 py-0.75 text-[0.6875rem] font-bold ${label.cls}`}>
                        {label.text}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </section>

      {/* =========================================================
          WORKOUT (개인 운동)
      ========================================================= */}
      <section id="workout" className="mt-5 scroll-mt-28">
        <div className={sectionTitle}>
          <h2 className="text-base font-extrabold">개인 운동</h2>
          <span className="shrink-0 text-[0.6875rem] text-faint">회원이 공유한 것만</span>
        </div>
        {!sharing.sharePersonalWorkout ? (
          <p className={lockedBox}>
            <Lock className="mt-px size-4 shrink-0" aria-hidden />
            개인 운동 기록을 공유하지 않았어요. 회원이 공유를 켜면 여기서 볼 수 있어요. PT 수업
            기록은 따로 남아요.
          </p>
        ) : personalWorkouts.length === 0 ? (
          <p className="rounded-[1.125rem] bg-[#f7f8f7] px-4 py-5 text-center text-xs text-muted-foreground">
            아직 개인 운동 기록이 없어요
          </p>
        ) : (
          <ul>
            {personalWorkouts.map((session) => (
              <li key={session.id} className="flex items-center gap-3 border-b border-line px-1 py-2.5">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-brand-muted text-primary">
                  <Dumbbell className="size-4.5" strokeWidth={1.9} aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <b className="block truncate text-[0.8125rem]">
                    {session.exerciseNames.length === 0
                      ? "기록한 운동이 없어요"
                      : session.exerciseNames.join(" · ")}
                  </b>
                  <span className="block truncate text-[0.6875rem] text-muted-foreground tabular-nums">
                    {formatKstDateLabel(session.startedAt)} · {session.totalSets}세트
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* =========================================================
          DIET
      ========================================================= */}
      <section id="diet" className="mt-5 scroll-mt-28">
        <div className={sectionTitle}>
          <h2 className="text-base font-extrabold">식단</h2>
          {sharing.shareDiet && recentDiet.length > 0 ? (
            <Link href={`/trainer/members/${id}/diet`} className="shrink-0 text-xs font-bold text-primary">
              전체 보기 ›
            </Link>
          ) : null}
        </div>
        {!sharing.shareDiet ? (
          <p className={lockedBox}>
            <Lock className="mt-px size-4 shrink-0" aria-hidden />
            아직 식단을 공유하지 않았어요. 회원이 공유를 켜면 여기서 볼 수 있어요.
          </p>
        ) : recentDiet.length === 0 ? (
          <p className="rounded-[1.125rem] bg-[#f7f8f7] px-4 py-5 text-center text-xs text-muted-foreground">
            아직 등록된 식단이 없어요
          </p>
        ) : (
          <ul>
            {recentDiet.map((record) => (
              <li key={record.id}>
                <Link
                  href={`/trainer/members/${id}/diet/${record.id}`}
                  className="flex items-center gap-3 border-b border-line px-1 py-2.5"
                >
                  {record.thumbnailUrl ? (
                    // 서명 URL은 열 때마다 달라질 수 있어 일반 img를 사용한다.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={record.thumbnailUrl}
                      alt=""
                      loading="lazy"
                      className="size-11 shrink-0 rounded-xl bg-line object-cover"
                    />
                  ) : (
                    <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-muted text-primary">
                      <UtensilsCrossed className="size-4.5" aria-hidden />
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <b className="block truncate text-[0.8125rem]">
                      {record.foodName ?? record.memo ?? "사진만 올렸어요"}
                    </b>
                    <span className="block truncate text-[0.6875rem] text-muted-foreground">
                      {formatKstDateLabel(record.date)} · {MEAL_LABEL[record.mealType]}
                    </span>
                  </span>
                  <span
                    className={`shrink-0 text-xs font-bold ${
                      record.feedbackCount === 0 ? "text-status-urgent" : "text-primary"
                    }`}
                  >
                    {record.feedbackCount === 0 ? "피드백" : "보기"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* =========================================================
          BODY
      ========================================================= */}
      <section id="body" className="mt-5 scroll-mt-28">
        <div className={sectionTitle}>
          <h2 className="text-base font-extrabold">몸의 변화</h2>
          <Link href={`/trainer/members/${id}/journey`} className="shrink-0 text-xs font-bold text-primary">
            전체 여정 ›
          </Link>
        </div>
        {!sharing.shareBody ? (
          <p className={lockedBox}>
            <Lock className="mt-px size-4 shrink-0" aria-hidden />
            아직 체성분을 공유하지 않았어요. 회원이 공유를 켜면 여기서 볼 수 있어요.
          </p>
        ) : !body || body.rows.length === 0 ? (
          <p className="rounded-[1.125rem] bg-[#f7f8f7] px-4 py-5 text-center text-xs text-muted-foreground">
            아직 측정 기록이 없어요
          </p>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {body.trends.map((trend) => (
              <div key={trend.type} className="min-w-0 rounded-2xl border border-border px-3 py-2.5">
                <p className="truncate text-[0.6875rem] text-muted-foreground">{trend.label}</p>
                <p className="truncate text-[1.0625rem] font-extrabold tabular-nums">
                  {trend.latest === null ? "-" : trend.latest}
                  <span className="text-[0.6875rem] font-semibold">
                    {trend.latest === null ? "" : trend.unit}
                  </span>
                </p>
                <p className="truncate text-[0.6875rem] font-bold text-primary tabular-nums">
                  {trend.delta === null
                    ? "비교 기록 없음"
                    : trend.delta === 0
                      ? "변화 없음"
                      : `${trend.delta > 0 ? "▲" : "▼"}${Math.abs(trend.delta)}${trend.unit}`}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* =========================================================
          JOURNALS
      ========================================================= */}
      <section id="journals" className="mt-5 scroll-mt-28">
        <div className={sectionTitle}>
          <h2 className="text-base font-extrabold">알림장</h2>
          <form action={beginJournal} className="shrink-0">
            <input type="hidden" name="memberMembershipId" value={member.connectionId} />
            <button type="submit" className="text-xs font-bold text-primary">
              + 새 알림장
            </button>
          </form>
        </div>
        {member.journals.length === 0 ? (
          <p className="rounded-[1.125rem] bg-[#f7f8f7] px-4 py-5 text-center text-xs text-muted-foreground">
            아직 작성한 알림장이 없어요
          </p>
        ) : (
          <ul>
            {member.journals.slice(0, 3).map((journal) => (
              <li key={journal.id}>
                <Link
                  href={`/trainer/journals/${journal.id}`}
                  className="flex items-center gap-3 border-b border-line px-1 py-2.5"
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-brand-muted text-primary">
                    <NotebookPen className="size-4.5" strokeWidth={1.9} aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex min-w-0 items-center gap-1.5">
                      <b className="min-w-0 truncate text-[0.8125rem]">
                        {journal.title ?? formatKstDateLabel(journal.date)}
                      </b>
                      {journal.status === "DRAFT" ? (
                        <span className="shrink-0 rounded-full border border-input px-1.5 text-[0.6875rem] leading-4.25 font-bold text-muted-foreground">
                          초안
                        </span>
                      ) : null}
                      {journal.awaitingReply ? (
                        <span className="shrink-0 rounded-full border border-coral px-1.5 text-[0.6875rem] leading-4.25 font-bold text-status-urgent">
                          답장 대기
                        </span>
                      ) : null}
                    </span>
                    <span className="block truncate text-[0.6875rem] text-muted-foreground tabular-nums">
                      {formatKstDateLabel(journal.date)}
                      {journal.commentCount > 0 ? ` · 댓글 ${journal.commentCount}` : ""}
                    </span>
                  </span>
                  <ChevronRight className="size-4 shrink-0 text-faint" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        )}
        {member.journals.length > 3 ? (
          <Link
            href="/trainer/journals"
            className="mt-2 flex h-10 items-center justify-center rounded-full bg-surface text-xs font-bold text-muted-foreground"
          >
            알림장 전체 보기
          </Link>
        ) : null}
      </section>

      {/* =========================================================
          UPCOMING SESSIONS
      ========================================================= */}
      <section className="mt-5">
        <div className={sectionTitle}>
          <h2 className="text-base font-extrabold">수업 일정</h2>
        </div>
        {member.upcomingSessions.length === 0 ? (
          <p className="rounded-[1.125rem] bg-[#f7f8f7] px-4 py-5 text-center text-xs text-muted-foreground">
            예정된 수업이 없어요
          </p>
        ) : (
          <ul>
            {member.upcomingSessions.map((session) => {
              const isToday = toKstDateKey(session.scheduledAt) === todayKey;
              return (
                <li key={session.id}>
                  <Link
                    href={`/trainer/sessions/${session.id}`}
                    className="flex items-center gap-3 border-b border-line px-1 py-2.5"
                  >
                    <span className="min-w-0 flex-1">
                      <b className="block truncate text-[0.8125rem]">
                        {isToday ? "오늘" : formatKstDateLabel(session.scheduledAt)} {formatTime(session.scheduledAt)}
                      </b>
                      <span className="block text-[0.6875rem] text-muted-foreground tabular-nums">
                        {session.sessionNumber}회차
                      </span>
                    </span>
                    <span
                      className={`shrink-0 rounded-full border px-2.25 py-0.5 text-[0.6875rem] font-bold ${
                        isToday ? "border-primary text-primary" : "border-input text-muted-foreground"
                      }`}
                    >
                      {isToday ? "오늘" : "예정"}
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
      <section className="mt-5">
        <div className={sectionTitle}>
          <h2 className="text-base font-extrabold">PT 계약</h2>
          <Link
            href={`/trainer/members/${id}/contracts/new`}
            className="shrink-0 text-xs font-bold text-primary"
          >
            + 계약 등록
          </Link>
        </div>
        {contracts.length === 0 ? (
          <p className="rounded-[1.125rem] bg-[#f7f8f7] px-4 py-5 text-center text-xs text-muted-foreground">
            등록된 PT 계약이 없어요
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {contracts.map((contract) => {
              const isCurrent = activeContract?.id === contract.id;
              return (
                <li key={contract.id}>
                  <section
                    className={`rounded-[1.375rem] border px-4 py-3.5 ${
                      isCurrent ? "border-primary" : "border-border"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex min-w-0 items-center gap-1.5">
                        <b className="min-w-0 truncate text-[0.9375rem]">{contract.title}</b>
                        {isCurrent ? (
                          <span className="shrink-0 rounded-full bg-brand-muted px-2 py-0.5 text-[0.6875rem] font-extrabold text-primary">
                            진행 중
                          </span>
                        ) : contract.status !== "ACTIVE" || contract.expired ? (
                          <span className="shrink-0 rounded-full bg-surface px-2 py-0.5 text-[0.6875rem] font-bold text-muted-foreground">
                            {contract.expired ? "기간 지남" : CONTRACT_STATUS_LABEL[contract.status]}
                          </span>
                        ) : null}
                      </span>
                      <Link
                        href={`/trainer/members/${id}/contracts/${contract.id}`}
                        className="flex h-8 shrink-0 items-center rounded-full bg-surface px-3 text-xs font-bold"
                      >
                        계약 관리
                      </Link>
                    </div>
                    <dl className="mt-2.5 grid grid-cols-[4.25rem_minmax(0,1fr)] gap-y-1.5 text-[0.8125rem]">
                      <dt className="text-muted-foreground">남은 횟수</dt>
                      <dd className="font-bold tabular-nums">
                        {contract.remaining}회 / {contract.totalSessions}회
                      </dd>
                      <dt className="text-muted-foreground">사용</dt>
                      <dd className="font-bold tabular-nums">
                        {contract.usedSessions}회 진행 · {contract.scheduledCount}회 예약
                      </dd>
                      <dt className="text-muted-foreground">기간</dt>
                      <dd className="truncate font-bold tabular-nums">
                        {formatKstDateLabel(contract.startedAt).replace(/ \(.\)$/, "")} ~{" "}
                        {contract.expiresAt
                          ? formatKstDateLabel(contract.expiresAt).replace(/ \(.\)$/, "")
                          : "기간 없음"}
                      </dd>
                    </dl>
                    {contract.expired ? (
                      <p className="mt-2.5 rounded-xl bg-status-urgent-bg px-3 py-2 text-xs font-semibold text-status-urgent">
                        계약 기간이 지났어요. 연장하거나 마무리해 주세요.
                      </p>
                    ) : null}
                  </section>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
