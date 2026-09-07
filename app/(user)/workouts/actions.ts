"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireUser } from "@/app/lib/dal";
import { SetInputSchema } from "@/server/workouts/workout.schema";
import { toggleFavorite } from "@/server/workouts/favorite.service";
import {
  addRecord,
  addRecords,
  addSet,
  deleteRecord,
  deleteSet,
  finishSession,
  openManualSession,
  startSession,
  updateSet,
  WorkoutError,
  type SetInput,
  type StartSessionMode,
} from "@/server/workouts/workout.service";

export type StartWorkoutResult =
  | {
      conflict: true;
      activeSession: { id: string; elapsedSec: number; exerciseCount: number };
    }
  | { conflict: false; error: string };

/**
 * 운동 세션 시작.
 *
 * mode "ask" 로 먼저 시도해 진행중 세션이 있으면 사용자에게 물어본다.
 * 성공하면 세션 화면으로 보내므로 정상 경로에서는 값을 반환하지 않는다.
 */
export async function startWorkout(
  mode: StartSessionMode = "ask",
): Promise<StartWorkoutResult> {
  const user = await requireUser();

  const result = await startSession(user.id, { mode });

  if (result.conflict) {
    const active = result.activeSession;

    if (active) {
      return {
        conflict: true,
        activeSession: {
          id: active.id,
          elapsedSec: active.elapsedSec ?? 0,
          exerciseCount: active.records.length,
        },
      };
    }
  } else if (result.session) {
    revalidatePath("/home");
    redirect(`/workouts/${result.session.id}`);
  }

  return { conflict: false, error: "운동을 시작하지 못했습니다." };
}

/**
 * 지난 날짜 운동을 몰아서 기록한다.
 *
 * 실시간 세션과 달리 진행중 충돌을 따지지 않는다. 어제 기록을 입력하는 것은
 * 오늘 운동을 하는 것과 별개의 일이다.
 */
export async function startManualWorkout(dateKey: string) {
  const user = await requireUser();

  let sessionId: string;

  try {
    const session = await openManualSession(user.id, dateKey);
    sessionId = session.id;
  } catch (error) {
    if (error instanceof WorkoutError) {
      return { error: error.message };
    }

    console.error("startManualWorkout error:", error);
    return { error: "기록을 시작하지 못했습니다." };
  }

  revalidatePath("/home");
  redirect(`/workouts/${sessionId}`);
}

export async function finishWorkout(sessionId: string) {
  const user = await requireUser();

  await finishSession(user.id, sessionId);

  revalidatePath("/home");
  revalidatePath("/calendar");
  redirect("/home");
}

export type ActionResult = { error: string | null };

/**
 * 세션 하위 변경의 공통 처리.
 *
 * 서비스는 소유권이 없거나 대상이 없으면 null 을 돌려주고,
 * 의미 있는 실패는 WorkoutError 로 던진다. 둘 다 화면 문구로 바꾼다.
 */
async function run(
  sessionId: string,
  fn: (userId: string) => Promise<unknown>,
): Promise<ActionResult> {
  const user = await requireUser();

  try {
    if ((await fn(user.id)) === null) {
      return { error: "대상을 찾을 수 없습니다." };
    }
  } catch (error) {
    if (error instanceof WorkoutError) {
      return { error: error.message };
    }

    console.error(`workout action (${sessionId}) error:`, error);
    return { error: "요청을 처리하지 못했습니다." };
  }

  revalidatePath(`/workouts/${sessionId}`);
  revalidatePath("/home");

  return { error: null };
}

export async function addExerciseToSession(
  sessionId: string,
  exerciseId: string,
) {
  return run(sessionId, (userId) =>
    addRecord(userId, sessionId, { exerciseId }),
  );
}

/** 고른 운동을 한 번에 담는다. */
export async function addExercisesToSession(
  sessionId: string,
  exerciseIds: string[],
) {
  if (exerciseIds.length === 0) {
    return { error: "운동을 선택해 주세요." };
  }

  return run(sessionId, (userId) => addRecords(userId, sessionId, exerciseIds));
}

/**
 * 즐겨찾기 토글.
 *
 * 세션에 담는 것과 무관하므로 세션 검증을 태우지 않는다.
 */
export async function toggleExerciseFavorite(exerciseId: string) {
  const user = await requireUser();

  const favorited = await toggleFavorite(user.id, exerciseId);

  if (favorited === null) {
    return { error: "운동을 찾을 수 없습니다." };
  }

  return { error: null, favorited };
}

export async function removeExerciseFromSession(
  sessionId: string,
  recordId: string,
) {
  return run(sessionId, async (userId) =>
    (await deleteRecord(userId, recordId)) ? true : null,
  );
}

function parseSet(input: SetInput) {
  const parsed = SetInputSchema.safeParse(input);

  return parsed.success
    ? { data: parsed.data as SetInput, error: null }
    : {
        data: null,
        error: parsed.error.issues[0]?.message ?? "잘못된 값입니다.",
      };
}

export async function addSetToRecord(
  sessionId: string,
  recordId: string,
  input: SetInput,
): Promise<ActionResult> {
  const { data, error } = parseSet(input);
  if (!data) return { error };

  return run(sessionId, (userId) => addSet(userId, recordId, data));
}

export async function updateSetValues(
  sessionId: string,
  setId: string,
  input: SetInput,
): Promise<ActionResult> {
  const { data, error } = parseSet(input);
  if (!data) return { error };

  return run(sessionId, (userId) => updateSet(userId, setId, data));
}

export async function removeSet(sessionId: string, setId: string) {
  return run(sessionId, (userId) => deleteSet(userId, setId));
}
