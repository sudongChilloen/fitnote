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

import { ClearWorkoutButton } from "./clear-workout-button";
import { OpenWorkoutButton } from "./open-workout-button";
import { completeSessionAction, writeJournalAction } from "./actions";

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

      {query.completed === "1" ? (
        <p className="mt-3 flex items-center gap-1.5 rounded-xl bg-accent px-3.5 py-2.5 text-sm font-bold text-brand-strong">
          <Check className="size-4" aria-hidden />
          수업을 완료했어요. {session.usedSessions}/{session.totalSessions}회차
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
        수업 완료는 저장이 아니다.

        세트는 적는 즉시 저장되고 있다. 이 버튼이 하는 일은 "이 수업 한 회를
        썼다" 뿐이라, 눌러야 하는 이유를 숫자로 적어 둔다. 안 눌러도 운동 기록은
        남고, 대신 홈의 할 일에 "완료 안 한 수업" 으로 올라온다.
      */}
      {scheduled ? (
        <form action={completeSessionAction} className="mt-7">
          <input type="hidden" name="ptSessionId" value={session.id} />
          <button
            type="submit"
            className="flex h-12 w-full items-center justify-center gap-1.5 rounded-xl bg-primary text-sm font-bold text-primary-foreground"
          >
            <Check className="size-4" aria-hidden />
            수업 완료
          </button>
          <p className="mt-2 text-center text-xs text-muted-foreground">
            누르면 PT 횟수가 한 회 깎여요. 남은 {remaining}회 →{" "}
            {Math.max(remaining - 1, 0)}회
          </p>
        </form>
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
    </main>
  );
}
