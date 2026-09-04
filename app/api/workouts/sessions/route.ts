import { NextRequest } from "next/server";

import {
  fail,
  handleWorkoutError,
  ok,
  readJson,
  requireApiUser,
} from "@/app/api/_lib/api";
import {
  ListSessionsSchema,
  StartSessionSchema,
} from "@/server/workouts/workout.schema";
import { listSessions, startSession } from "@/server/workouts/workout.service";

/** 지난 운동 기록 목록 */
export async function GET(request: NextRequest) {
  const { user, response } = await requireApiUser();
  if (!user) return response;

  const parsed = ListSessionsSchema.safeParse(
    Object.fromEntries(request.nextUrl.searchParams),
  );

  if (!parsed.success) {
    return fail("잘못된 조회 조건입니다.", 400);
  }

  try {
    const result = await listSessions(user.id, parsed.data);
    return ok(result);
  } catch (error) {
    return handleWorkoutError(error, "GET /api/workouts/sessions");
  }
}

/** 운동 세션 시작 */
export async function POST(request: NextRequest) {
  const { user, response } = await requireApiUser();
  if (!user) return response;

  const body = (await readJson(request)) ?? {};
  const parsed = StartSessionSchema.safeParse(body);

  if (!parsed.success) {
    return fail("잘못된 요청입니다.", 400);
  }

  try {
    const result = await startSession(user.id, parsed.data);

    // 진행중 세션이 있으면 409 로 알려 사용자가 선택하게 한다.
    if (result.conflict) {
      return ok({ conflict: true, activeSession: result.activeSession }, 409);
    }

    return ok({ session: result.session }, 201);
  } catch (error) {
    return handleWorkoutError(error, "POST /api/workouts/sessions");
  }
}
