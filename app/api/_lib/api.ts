import "server-only";

import { NextResponse } from "next/server";

import { getCurrentUser } from "@/app/lib/dal";
import { WorkoutError } from "@/server/workouts/workout.service";

/**
 * API 라우트용 인증 헬퍼.
 *
 * dal 의 requireUser/verifySession 은 redirect() 를 호출하므로
 * API 에서 그대로 쓰면 JSON 대신 리다이렉트 응답이 나간다.
 * 여기서는 401 JSON 을 돌려준다.
 */
export async function requireApiUser() {
  const user = await getCurrentUser();

  if (!user) {
    return {
      user: null,
      response: NextResponse.json(
        { success: false, error: "로그인이 필요합니다." },
        { status: 401 },
      ),
    } as const;
  }

  return { user, response: null } as const;
}

export function ok<T extends object>(data: T, status = 200) {
  return NextResponse.json({ success: true, ...data }, { status });
}

export function fail(error: string, status: number, code?: string) {
  return NextResponse.json({ success: false, error, code }, { status });
}

/** 서비스에서 올라온 예외를 상태 코드로 변환한다. */
export function handleWorkoutError(error: unknown, context: string) {
  if (error instanceof WorkoutError) {
    const status =
      error.code === "EXERCISE_NOT_FOUND" || error.code === "ROUTINE_NOT_FOUND"
        ? 404
        : 409;

    return fail(error.message, status, error.code);
  }

  console.error(`${context} error:`, error);
  return fail("요청을 처리하지 못했습니다.", 500);
}

export async function readJson(request: Request) {
  try {
    return (await request.json()) as unknown;
  } catch {
    return null;
  }
}
