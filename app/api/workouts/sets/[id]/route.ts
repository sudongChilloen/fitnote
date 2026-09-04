import { NextRequest } from "next/server";

import {
  fail,
  handleWorkoutError,
  ok,
  readJson,
  requireApiUser,
} from "@/app/api/_lib/api";
import { SetInputSchema } from "@/server/workouts/workout.schema";
import { deleteSet, updateSet } from "@/server/workouts/workout.service";

export async function PATCH(
  request: NextRequest,
  context: RouteContext<"/api/workouts/sets/[id]">,
) {
  const { user, response } = await requireApiUser();
  if (!user) return response;

  const { id } = await context.params;

  const parsed = SetInputSchema.partial().safeParse(
    (await readJson(request)) ?? {},
  );

  if (!parsed.success) {
    return fail(
      parsed.error.issues[0]?.message ?? "잘못된 세트 값입니다.",
      400,
    );
  }

  try {
    const record = await updateSet(user.id, id, parsed.data);

    if (!record) {
      return fail("세트를 찾을 수 없습니다.", 404);
    }

    return ok({ record });
  } catch (error) {
    return handleWorkoutError(error, "PATCH /api/workouts/sets/[id]");
  }
}

export async function DELETE(
  request: NextRequest,
  context: RouteContext<"/api/workouts/sets/[id]">,
) {
  const { user, response } = await requireApiUser();
  if (!user) return response;

  const { id } = await context.params;

  try {
    const record = await deleteSet(user.id, id);

    if (!record) {
      return fail("세트를 찾을 수 없습니다.", 404);
    }

    return ok({ record });
  } catch (error) {
    return handleWorkoutError(error, "DELETE /api/workouts/sets/[id]");
  }
}
