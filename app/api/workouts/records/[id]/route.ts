import { NextRequest } from "next/server";

import {
  fail,
  handleWorkoutError,
  ok,
  readJson,
  requireApiUser,
} from "@/app/api/_lib/api";
import { SetInputSchema } from "@/server/workouts/workout.schema";
import { addSet, deleteRecord } from "@/server/workouts/workout.service";

/** 세트 추가 */
export async function POST(
  request: NextRequest,
  context: RouteContext<"/api/workouts/records/[id]">,
) {
  const { user, response } = await requireApiUser();
  if (!user) return response;

  const { id } = await context.params;

  const parsed = SetInputSchema.safeParse((await readJson(request)) ?? {});

  if (!parsed.success) {
    return fail(
      parsed.error.issues[0]?.message ?? "잘못된 세트 값입니다.",
      400,
    );
  }

  try {
    const record = await addSet(user.id, id, parsed.data);

    if (!record) {
      return fail("기록을 찾을 수 없습니다.", 404);
    }

    return ok({ record }, 201);
  } catch (error) {
    return handleWorkoutError(error, "POST /api/workouts/records/[id]");
  }
}

/** 세션에서 운동 제거 */
export async function DELETE(
  request: NextRequest,
  context: RouteContext<"/api/workouts/records/[id]">,
) {
  const { user, response } = await requireApiUser();
  if (!user) return response;

  const { id } = await context.params;

  try {
    const deleted = await deleteRecord(user.id, id);

    if (!deleted) {
      return fail("기록을 찾을 수 없습니다.", 404);
    }

    return ok({ deleted: true });
  } catch (error) {
    return handleWorkoutError(error, "DELETE /api/workouts/records/[id]");
  }
}
