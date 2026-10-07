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
import {
  formatKstDateLabel,
  toKstDateKey,
} from "@/lib/date";
import { getMemberBody } from "@/server/body/body-trainer.service";
import { listMemberDiet } from "@/server/diet/diet-trainer.service";
import { MEAL_LABEL } from "@/server/diet/diet.service";
import {
  getMemberPersonalWorkouts,
  getSharingForTrainer,
} from "@/server/sharing/sharing.service";
import {
  CONTRACT_STATUS_LABEL,
  listContracts,
} from "@/server/pt/pt.service";
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

function getContractRatio(
  usedSessions: number,
  totalSessions: number,
) {
  if (totalSessions <= 0) return 0;

  return Math.min(
    100,
    Math.max(0, (usedSessions / totalSessions) * 100),
  );
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
  const sharing = await getSharingForTrainer(
    user.id,
    id,
  );

  const [
    contracts,
    personalWorkouts,
    recentDiet,
    body,
  ] = await Promise.all([
    listContracts(user.id, id),

    sharing.sharePersonalWorkout
      ? getMemberPersonalWorkouts(user.id, id, 5)
      : [],

    sharing.shareDiet
      ? listMemberDiet(user.id, id, 3).then(
          ({ days }) =>
            days.flatMap(
              (day) => day.records,
            ),
        )
      : [],

    sharing.shareBody
      ? getMemberBody(user.id, id, 30)
      : null,
  ]);

  /*
   * 현재 사용할 계약.
   *
   * listContracts의 정렬에 의존하지 않고
   * 실제 진행 중 + 아직 만료되지 않은 계약을 우선한다.
   */
  const activeContract =
    contracts.find(
      (contract) =>
        contract.status === "ACTIVE" &&
        !contract.expired,
    ) ??
    contracts.find(
      (contract) =>
        contract.status === "ACTIVE",
    ) ??
    null;

  /*
   * 오늘 수업인지 KST 기준으로 판단한다.
   */
  const todayKey = toKstDateKey(new Date());

  const nextSession =
    member.upcomingSessions[0] ?? null;

  const nextSessionIsToday =
    nextSession !== null &&
    toKstDateKey(
      nextSession.scheduledAt,
    ) === todayKey;

  /*
   * 오늘 수업 중에는 가장 가까운 수업 하나를
   * 메인 CTA로 보여준다.
   */
  const todaySession =
    member.upcomingSessions.find(
      (session) =>
        toKstDateKey(
          session.scheduledAt,
        ) === todayKey,
    ) ?? null;

  /*
   * 답변이 필요한 알림장.
   */
  const awaitingReplyJournals =
    member.journals.filter(
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
          14 *
            24 *
            60 *
            60 *
            1000));

  /*
   * 최근 기록은 너무 많이 보여주지 않는다.
   *
   * 상세 데이터는 아래 섹션에 있고,
   * 상단에서는 "최근에 무슨 일이 있었는지"만 빠르게 확인한다.
   */
  const latestWorkout =
    personalWorkouts[0] ?? null;

  const latestDiet =
    recentDiet[0] ?? null;

  const latestJournal =
    member.journals[0] ?? null;

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
    const journal =
      awaitingReplyJournals[0];

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
        activeContract &&
        activeContract.remaining <= 3
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
          className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronLeft
            className="size-4"
            aria-hidden
          />
          회원
        </Link>

        <div className="mt-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="truncate text-2xl font-bold tracking-tight">
                {member.name}
              </h1>

              <p className="mt-1 text-xs text-muted-foreground">
                {formatKstDateLabel(
                  member.startedAt,
                )}{" "}
                담당 시작
              </p>
            </div>

            <Link
              href={`/trainer/members/${id}/journey`}
              className="shrink-0 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
            >
              변화 보기
              <ChevronRight
                className="ml-0.5 inline size-3.5"
                aria-hidden
              />
            </Link>
          </div>

          {activeContract ? (
            <div className="mt-4 flex items-center gap-2">
              <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-bold">
                PT {activeContract.usedSessions}/
                {activeContract.totalSessions}
              </span>

              <span className="text-sm font-bold text-brand-strong">
                {activeContract.remaining}회 남음
              </span>

              {activeContract.expiresAt ? (
                <span className="text-xs text-muted-foreground">
                  ·{" "}
                  {formatKstDateLabel(
                    activeContract.expiresAt,
                  )}
                  까지
                </span>
              ) : null}
            </div>
          ) : (
            <div className="mt-4">
              <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-bold text-muted-foreground">
                진행 중인 PT 계약 없음
              </span>
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
            <b className="font-bold text-foreground">
              아직 가입하지 않은 회원
            </b>
            이에요. 계약·수업·알림장은 지금부터
            그대로 쌓이지만, 회원이 가입해서 이
            계정을 이어받기 전까지는 회원 쪽에
            보이지 않아요.
          </p>
        </section>
      ) : null}

      {/* =========================================================
          MAIN CTA — TODAY SESSION
      ========================================================= */}
      {todaySession ? (
        <Link
          href={`/trainer/sessions/${todaySession.id}`}
          className="mt-5 block rounded-2xl bg-brand px-4 py-4 text-primary transition-transform active:scale-[0.99]"
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold opacity-80">
                오늘 수업
              </p>

              <p className="mt-1 text-lg font-bold">
                {formatTime(
                  todaySession.scheduledAt,
                )}{" "}
                · {todaySession.sessionNumber}회차
              </p>
            </div>

            <span className="flex size-10 items-center justify-center rounded-xl bg-primary/15">
              <ChevronRight
                className="size-5"
                aria-hidden
              />
            </span>
          </div>

          <p className="mt-2 text-xs opacity-80">
            수업을 시작하고 운동 기록을 남겨보세요.
          </p>
        </Link>
      ) : nextSession ? (
        <Link
          href={`/trainer/sessions/${nextSession.id}`}
          className="mt-5 flex items-center gap-3 rounded-2xl border border-border bg-card p-4 transition-colors hover:bg-secondary"
        >
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-muted-foreground">
            <CalendarClock
              className="size-5"
              aria-hidden
            />
          </span>

          <span className="min-w-0 flex-1">
            <span className="block text-xs font-semibold text-muted-foreground">
              다음 수업
            </span>

            <span className="mt-0.5 block text-sm font-bold">
              {formatKstDateLabel(
                nextSession.scheduledAt,
              )}{" "}
              {formatTime(
                nextSession.scheduledAt,
              )}
            </span>

            <span className="mt-0.5 block text-xs text-muted-foreground">
              {nextSession.sessionNumber}회차
            </span>
          </span>

          <ChevronRight
            className="size-4 shrink-0 text-muted-foreground"
            aria-hidden
          />
        </Link>
      ) : null}

      {/* =========================================================
          MANAGEMENT / TODO
      ========================================================= */}
      {managementItems.length > 0 ? (
        <section className="mt-5 rounded-2xl border border-border bg-card">
          <div className="px-4 pt-4">
            <p className="text-xs font-bold text-muted-foreground">
              지금 확인할 것
            </p>
          </div>

          <ul className="mt-2 divide-y divide-border">
            {managementItems.map(
              (item) => {
                const content = (
                  <>
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-secondary text-sm">
                      !
                    </span>

                    <span className="min-w-0 flex-1 text-sm font-semibold">
                      {item.label}
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
                        className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-secondary"
                      >
                        {content}
                      </Link>
                    ) : (
                      <div className="flex items-center gap-3 px-4 py-3.5">
                        {content}
                      </div>
                    )}
                  </li>
                );
              },
            )}
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
      <section
        id="summary"
        className="scroll-mt-16"
      >
        <div className="mt-6">
          <h2 className="text-base font-bold">
            요약
          </h2>

          {/* 현재 상태 */}
          {sharing.shareBody &&
          body &&
          body.rows.length > 0 ? (
            <div className="mt-3 grid grid-cols-3 gap-2">
              {body.trends
                .slice(0, 3)
                .map((trend) => (
                  <div
                    key={trend.type}
                    className="rounded-2xl border border-border bg-card p-3"
                  >
                    <p className="truncate text-xs text-muted-foreground">
                      {trend.label}
                    </p>

                    <p className="mt-1 text-lg font-bold tabular-nums">
                      {trend.latest === null
                        ? "-"
                        : trend.latest}
                      {trend.latest === null
                        ? ""
                        : trend.unit}
                    </p>

                    <p className="mt-0.5 truncate text-[0.6875rem] text-muted-foreground tabular-nums">
                      {trend.delta === null
                        ? "비교할 값 없음"
                        : trend.delta === 0
                          ? "변화 없음"
                          : `${
                              trend.delta > 0
                                ? "+"
                                : ""
                            }${trend.delta}${
                              trend.unit
                            }`}
                    </p>
                  </div>
                ))}
            </div>
          ) : null}

          {/* 최근 활동 */}
          <div className="mt-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold">
                최근 활동
              </h3>
            </div>

            <div className="mt-2 overflow-hidden rounded-2xl border border-border bg-card">
              {latestWorkout ? (
                <Link
                  href="#workout"
                  className="flex items-center gap-3 border-b border-border px-4 py-3.5 transition-colors hover:bg-secondary"
                >
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-secondary text-sm">
                    🏋️
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold">
                      개인 운동
                    </span>

                    <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                      {formatKstDateLabel(
                        latestWorkout.startedAt,
                      )}{" "}
                      ·{" "}
                      {
                        latestWorkout.totalSets
                      }
                      세트
                    </span>
                  </span>

                  <ChevronRight
                    className="size-4 text-muted-foreground"
                    aria-hidden
                  />
                </Link>
              ) : null}

              {latestDiet ? (
                <Link
                  href="#diet"
                  className="flex items-center gap-3 border-b border-border px-4 py-3.5 transition-colors hover:bg-secondary"
                >
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-secondary text-sm">
                    🍽️
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold">
                      식단 기록
                    </span>

                    <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                      {formatKstDateLabel(
                        latestDiet.date,
                      )}{" "}
                      ·{" "}
                      {
                        MEAL_LABEL[
                          latestDiet.mealType
                        ]
                      }
                    </span>
                  </span>

                  <ChevronRight
                    className="size-4 text-muted-foreground"
                    aria-hidden
                  />
                </Link>
              ) : null}

              {latestJournal ? (
                <Link
                  href={`/trainer/journals/${latestJournal.id}`}
                  className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-secondary"
                >
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-secondary text-sm">
                    📝
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold">
                      알림장
                    </span>

                    <span className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                      <span>
                        {formatKstDateLabel(
                          latestJournal.date,
                        )}
                      </span>

                      {latestJournal.awaitingReply ? (
                        <span className="font-semibold text-brand-strong">
                          답장 대기
                        </span>
                      ) : null}
                    </span>
                  </span>

                  <ChevronRight
                    className="size-4 text-muted-foreground"
                    aria-hidden
                  />
                </Link>
              ) : null}

              {!latestWorkout &&
              !latestDiet &&
              !latestJournal ? (
                <p className="px-4 py-4 text-xs text-muted-foreground">
                  아직 확인할 최근 활동이 없어요.
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================
          WORKOUT
      ========================================================= */}
      <section
        id="workout"
        className="mt-8 scroll-mt-16"
      >
        <div className="flex items-baseline justify-between gap-2">
          <div>
            <h2 className="text-base font-bold">
              개인 운동
            </h2>

            {sharing.sharePersonalWorkout ? (
              <p className="mt-0.5 text-xs text-muted-foreground">
                회원이 공유한 최근 운동
              </p>
            ) : null}
          </div>
        </div>

        {!sharing.sharePersonalWorkout ? (
          <div className="mt-2 rounded-2xl border border-dashed border-border p-4">
            <span className="flex size-8 items-center justify-center rounded-xl bg-secondary text-muted-foreground">
              <Lock
                className="size-4"
                aria-hidden
              />
            </span>

            <p className="mt-2.5 text-sm font-bold">
              회원이 개인 운동 기록을
              공유하지 않았어요
            </p>

            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              회원이 내 정보 &gt; 공유 설정에서
              켜면 여기에 나타나요. PT 수업에서
              직접 적은 기록은 그대로 남아요.
            </p>
          </div>
        ) : personalWorkouts.length === 0 ? (
          <p className="mt-2 rounded-2xl border border-border bg-card p-4 text-xs text-muted-foreground">
            아직 혼자 한 운동 기록이 없어요.
          </p>
        ) : (
          <ul className="mt-2 flex flex-col gap-2">
            {personalWorkouts.map(
              (session) => (
                <li
                  key={session.id}
                  className="rounded-2xl border border-border bg-card p-4"
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="text-sm font-bold">
                      {formatKstDateLabel(
                        session.startedAt,
                      )}
                    </p>

                    <p className="shrink-0 text-xs text-muted-foreground tabular-nums">
                      {session.totalSets}
                      세트
                    </p>
                  </div>

                  <p className="mt-1 truncate text-xs text-muted-foreground">
                    {session.exerciseNames
                      .length === 0
                      ? "기록한 운동이 없어요"
                      : session.exerciseNames.join(
                          " · ",
                        )}
                  </p>
                </li>
              ),
            )}
          </ul>
        )}
      </section>

      {/* =========================================================
          DIET
      ========================================================= */}
      <section
        id="diet"
        className="mt-8 scroll-mt-16"
      >
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-base font-bold">
            식단
          </h2>

          {sharing.shareDiet ? (
            <Link
              href={`/trainer/members/${id}/diet`}
              className="text-xs font-semibold text-brand-strong"
            >
              전체 보기
            </Link>
          ) : null}
        </div>

        {!sharing.shareDiet ? (
          <div className="mt-2 rounded-2xl border border-dashed border-border p-4">
            <span className="flex size-8 items-center justify-center rounded-xl bg-secondary text-muted-foreground">
              <Lock
                className="size-4"
                aria-hidden
              />
            </span>

            <p className="mt-2.5 text-sm font-bold">
              회원이 식단을 공유하지 않았어요
            </p>

            <p className="mt-1 text-xs text-muted-foreground">
              회원이 내 정보 &gt; 공유 설정에서
              켜면 여기에 나타나요.
            </p>
          </div>
        ) : recentDiet.length === 0 ? (
          <p className="mt-2 rounded-2xl border border-border bg-card p-4 text-xs text-muted-foreground">
            아직 올린 식단이 없어요.
          </p>
        ) : (
          <ul className="mt-2 flex flex-col gap-2">
            {recentDiet.map(
              (record) => (
                <li key={record.id}>
                  <Link
                    href={`/trainer/members/${id}/diet/${record.id}`}
                    className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3 transition-colors hover:bg-secondary"
                  >
                    {record.thumbnailUrl ? (
                      // 서명 URL은 열 때마다 달라질 수 있어 일반 img를 사용한다.
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
                        {formatKstDateLabel(
                          record.date,
                        )}{" "}
                        ·{" "}
                        {
                          MEAL_LABEL[
                            record.mealType
                          ]
                        }
                      </span>

                      <span className="mt-0.5 block truncate text-sm font-bold">
                        {record.foodName ??
                          record.memo ??
                          "사진만 올렸어요"}
                      </span>
                    </span>

                    {record.feedbackCount ===
                    0 ? (
                      <span className="shrink-0 rounded-full bg-brand px-2 py-0.5 text-[0.6875rem] font-bold text-primary">
                        피드백 대기
                      </span>
                    ) : null}
                  </Link>
                </li>
              ),
            )}
          </ul>
        )}
      </section>

      {/* =========================================================
          BODY / JOURNEY
      ========================================================= */}
      <section
        id="body"
        className="mt-8 scroll-mt-16"
      >
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-base font-bold">
            변화
          </h2>

          <Link
            href={`/trainer/members/${id}/journey`}
            className="text-xs font-semibold text-brand-strong"
          >
            전체 여정 보기
          </Link>
        </div>

        {!sharing.shareBody ? (
          <div className="mt-2 rounded-2xl border border-dashed border-border p-4">
            <span className="flex size-8 items-center justify-center rounded-xl bg-secondary text-muted-foreground">
              <Lock
                className="size-4"
                aria-hidden
              />
            </span>

            <p className="mt-2.5 text-sm font-bold">
              회원이 체성분을 공유하지 않았어요
            </p>

            <p className="mt-1 text-xs text-muted-foreground">
              회원이 내 정보 &gt; 공유 설정에서
              켜면 여기에 나타나요.
            </p>
          </div>
        ) : !body ||
          body.rows.length === 0 ? (
          <div className="mt-2 rounded-2xl border border-border bg-card p-4">
            <p className="text-sm font-bold">
              아직 측정 기록이 없어요
            </p>

            <p className="mt-1 text-xs text-muted-foreground">
              담당을 시작한 뒤 측정한 체성분이
              여기에 표시돼요.
            </p>
          </div>
        ) : (
          <>
            <ul className="mt-2 grid grid-cols-3 gap-2">
              {body.trends.map(
                (trend) => (
                  <li
                    key={trend.type}
                    className="rounded-2xl border border-border bg-card p-3"
                  >
                    <p className="truncate text-xs text-muted-foreground">
                      {trend.label}
                    </p>

                    <p className="mt-1 text-lg font-bold tabular-nums">
                      {trend.latest === null
                        ? "-"
                        : trend.latest}
                      {trend.latest === null
                        ? ""
                        : trend.unit}
                    </p>

                    <p className="mt-0.5 truncate text-[0.6875rem] text-muted-foreground tabular-nums">
                      {trend.delta === null
                        ? "비교할 값 없음"
                        : trend.delta === 0
                          ? "변화 없음"
                          : `${
                              trend.delta > 0
                                ? "+"
                                : ""
                            }${trend.delta}${
                              trend.unit
                            }`}
                    </p>
                  </li>
                ),
              )}
            </ul>

            <Link
              href={`/trainer/members/${id}/journey`}
              className="mt-2 flex items-center justify-between rounded-2xl border border-border bg-card px-4 py-3.5 transition-colors hover:bg-secondary"
            >
              <span>
                <span className="block text-sm font-bold">
                  회원 여정 보기
                </span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  PT · 운동 · 체성분 변화
                </span>
              </span>

              <ChevronRight
                className="size-4 text-muted-foreground"
                aria-hidden
              />
            </Link>
          </>
        )}
      </section>

      {/* =========================================================
          JOURNALS
      ========================================================= */}
      <section
        id="journals"
        className="mt-8 scroll-mt-16"
      >
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-base font-bold">
            알림장
          </h2>

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
              <PenLine
                className="size-3.5"
                aria-hidden
              />
              새로 쓰기
            </button>
          </form>
        </div>

        {awaitingReplyJournals.length >
        0 ? (
          <div className="mt-2 rounded-2xl border border-border bg-secondary px-4 py-3">
            <p className="text-xs font-bold">
              답변이 필요한 알림장이{" "}
              {awaitingReplyJournals.length}건
              있어요.
            </p>

            <Link
              href={`/trainer/journals/${awaitingReplyJournals[0].id}`}
              className="mt-1 block text-xs font-semibold text-brand-strong"
            >
              답변하러 가기
              <ChevronRight
                className="ml-0.5 inline size-3.5"
                aria-hidden
              />
            </Link>
          </div>
        ) : null}

        {member.journals.length === 0 ? (
          <p className="mt-2 rounded-2xl border border-border bg-card p-4 text-xs text-muted-foreground">
            아직 쓴 알림장이 없어요.
          </p>
        ) : (
          <ul className="mt-2 flex flex-col gap-2">
            {member.journals
              .slice(0, 3)
              .map((journal) => (
                <li key={journal.id}>
                  <Link
                    href={`/trainer/journals/${journal.id}`}
                    className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 transition-colors hover:bg-secondary"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5">
                        <span className="truncate text-sm font-bold">
                          {journal.title ??
                            formatKstDateLabel(
                              journal.date,
                            )}
                        </span>

                        {journal.status ===
                        "DRAFT" ? (
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
                          {formatKstDateLabel(
                            journal.date,
                          )}
                        </span>

                        {journal.commentCount >
                        0 ? (
                          <span className="flex items-center gap-0.5">
                            <MessageSquare
                              className="size-3"
                              aria-hidden
                            />

                            <span className="tabular-nums">
                              {
                                journal.commentCount
                              }
                            </span>
                          </span>
                        ) : null}
                      </span>
                    </span>

                    <ChevronRight
                      className="size-4 shrink-0 text-muted-foreground"
                      aria-hidden
                    />
                  </Link>
                </li>
              ))}
          </ul>
        )}

        {member.journals.length > 3 ? (
          <Link
            href="/trainer/journals"
            className="mt-2 flex h-10 items-center justify-center rounded-xl border border-border text-xs font-semibold text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            알림장 전체 보기
          </Link>
        ) : null}
      </section>

      <section className="mt-8">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-base font-bold">최근 수업</h2>
        </div>

        {member.recentSessions.length === 0 ? (
          <p className="mt-2 rounded-2xl border border-border bg-card p-4 text-xs text-muted-foreground">
            아직 완료한 수업이 없어요.
          </p>
        ) : (
          <ul className="mt-2 flex flex-col gap-2">
            {member.recentSessions.map((session) => (
              <li key={session.id}>
                <Link
                  href={`/trainer/sessions/${session.id}`}
                  className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 transition-colors hover:bg-secondary"
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-secondary">
                    <Dumbbell
                      className="size-4 text-muted-foreground"
                      aria-hidden
                    />
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span className="text-sm font-bold">
                        {session.sessionNumber}회차
                      </span>

                      {session.journalStatus === "PUBLISHED" ? (
                        <span className="rounded-full bg-secondary px-1.5 py-0.5 text-[0.6875rem] font-semibold text-muted-foreground">
                          알림장
                        </span>
                      ) : null}
                    </span>

                    <span className="mt-1 block text-xs text-muted-foreground">
                      {formatKstDateLabel(session.scheduledAt)}
                      {" · "}
                      {session.exerciseCount}개 운동
                      {" · "}
                      {session.setCount}세트
                    </span>
                  </span>

                  <ChevronRight
                    className="size-4 shrink-0 text-muted-foreground"
                    aria-hidden
                  />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* =========================================================
          UPCOMING SESSIONS
      ========================================================= */}
      <section className="mt-8">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-base font-bold">
            수업 일정
          </h2>
        </div>

        {member.upcomingSessions.length ===
        0 ? (
          <p className="mt-2 rounded-2xl border border-border bg-card p-4 text-xs text-muted-foreground">
            잡힌 수업이 없어요.
          </p>
        ) : (
          <ul className="mt-2 flex flex-col gap-2">
            {member.upcomingSessions.map(
              (session) => {
                const isToday =
                  toKstDateKey(
                    session.scheduledAt,
                  ) === todayKey;

                return (
                  <li key={session.id}>
                    <Link
                      href={`/trainer/sessions/${session.id}`}
                      className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 transition-colors hover:bg-secondary"
                    >
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-secondary text-muted-foreground">
                        <CalendarClock
                          className="size-4.5"
                          aria-hidden
                        />
                      </span>

                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5">
                          <span className="text-sm font-bold">
                            {isToday
                              ? "오늘"
                              : formatKstDateLabel(
                                  session.scheduledAt,
                                )}
                          </span>

                          {isToday ? (
                            <span className="rounded-full bg-brand px-1.5 py-0.5 text-[0.6875rem] font-bold text-primary">
                              오늘
                            </span>
                          ) : null}
                        </span>

                        <span className="mt-0.5 block text-xs text-muted-foreground tabular-nums">
                          {formatTime(
                            session.scheduledAt,
                          )}{" "}
                          ·{" "}
                          {
                            session.sessionNumber
                          }
                          회차
                        </span>
                      </span>

                      <ChevronRight
                        className="size-4 shrink-0 text-muted-foreground"
                        aria-hidden
                      />
                    </Link>
                  </li>
                );
              },
            )}
          </ul>
        )}
      </section>

      {/* =========================================================
          CONTRACTS
      ========================================================= */}
      <section className="mt-8">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-base font-bold">
            PT 계약
          </h2>

          <Link
            href={`/trainer/members/${id}/contracts/new`}
            className="inline-flex h-8 items-center gap-1 rounded-full border border-border px-3 text-xs font-bold transition-colors hover:bg-secondary"
          >
            <Plus
              className="size-3.5"
              aria-hidden
            />
            등록
          </Link>
        </div>

        {contracts.length === 0 ? (
          <p className="mt-2 rounded-2xl border border-border bg-card p-4 text-xs text-muted-foreground">
            아직 등록한 PT 계약이 없어요.
            횟수와 기간만 넣으면 돼요.
          </p>
        ) : (
          <ul className="mt-2 flex flex-col gap-2.5">
            {contracts.map((contract) => {
              const ratio =
                getContractRatio(
                  contract.usedSessions,
                  contract.totalSessions,
                );

              const isCurrent =
                activeContract?.id ===
                contract.id;

              return (
                <li key={contract.id}>
                  <Link
                    href={`/trainer/members/${id}/contracts/${contract.id}`}
                    className={`block rounded-2xl border bg-card p-4 transition-colors hover:bg-secondary ${
                      isCurrent
                        ? "border-brand"
                        : "border-border"
                    }`}
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <p className="truncate font-bold">
                          {contract.title}
                        </p>

                        {isCurrent ? (
                          <span className="shrink-0 rounded-full bg-brand px-1.5 py-0.5 text-[0.6875rem] font-bold text-primary">
                            진행 중
                          </span>
                        ) : null}
                      </div>

                      <p className="shrink-0 text-sm font-bold text-brand-strong tabular-nums">
                        {contract.remaining}
                        회 남음
                      </p>
                    </div>

                    <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-secondary">
                      <div
                        className="h-full rounded-full bg-brand"
                        style={{
                          width: `${ratio}%`,
                        }}
                      />
                    </div>

                    <p className="mt-2 text-xs text-muted-foreground tabular-nums">
                      {contract.usedSessions}{" "}
                      /{" "}
                      {contract.totalSessions}회
                      {contract.scheduledCount >
                      0
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
                        기간이 지났어요.
                        연장하거나
                        마무리해주세요.
                      </p>
                    ) : contract.status !==
                      "ACTIVE" ? (
                      <p className="mt-1.5 text-xs font-medium text-muted-foreground">
                        {
                          CONTRACT_STATUS_LABEL[
                            contract.status
                          ]
                        }
                      </p>
                    ) : null}
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