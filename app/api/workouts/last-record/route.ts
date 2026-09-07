import { NextRequest } from "next/server";

import { fail, handleWorkoutError, ok, requireApiUser } from "@/app/api/_lib/api";
import { getLastRecord } from "@/server/workouts/workout.service";

/**
 * 특정 운동의 직전 기록.
 * 운동을 추가하기 전에 "지난번 60kg × 10" 을 미리 보여줄 때 사용한다.
 */
export async function GET(request: NextRequest) {
  const { user, response } = await requireApiUser();
  if (!user) return response;

  const exerciseId = request.nextUrl.searchParams.get("exerciseId");

  if (!exerciseId) {
    return fail("exerciseId 가 필요합니다.", 400);
  }

  const excludeSessionId =
    request.nextUrl.searchParams.get("excludeSessionId") ?? undefined;

  try {
    const previousRecord = await getLastRecord(
      user.id,
      exerciseId,
      excludeSessionId,
    );

    return ok({ previousRecord });
  } catch (error) {
    return handleWorkoutError(error, "GET /api/workouts/last-record");
  }
}
