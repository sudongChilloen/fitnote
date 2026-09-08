import "server-only";

import { prisma } from "@/lib/prisma";
import { requireTrainerProfile } from "@/server/trainers/trainer.service";
import { getSessionById } from "@/server/workouts/workout.service";

/**
 * 알림장 화면에서 이 수업의 운동 기록을 들여다본다.
 *
 * 읽기만 한다. 적고 고치는 건 수업 기록 화면(`/trainer/sessions/[id]`)이 맡고,
 * 여기서는 "오늘 뭘 시켰더라" 를 보면서 글을 쓰라고 옆에 펴 두는 것뿐이다.
 *
 * 운동 기록은 알림장이 아니라 `PTSession` 에 매달려 있다. 그래서 초안을 지워도
 * 무게는 남고, 알림장을 안 써도 회원의 기록에는 들어간다.
 */

/**
 * 이 알림장에 붙은 운동 기록. 없으면 null.
 *
 * 회원 화면과 같은 모양으로 준다. 트레이너가 보는 세트 카드와 회원이 보는
 * 세트 카드가 다른 코드로 그려지면 언젠가 한쪽만 고쳐진다.
 */
export async function getJournalWorkout(userId: string, journalId: string) {
  const trainer = await requireTrainerProfile(userId);

  const journal = await prisma.journal.findFirst({
    where: { id: journalId, trainerProfileId: trainer.id },
    select: { ptSession: { select: { workoutSession: { select: { id: true } } } } },
  });

  const sessionId = journal?.ptSession?.workoutSession?.id;
  if (!sessionId) return null;

  return getSessionById(userId, sessionId);
}
