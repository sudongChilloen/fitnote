import { NextRequest } from "next/server";

import {
  fail,
  handleWorkoutError,
  ok,
  readJson,
  requireApiUser,
} from "@/app/api/_lib/api";
import { AddRecordSchema } from "@/server/workouts/workout.schema";
import { addRecord } from "@/server/workouts/workout.service";

/** 세션에 운동 추가. 직전 기록을 함께 반환해 값을 미리 채울 수 있게 한다. */
export async function POST(
  request: NextRequest,
  context: RouteContext<"/api/workouts/sessions/[id]/records">,
) {
  const { user, response } = await requireApiUser();
  if (!user) return response;

  const { id } = await context.params;

  const parsed = AddRecordSchema.safeParse((await readJson(request)) ?? {});

  if (!parsed.success) {
    return fail("잘못된 요청입니다.", 400);
  }

  try {
    const result = await addRecord(user.id, id, parsed.data);

    if (!result) {
      return fail("세션을 찾을 수 없습니다.", 404);
    }

    return ok(result, 201);
  } catch (error) {
    return handleWorkoutError(
      error,
      "POST /api/workouts/sessions/[id]/records",
    );
  }
}
