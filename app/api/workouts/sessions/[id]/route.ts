import { NextRequest } from "next/server";

import {
  fail,
  handleWorkoutError,
  ok,
  readJson,
  requireApiUser,
} from "@/app/api/_lib/api";
import { WorkoutSessionStatus } from "@/generated/prisma/enums";
import { UpdateSessionSchema } from "@/server/workouts/workout.schema";
import {
  finishSession,
  getSessionById,
  updateSessionMemo,
} from "@/server/workouts/workout.service";

export async function GET(
  request: NextRequest,
  context: RouteContext<"/api/workouts/sessions/[id]">,
) {
  const { user, response } = await requireApiUser();
  if (!user) return response;

  const { id } = await context.params;

  try {
    const session = await getSessionById(user.id, id);

    if (!session) {
      return fail("세션을 찾을 수 없습니다.", 404);
    }

    return ok({ session });
  } catch (error) {
    return handleWorkoutError(error, "GET /api/workouts/sessions/[id]");
  }
}

/** 세션 종료 / 취소 / 메모 수정 */
export async function PATCH(
  request: NextRequest,
  context: RouteContext<"/api/workouts/sessions/[id]">,
) {
  const { user, response } = await requireApiUser();
  if (!user) return response;

  const { id } = await context.params;

  const parsed = UpdateSessionSchema.safeParse((await readJson(request)) ?? {});

  if (!parsed.success) {
    return fail("잘못된 요청입니다.", 400);
  }

  const { action, memo } = parsed.data;

  try {
    const session =
      action === "memo"
        ? await updateSessionMemo(user.id, id, memo ?? null)
        : await finishSession(
            user.id,
            id,
            action === "finish"
              ? WorkoutSessionStatus.COMPLETED
              : WorkoutSessionStatus.CANCELLED,
          );

    if (!session) {
      return fail("세션을 찾을 수 없습니다.", 404);
    }

    return ok({ session });
  } catch (error) {
    return handleWorkoutError(error, "PATCH /api/workouts/sessions/[id]");
  }
}
