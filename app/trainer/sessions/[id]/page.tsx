import Link from "next/link";
import { notFound } from "next/navigation";

import {
  AlertCircle,
  Check,
  ChevronLeft,
  Dumbbell,
  NotebookPen,
} from "lucide-react";

import { requireUser } from "@/app/lib/dal";
import { formatKstDateLabel, toKstTimeValue } from "@/lib/date";
import { getBodyPartCounts } from "@/server/exercises/exercise.service";
import {
  PTError,
  SESSION_STATUS_LABEL,
} from "@/server/pt/pt.service";
import {
  getSessionBriefing,
  getSessionRecord,
  getSessionWorkout,
} from "@/server/pt/session-record.service";
import { getSharingForTrainer } from "@/server/sharing/sharing.service";
import { TrainerError } from "@/server/trainers/trainer.service";
import { getFavoriteExerciseIds } from "@/server/workouts/favorite.service";
import { getLastRecord } from "@/server/workouts/workout.service";

import { AddExerciseDrawer } from "@/app/(user)/workouts/[id]/add-exercise-drawer";
import { RecordList } from "@/app/(user)/workouts/[id]/record-list";

import { Briefing } from "./briefing";
import { ClearWorkoutButton } from "./clear-workout-button";
import {
  FinishSessionDrawer,
  ReopenSessionButton,
} from "./finish-session-drawer";
import { OpenWorkoutButton } from "./open-workout-button";
import { writeJournalAction } from "./actions";

export const metadata = {
  title: "수업 기록 | FitNote",
};

/**
 * PT 수업 중에 사용하는 화면.
 *
 * 수업 중에는 최대한 빠르게
 *
 * 1. 지난 수업 확인
 * 2. 오늘 운동 기록
 * 3. 수업 종료
 *
 * 만 할 수 있도록 구성한다.
 *
 * 운동 기록은 입력 즉시 저장하고,
 * 알림장은 수업 종료 후 선택적으로 작성한다.
 */
export default async function SessionRecordPage({
  params,
  searchParams,
}: PageProps<"/trainer/sessions/[id]">) {
  const user = await requireUser();
  const { id } = await params;
  const query = await searchParams;

  let session;

  try {
    session = await getSessionRecord(user.id, id);
  } catch (error) {
    if (
      error instanceof PTError ||
      error instanceof TrainerError
    ) {
      notFound();
    }

    throw error;
  }

  const cancelled =
    session.status === "CANCELLED";

  const done =
    session.status === "COMPLETED";

  const scheduled =
    session.status === "SCHEDULED";

  /*
   * 취소된 수업에서는 운동 기록을 열지 않는다.
   */
  const workout = cancelled
    ? null
    : await getSessionWorkout(
        user.id,
        id,
      );

  /*
   * 취소된 수업에서는 지난 수업 브리핑도 보여주지 않는다.
   */
  const briefing = cancelled
    ? null
    : await getSessionBriefing(
        user.id,
        id,
      );

  /*
   * 회원의 개인 운동 공유 설정.
   *
   * 개인 운동 공유가 꺼져 있으면
   * 이전 기록에서도 PT 기록만 사용한다.
   */
  const sharing = session.connectionId
    ? await getSharingForTrainer(
        user.id,
        session.connectionId,
      )
    : {
        sharePersonalWorkout: false,
      };

  const [
    previousRecords,
    bodyPartCounts,
    favoriteIds,
  ] = await Promise.all([
    Promise.all(
      (workout?.records ?? []).map(
        (record) =>
          getLastRecord(
            session.memberUserId,
            record.exercise.id,
            workout!.id,
            {
              ptOnly:
                !sharing.sharePersonalWorkout,
            },
          ),
      ),
    ),

    workout
      ? getBodyPartCounts()
      : Promise.resolve({}),

    /*
     * 트레이너 자신의 즐겨찾기.
     *
     * 자주 처방하는 운동을 빠르게 찾기 위한 용도.
     */
    workout
      ? getFavoriteExerciseIds(user.id)
      : Promise.resolve([]),
  ]);

  const remaining = Math.max(
    session.totalSessions -
      session.usedSessions,
    0,
  );

  const recordCount =
    workout?.records.length ?? 0;

  const setCount =
    workout?.records.reduce(
      (sum, record) =>
        sum + record.sets.length,
      0,
    ) ?? 0;

  return (
    <main className="px-5 pt-4 pb-16">
      {/* =====================================================
          HEADER
         ===================================================== */}

      <div className="flex items-start gap-3">
        {session.connectionId ? (
          <Link
            href={`/trainer/members/${session.connectionId}`}
            aria-label={`${session.memberName} 회원 상세로 이동`}
            className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl border border-border text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <ChevronLeft
              className="size-4"
              aria-hidden
            />
          </Link>
        ) : null}

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              {/* 회원명을 가장 중요한 정보로 */}
              <h1 className="truncate text-xl font-bold tracking-tight">
                {session.memberName}
              </h1>

              <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
                <span className="font-semibold text-foreground tabular-nums">
                  {session.sessionNumber}
                  회차
                </span>

                <span aria-hidden>
                  ·
                </span>

                <span className="tabular-nums">
                  {toKstTimeValue(
                    session.scheduledAt,
                  )}
                </span>

                <span aria-hidden>
                  ·
                </span>

                <span className="tabular-nums">
                  {session.durationMinutes}
                  분
                </span>

                {!scheduled ? (
                  <>
                    <span aria-hidden>
                      ·
                    </span>

                    <span className="rounded-full bg-secondary px-1.5 py-0.5 text-[0.6875rem] font-semibold">
                      {
                        SESSION_STATUS_LABEL[
                          session.status
                        ]
                      }
                    </span>
                  </>
                ) : null}
              </p>
            </div>

            <span className="shrink-0 pt-1 text-xs text-muted-foreground">
              {formatKstDateLabel(
                session.scheduledAt,
              )}
            </span>
          </div>
        </div>
      </div>

      {/* =====================================================
          RESULT MESSAGE
         ===================================================== */}

      {query.done ? (
        <p className="mt-4 flex items-center gap-1.5 rounded-xl bg-accent px-3.5 py-2.5 text-sm font-bold text-brand-strong">
          <Check
            className="size-4"
            aria-hidden
          />

          {query.done ===
          "complete"
            ? `완료했어요. ${session.usedSessions}/${session.totalSessions}회차`
            : query.done ===
                "no_show"
              ? "노쇼로 저장했어요."
              : query.done ===
                  "cancel"
                ? "취소로 저장했어요."
                : "예정으로 되돌렸어요."}
        </p>
      ) : null}

      {query.error ? (
        <p className="mt-4 flex items-center gap-1.5 rounded-xl border border-destructive px-3.5 py-2.5 text-sm font-medium text-destructive">
          <AlertCircle
            className="size-4 shrink-0"
            aria-hidden
          />

          {query.error}
        </p>
      ) : null}

      {/* =====================================================
          PREVIOUS SESSION BRIEFING
         ===================================================== */}

      {briefing &&
      (workout?.records.length ?? 0) ===
        0 ? (
        <Briefing
          ptSessionId={session.id}
          briefing={briefing}
          canCopy={!cancelled}
        />
      ) : null}

      {/* =====================================================
          CANCELLED
         ===================================================== */}

      {cancelled ? (
        <section className="mt-6">
          <div className="rounded-2xl border border-dashed border-border px-4 py-5">
            <p className="text-sm font-semibold">
              취소한 수업이에요.
            </p>

            <p className="mt-1 text-xs text-muted-foreground">
              운동을 기록하려면 먼저
              수업을 되살려 주세요.
            </p>
          </div>
        </section>
      ) : (
        <section className="mt-6">
          {/* =================================================
              WORKOUT HEADER
             ================================================= */}

          <div className="flex items-end justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold">
                  오늘 한 운동
                </h2>

                {recordCount >
                0 ? (
                  <span className="text-xs font-semibold text-muted-foreground tabular-nums">
                    {recordCount}개 ·{" "}
                    {setCount}세트
                  </span>
                ) : null}
              </div>

              <p className="mt-0.5 text-xs text-muted-foreground">
                입력한 세트는 바로
                회원 기록에 저장돼요.
              </p>
            </div>

            {workout ? (
              <ClearWorkoutButton
                ptSessionId={
                  session.id
                }
              />
            ) : null}
          </div>

          {/* =================================================
              WORKOUT CONTENT
             ================================================= */}

          {workout ? (
            <div className="mt-3 flex flex-col gap-3">
              {/* ---------------------------------------------
                  EMPTY STATE
                 --------------------------------------------- */}

              {workout.records.length ===
              0 ? (
                <div className="rounded-2xl border border-dashed border-border px-4 py-6 text-center">
                  <div className="mx-auto flex size-11 items-center justify-center rounded-xl bg-secondary">
                    <Dumbbell
                      className="size-5 text-muted-foreground"
                      aria-hidden
                    />
                  </div>

                  <p className="mt-3 text-sm font-bold">
                    오늘 한 운동을
                    추가해 주세요.
                  </p>

                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    지난 수업 운동을
                    그대로 가져오거나
                    새로운 운동을
                    추가할 수 있어요.
                  </p>
                </div>
              ) : (
                <RecordList
                  sessionId={
                    workout.id
                  }
                  records={
                    workout.records
                  }
                  previousRecords={workout.records.map(
                    (_, index) => {
                      const previous =
                        previousRecords[
                          index
                        ];

                      return previous
                        ? {
                            performedAt:
                              previous.performedAt.toISOString(),
                            sets: previous.sets,
                          }
                        : null;
                    },
                  )}
                  alwaysEditable
                  showCompleteToggle={
                    false
                  }
                  ptOnly={
                    !sharing.sharePersonalWorkout
                  }
                />
              )}

              {/* ---------------------------------------------
                  ADD EXERCISE
                 --------------------------------------------- */}

              <AddExerciseDrawer
                sessionId={
                  workout.id
                }
                bodyPartCounts={
                  bodyPartCounts
                }
                favoriteIds={
                  favoriteIds
                }
                addedExerciseIds={workout.records.map(
                  (record) =>
                    record.exercise
                      .id,
                )}
              />
            </div>
          ) : (
            <div className="mt-3">
              <OpenWorkoutButton
                ptSessionId={
                  session.id
                }
              />
            </div>
          )}
        </section>
      )}

      {/* =====================================================
          SESSION STATUS / REOPEN
         ===================================================== */}

      {!scheduled ? (
        <section className="mt-7">
          <div className="rounded-xl border border-border px-3.5 py-3">
            <p className="text-xs text-muted-foreground">
              {done
                ? `완료로 처리했어요. ${session.usedSessions}/${session.totalSessions}회차`
                : session.status ===
                    "NO_SHOW"
                  ? "노쇼로 처리했어요."
                  : "취소한 수업이에요."}
            </p>
          </div>

          <div className="mt-2">
            <ReopenSessionButton
              ptSessionId={
                session.id
              }
            />
          </div>
        </section>
      ) : null}

      {/* =====================================================
          JOURNAL
         =====================================================

         중요:
         - writeJournalAction 사용하지 않음
         - 이미 만들어진 알림장이 있으면 해당 알림장으로 이동
         - 없으면 기존 알림장 작성 페이지로 Link 이동
         */}

      {done &&
      session.connectionId ? (
        <section className="mt-7 rounded-2xl border border-border p-4">
          <div>
            <p className="text-sm font-bold">
              수업이 끝났어요
            </p>

            <p className="mt-1 text-xs text-muted-foreground">
              운동 {recordCount}개 ·{" "}
              {setCount}세트가
              저장됐어요.
            </p>
          </div>

          <div className="mt-4">
            {session.journalId ? (
              <Link
                href={`/trainer/journals/${session.journalId}`}
                className="flex h-12 w-full items-center justify-center gap-1.5 rounded-xl border border-border text-sm font-bold transition-colors hover:bg-secondary"
              >
                <NotebookPen
                  className="size-4"
                  aria-hidden
                />

                {session.journalStatus ===
                "PUBLISHED"
                  ? "알림장 수정"
                  : "알림장 이어 쓰기"}
              </Link>
            ) : (
              <form action={writeJournalAction}>
  <input
    type="hidden"
    name="ptSessionId"
    value={session.id}
  />

  <input
    type="hidden"
    name="connectionId"
    value={session.connectionId}
  />

  <button
    type="submit"
    className="flex h-12 w-full items-center justify-center gap-1.5 rounded-xl border border-border text-sm font-bold transition-colors hover:bg-secondary"
  >
    <NotebookPen
      className="size-4"
      aria-hidden
    />

    알림장 쓰기
  </button>
</form>
            )}
          </div>

          <p className="mt-2 text-center text-xs text-muted-foreground">
            지금 작성하지 않아도 괜찮아요.
            운동 기록은 이미 저장됐어요.
          </p>
        </section>
      ) : null}

      {/* =====================================================
          MEMBER DETAIL
         ===================================================== */}

      {!scheduled &&
      session.connectionId ? (
        <Link
          href={`/trainer/members/${session.connectionId}`}
          className="mt-4 flex h-11 items-center justify-center gap-1.5 rounded-xl text-sm font-semibold text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          <Dumbbell
            className="size-4"
            aria-hidden
          />

          {session.memberName} 회원 보기
        </Link>
      ) : null}

      {/* =====================================================
          STICKY FINISH
         ===================================================== */}

      {scheduled ? (
        <div
          className="sticky z-30 -mx-5 mt-8 border-t border-border bg-card/95 px-5 pt-3 pb-3 backdrop-blur"
          style={{
            bottom:
              "calc(4.25rem + env(safe-area-inset-bottom))",
          }}
        >
          <FinishSessionDrawer
            ptSessionId={
              session.id
            }
            memberName={
              session.memberName
            }
            remaining={
              remaining
            }
          />

          <p className="mt-2 text-center text-xs text-muted-foreground">
            {setCount > 0
              ? `${recordCount}개 운동 · ${setCount}세트 저장됨`
              : "적은 세트는 바로 저장돼요"}
          </p>
        </div>
      ) : null}
    </main>
  );
}