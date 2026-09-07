import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { requireUser } from "@/app/lib/dal";
import { formatKstDateLabel } from "@/lib/date";
import { ElapsedTime } from "@/components/elapsed-time";
import { getBodyPartCounts } from "@/server/exercises/exercise.service";
import { getFavoriteExerciseIds } from "@/server/workouts/favorite.service";
import { getLastRecord, getSessionById } from "@/server/workouts/workout.service";

import { AddExerciseDrawer } from "./add-exercise-drawer";
import { FinishWorkoutButton } from "./finish-workout-button";
import { RecordList } from "./record-list";

export const metadata = {
  title: "운동 기록 | FitNote",
};

export default async function WorkoutSessionPage({
  params,
}: PageProps<"/workouts/[id]">) {
  const user = await requireUser();
  const { id } = await params;

  const session = await getSessionById(user.id, id);

  if (!session) {
    notFound();
  }

  const inProgress = session.status === "IN_PROGRESS";
  const manual = session.entryMode === "MANUAL";

  /**
   * 운동마다 직전 기록을 붙인다.
   * [userId, exerciseId, createdAt DESC] 인덱스를 타고, 한 세션의 운동 수는
   * 많아야 열 개 남짓이라 병렬로 한 번에 가져온다.
   */
  const [previousRecords, bodyPartCounts, favoriteIds] = await Promise.all([
    Promise.all(
      session.records.map((record) =>
        getLastRecord(user.id, record.exercise.id, session.id),
      ),
    ),
    // 운동 추가 드로어의 "부위로 찾기" 첫 화면. 여기서 미리 넘겨 두면
    // 드로어를 열자마자 목록이 보인다.
    getBodyPartCounts(),
    getFavoriteExerciseIds(user.id),
  ]);

  return (
    <main className="flex flex-col gap-4 px-5 pt-6">
      <header className="flex items-center gap-2">
        <Link
          href="/home"
          aria-label="홈으로"
          className="-ml-2 flex size-9 items-center justify-center rounded-xl text-muted-foreground"
        >
          <ChevronLeft className="size-5" />
        </Link>
        <h1 className="text-lg font-bold">
          {manual
            ? formatKstDateLabel(session.startedAt)
            : inProgress
              ? "운동 중"
              : "운동 기록"}
        </h1>
        {manual && inProgress ? (
          <span className="rounded-full bg-accent px-2.5 py-1 text-xs font-semibold text-accent-foreground">
            기록 입력 중
          </span>
        ) : null}
      </header>

      <section className="rounded-2xl border border-border bg-card p-5">
        <dl className="grid grid-cols-3 gap-2 text-center">
          <div>
            <dt className="text-xs text-muted-foreground">시간</dt>
            <dd className="mt-1 text-lg font-bold">
              {session.elapsedSec !== null && inProgress ? (
                <ElapsedTime initialSeconds={session.elapsedSec} />
              ) : session.durationSec !== null ? (
                `${Math.round(session.durationSec / 60)}분`
              ) : (
                // 몰아서 입력한 기록에는 실제 운동 시간이 없다.
                // 0분이라고 적으면 거짓말이 된다.
                "—"
              )}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">세트</dt>
            <dd className="mt-1 text-lg font-bold tabular-nums">
              {session.totalSets}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">볼륨</dt>
            <dd className="mt-1 text-lg font-bold tabular-nums">
              {session.totalVolume.toLocaleString()}
              <span className="ml-0.5 text-xs font-medium text-muted-foreground">
                kg
              </span>
            </dd>
          </div>
        </dl>
      </section>

      {session.records.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border px-5 py-10 text-center text-sm text-muted-foreground">
          {inProgress
            ? "운동을 추가해서 기록을 시작해보세요"
            : "기록한 운동이 없어요"}
        </p>
      ) : (
        <RecordList
          sessionId={session.id}
          alwaysEditable={inProgress}
          addSlot={
            <AddExerciseDrawer
              sessionId={session.id}
              bodyPartCounts={bodyPartCounts}
              favoriteIds={favoriteIds}
            />
          }
          records={session.records}
          previousRecords={session.records.map((_, index) => {
            const previous = previousRecords[index];
            return previous
              ? {
                  performedAt: previous.performedAt.toISOString(),
                  sets: previous.sets,
                }
              : null;
          })}
        />
      )}

      {inProgress ? (
        <div className="flex flex-col gap-2 pt-1">
          <AddExerciseDrawer
            sessionId={session.id}
            bodyPartCounts={bodyPartCounts}
            favoriteIds={favoriteIds}
          />
          <FinishWorkoutButton sessionId={session.id} manual={manual} />
        </div>
      ) : null}
    </main>
  );
}
