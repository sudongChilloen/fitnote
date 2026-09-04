import { handleWorkoutError, ok, requireApiUser } from "@/app/api/_lib/api";
import { getActiveSession } from "@/server/workouts/workout.service";

/**
 * 진행중인 세션 조회.
 *
 * 세션을 시작하기 전에 먼저 확인해 "이어서 / 새로 시작" 을 물어보거나,
 * 홈 화면에 "운동 중" 배너를 띄우는 데 쓴다.
 * 진행중 세션이 없는 것은 정상이므로 404 가 아니라 200 + null 을 반환한다.
 *
 * 정적 세그먼트가 [id] 보다 우선하므로 /sessions/[id] 와 충돌하지 않는다.
 */
export async function GET() {
  const { user, response } = await requireApiUser();
  if (!user) return response;

  try {
    return ok({ session: await getActiveSession(user.id) });
  } catch (error) {
    return handleWorkoutError(error, "GET /api/workouts/sessions/active");
  }
}
