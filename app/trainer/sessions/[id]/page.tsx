import Link from "next/link";
import { notFound } from "next/navigation";

import { AlertCircle, Check, ChevronLeft, Dumbbell, NotebookPen } from "lucide-react";

import { requireUser } from "@/app/lib/dal";
import { formatKstDateLabel, toKstTimeValue } from "@/lib/date";
import { getBodyPartCounts } from "@/server/exercises/exercise.service";
import { PTError, SESSION_STATUS_LABEL } from "@/server/pt/pt.service";
import {
  getSessionRecord,
  getSessionWorkout,
} from "@/server/pt/session-record.service";
import { getSharingForTrainer } from "@/server/sharing/sharing.service";
import { TrainerError } from "@/server/trainers/trainer.service";
import { getFavoriteExerciseIds } from "@/server/workouts/favorite.service";
import { getLastRecord } from "@/server/workouts/workout.service";

import { AddExerciseDrawer } from "@/app/(user)/workouts/[id]/add-exercise-drawer";
import { RecordList } from "@/app/(user)/workouts/[id]/record-list";

import { writeJournalAction } from "./actions";
import { ClearWorkoutButton } from "./clear-workout-button";
import {
  FinishSessionDrawer,
  ReopenSessionButton,
} from "./finish-session-drawer";
import { OpenWorkoutButton } from "./open-workout-button";

export const metadata = { title: "수업 기록 | FitNote" };

/**
 * 수업 중에 쓰는 화면.
 *
 * 여기서 할 수 있는 일은 둘뿐이다 — 방금 든 무게를 적는 것, 그리고 수업이
 * 끝났다고 누르는 것. 글은 없다. 수업하면서 폰을 들고 있는 시간은 한 번에
 * 몇 초이고, 그 사이에 고를 것이 많으면 아예 안 쓰게 된다.
 *
 * 알림장은 이 화면에서 권하기만 하고 강제하지 않는다. 운동 기록은 저장됐고
 * 알림장은 저녁에 써도 된다. 둘을 묶어 두면 바쁜 날 둘 다 안 남는다.
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
    if (error instanceof PTError || error instanceof TrainerError) {
      notFound();
    }
    throw error;
  }

  const cancelled = session.status === "CANCELLED";
  const done = session.status === "COMPLETED";
  const scheduled = session.status === "SCHEDULED";

  const workout = cancelled ? null : await getSessionWorkout(user.id, id);

  /*
    직전 기록 힌트에 회원의 개인 운동이 섞이면 공유 설정을 지나간다. 공유를 꺼
    둔 회원이면 PT 수업에서 든 무게만 힌트로 쓴다.
  */
  const sharing = session.connectionId
    ? await getSharingForTrainer(user.id, session.connectionId)
    : { sharePersonalWorkout: false };

  const [previousRecords, bodyPartCounts, favoriteIds] = await Promise.all([
    Promise.all(
      (workout?.records ?? []).map((record) =>
        getLastRecord(session.memberUserId, record.exercise.id, workout!.id, {
          ptOnly: !sharing.sharePersonalWorkout,
        }),
      ),
    ),
    workout ? getBodyPartCounts() : Promise.resolve({}),
    // 트레이너 자신의 즐겨찾기다. 자주 처방하는 운동을 빨리 찾으라고 둔다.
    workout ? getFavoriteExerciseIds(user.id) : Promise.resolve([]),
  ]);

  const remaining = Math.max(session.totalSessions - session.usedSessions, 0);
  const recordCount = workout?.records.length ?? 0;
  const setCount =
    workout?.records.reduce((sum, record) => sum + record.sets.length, 0) ?? 0;

  return (
    <main className="px-5 pt-4 pb-16">
      {session.connectionId ? (
        <Link
          href={`/trainer/members/${session.connectionId}`}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground"
        >
          <ChevronLeft className="size-4" aria-hidden />
          {session.memberName}
        </Link>
      ) : (
        <p className="text-sm text-muted-foreground">{session.memberName}</p>
      )}

      <div className="mt-3 flex items-baseline justify-between gap-2">
        <h1 className="text-xl font-bold">수업 기록</h1>
        <span className="shrink-0 text-sm text-muted-foreground">
          {formatKstDateLabel(session.scheduledAt)}
        </span>
      </div>

      <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
        <span className="font-semibold text-foreground tabular-nums">
          {toKstTimeValue(session.scheduledAt)}
        </span>
        <span className="tabular-nums">{session.durationMinutes}분</span>
        <span aria-hidden>·</span>
        <span className="tabular-nums">{session.sessionNumber}회차</span>
        {!scheduled ? (
          <span className="rounded-full bg-secondary px-1.5 py-0.5 text-[0.6875rem] font-semibold">
            {SESSION_STATUS_LABEL[session.status]}
          </span>
        ) : null}
      </p>

      {query.done ? (
        <p className="mt-3 flex items-center gap-1.5 rounded-xl bg-accent px-3.5 py-2.5 text-sm font-bold text-brand-strong">
          <Check className="size-4" aria-hidden />
          {query.done === "complete"
            ? `완료했어요. ${session.usedSessions}/${session.totalSessions}회차`
            : query.done === "no_show"
              ? "노쇼로 저장했어요."
              : query.done === "cancel"
                ? "취소로 저장했어요."
                : "예정으로 되돌렸어요."}
        </p>
      ) : null}

      {query.error ? (
        <p className="mt-3 flex items-center gap-1.5 rounded-xl border border-destructive px-3.5 py-2.5 text-sm font-medium text-destructive">
          <AlertCircle className="size-4 shrink-0" aria-hidden />
          {query.error}
        </p>
      ) : null}

      {cancelled ? (
        <p className="mt-5 rounded-xl border border-dashed border-border px-3.5 py-3 text-sm text-muted-foreground">
          취소한 수업이에요. 운동을 적으려면 먼저 수업을 되살려 주세요.
        </p>
      ) : (
        <section className="mt-6">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-bold">오늘 한 운동</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                적는 대로 회원의 운동 기록에 PT 로 남아요.
              </p>
            </div>
            {workout ? <ClearWorkoutButton ptSessionId={session.id} /> : null}
          </div>

          {workout ? (
            <div className="mt-3 flex flex-col gap-3">
              {workout.records.length === 0 ? (
                <p className="rounded-xl border border-dashed border-border px-3.5 py-2.5 text-xs text-muted-foreground">
                  아래에서 운동을 골라 무게와 횟수를 적어 주세요.
                </p>
              ) : (
                <RecordList
                  sessionId={workout.id}
                  records={workout.records}
                  previousRecords={workout.records.map((_, index) => {
                    const previous = previousRecords[index];
                    return previous
                      ? {
                          performedAt: previous.performedAt.toISOString(),
                          sets: previous.sets,
                        }
                      : null;
                  })}
                  alwaysEditable
                  showCompleteToggle={false}
                  ptOnly={!sharing.sharePersonalWorkout}
                />
              )}

              <AddExerciseDrawer
                sessionId={workout.id}
                bodyPartCounts={bodyPartCounts}
                favoriteIds={favoriteIds}
                addedExerciseIds={workout.records.map(
                  (record) => record.exercise.id,
                )}
              />
            </div>
          ) : (
            <div className="mt-3">
              <OpenWorkoutButton ptSessionId={session.id} />
            </div>
          )}
        </section>
      )}

      {/*
        되돌리는 길을 옆에 둔다.

        잘못 눌렀을 때 계약 상세까지 찾아가야 하면, 다음부터는 누르기 전에
        망설이게 된다. 되돌릴 수 있어야 편하게 누른다.
      */}
      {!scheduled ? (
        <div className="mt-7">
          <p className="rounded-xl border border-border px-3.5 py-2.5 text-xs text-muted-foreground">
            {done
              ? `완료로 처리했어요. ${session.usedSessions}/${session.totalSessions}회차`
              : session.status === "NO_SHOW"
                ? "노쇼로 처리했어요."
                : "취소한 수업이에요."}
          </p>
          <div className="mt-2">
            <ReopenSessionButton ptSessionId={session.id} />
          </div>
        </div>
      ) : null}

      {/*
        알림장은 여기서 권하기만 한다.

        완료를 누르자마자 알림장으로 던져 버리면, 안 쓰고 나갔을 때 빈 초안이
        남아 할 일에 "쓰는 중" 으로 뜬다. 쓰겠다고 누른 사람만 초안을 만든다.
      */}
      {done && session.connectionId ? (
        <div className="mt-7">
          {session.journalId ? (
            <Link
              href={`/trainer/journals/${session.journalId}`}
              className="flex h-12 w-full items-center justify-center gap-1.5 rounded-xl border border-border text-sm font-bold"
            >
              <NotebookPen className="size-4" aria-hidden />
              {session.journalStatus === "PUBLISHED"
                ? "알림장 수정"
                : "알림장 이어 쓰기"}
            </Link>
          ) : (
            <form action={writeJournalAction}>
              <input type="hidden" name="ptSessionId" value={session.id} />
              <input
                type="hidden"
                name="connectionId"
                value={session.connectionId}
              />
              <button
                type="submit"
                className="flex h-12 w-full items-center justify-center gap-1.5 rounded-xl border border-border text-sm font-bold"
              >
                <NotebookPen className="size-4" aria-hidden />
                알림장 쓰기
              </button>
            </form>
          )}
          <p className="mt-2 text-center text-xs text-muted-foreground">
            수업 끝나고 적어도 돼요. 운동 기록은 이미 저장됐어요.
          </p>
        </div>
      ) : null}

      {session.connectionId ? (
        <Link
          href={`/trainer/members/${session.connectionId}`}
          className="mt-4 flex h-11 items-center justify-center gap-1.5 rounded-xl text-sm font-semibold text-muted-foreground"
        >
          <Dumbbell className="size-4" aria-hidden />
          {session.memberName} 회원 보기
        </Link>
      ) : null}

      {/*
        수업 마무리는 화면 아래에 고정한다.

        운동을 다섯 개 적으면 화면이 세 번 넘게 스크롤된다. 마무리 버튼이
        그 끝에 있으면 수업이 끝나고 다음 회원이 들어오는 2분 사이에 거기까지
        내려갈 일이 없다. 그래서 안 누르고, 차감이 밀리고, 나중에 몇 회 남았는지
        아무도 확신하지 못하게 된다.

        차감 시점이 애매한 게 아니라 화면이 "이제 끝났다" 를 안 물어본 것이다.
        늘 보이는 자리에 두면 그 질문이 매번 눈에 들어온다.

        저장이 아니라는 점은 그대로다. 세트는 적는 즉시 저장되고, 이 버튼은
        "이 수업이 어떻게 끝났는가" 만 정한다.
      */}
      {scheduled ? (
        <div
          className="sticky z-30 -mx-5 mt-8 border-t border-border bg-card/95 px-5 pt-3 pb-3 backdrop-blur"
          style={{ bottom: "calc(4.25rem + env(safe-area-inset-bottom))" }}
        >
          <FinishSessionDrawer
            ptSessionId={session.id}
            memberName={session.memberName}
            remaining={remaining}
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
