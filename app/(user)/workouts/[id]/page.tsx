import { ChevronLeft, Trophy } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { requireUser } from "@/app/lib/dal";
import { formatKstDateLabel } from "@/lib/date";
import { ElapsedTime } from "@/components/elapsed-time";
import { getBodyPartCounts } from "@/server/exercises/exercise.service";
import { getFavoriteExerciseIds } from "@/server/workouts/favorite.service";
import {
  getLastRecord,
  getSessionById,
  getSessionSummary,
} from "@/server/workouts/workout.service";

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
  const [previousRecords, bodyPartCounts, favoriteIds, summary] =
    await Promise.all([
      Promise.all(
        session.records.map((record) =>
          getLastRecord(user.id, record.exercise.id, session.id),
        ),
      ),
      // 운동 추가 드로어의 "부위로 찾기" 첫 화면. 여기서 미리 넘겨 두면
      // 드로어를 열자마자 목록이 보인다.
      getBodyPartCounts(),
      getFavoriteExerciseIds(user.id),
      // 신기록은 끝난 운동에서만 의미가 있다. 진행 중에는 세트가 계속
      // 바뀌므로 세트를 하나 지울 때마다 배지가 붙었다 떨어진다.
      session.status === "COMPLETED"
        ? getSessionSummary(user.id, session.id)
        : null,
    ]);

  const prCount = summary?.prCount ?? 0;

  const addedExerciseIds = session.records.map((record) => record.exercise.id);

  return (
    <main className="flex flex-col gap-3 px-4 pt-3.5">
      <header className="flex items-center gap-2.5">
        <Link
          href="/home"
          aria-label="홈으로"
          className="flex size-10 shrink-0 items-center justify-center rounded-full border border-border text-ink"
        >
          <ChevronLeft className="size-4.5" />
        </Link>
        <span className="flex min-w-0 flex-1 items-center gap-1.5">
          <h1 className="min-w-0 truncate text-[1.0625rem] font-extrabold">
            {manual
              ? formatKstDateLabel(session.startedAt)
              : inProgress
                ? "운동 중"
                : "운동 기록"}
          </h1>
          {session.isPt ? (
            <span className="shrink-0 rounded-full border border-brand px-2 py-px text-[0.6875rem] font-bold text-primary">
              PT
            </span>
          ) : null}
          {manual && inProgress ? (
            <span className="shrink-0 rounded-full border border-input px-2 py-px text-[0.6875rem] font-bold text-muted-foreground">
              기록 입력 중
            </span>
          ) : null}
        </span>
        {session.elapsedSec !== null && inProgress && !manual ? (
          <span className="shrink-0 rounded-full bg-brand-muted px-3 py-1.5 text-[0.8125rem] font-extrabold text-primary tabular-nums">
            <ElapsedTime initialSeconds={session.elapsedSec} />
          </span>
        ) : null}
      </header>

      {/*
        누가 적어 준 기록인지 밝힌다. 고칠 수 없는 화면을 이유 없이 내놓으면
        회원은 앱이 고장 난 줄 안다.
      */}
      {session.isPt ? (
        <p className="rounded-[0.875rem] bg-[#f7f8f7] px-3 py-2.5 text-xs leading-relaxed text-[#4b5650]">
          {session.recordedByName
            ? `${session.recordedByName} 트레이너가 수업에서 적어 준 기록이에요.`
            : "수업에서 적힌 기록이에요."}{" "}
          고치려면 트레이너에게 말씀해 주세요.
        </p>
      ) : null}

      <dl className="grid grid-cols-3 rounded-[1.125rem] border border-border py-3 text-center">
        <div className="min-w-0 px-1">
          <dt className="text-[0.6875rem] text-muted-foreground">시간</dt>
          <dd className="truncate text-lg font-extrabold tabular-nums">
            {session.elapsedSec !== null && inProgress ? (
              `${Math.floor(session.elapsedSec / 60)}분`
            ) : session.durationSec !== null ? (
              `${Math.round(session.durationSec / 60)}분`
            ) : (
              // 몰아서 입력한 기록에는 실제 운동 시간이 없다. 0분이라고 적으면 거짓말이 된다.
              "—"
            )}
          </dd>
        </div>
        <div className="min-w-0 border-x border-line px-1">
          <dt className="text-[0.6875rem] text-muted-foreground">세트</dt>
          <dd className="truncate text-lg font-extrabold tabular-nums">{session.totalSets}</dd>
        </div>
        <div className="min-w-0 px-1">
          <dt className="text-[0.6875rem] text-muted-foreground">볼륨</dt>
          <dd className="truncate text-lg font-extrabold tabular-nums">
            {session.totalVolume.toLocaleString()}
            <span className="text-[0.6875rem]">kg</span>
          </dd>
        </div>
      </dl>

      {/*
        신기록은 이 운동에서 가장 자랑스러운 한 줄이라 위쪽에 둔다.
        이걸 보려고 요약 화면을 한 번 더 열게 만들 이유가 없다.
      */}
      {prCount > 0 ? (
        <p className="flex h-9.5 items-center justify-center gap-1.5 rounded-full border-[1.5px] border-brand text-[0.8125rem] font-bold text-primary">
          <Trophy className="size-4" aria-hidden />
          신기록 {prCount}개를 세웠어요
        </p>
      ) : null}

      {session.records.length === 0 ? (
        <p className="rounded-[1.375rem] bg-[#f7f8f7] px-5 py-10 text-center text-sm text-muted-foreground">
          {inProgress
            ? "운동을 추가해서 기록을 시작해보세요"
            : "기록한 운동이 없어요"}
        </p>
      ) : (
        <RecordList
          sessionId={session.id}
          alwaysEditable={inProgress}
          readOnly={session.isPt}
          addSlot={
            <AddExerciseDrawer
              sessionId={session.id}
              bodyPartCounts={bodyPartCounts}
              favoriteIds={favoriteIds}
              addedExerciseIds={addedExerciseIds}
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
        <div className="flex flex-col gap-3">
          <AddExerciseDrawer
            sessionId={session.id}
            bodyPartCounts={bodyPartCounts}
            favoriteIds={favoriteIds}
            addedExerciseIds={addedExerciseIds}
          />
          <FinishWorkoutButton sessionId={session.id} manual={manual} />
        </div>
      ) : null}
    </main>
  );
}
