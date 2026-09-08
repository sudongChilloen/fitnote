import "server-only";

import {
  JournalStatus,
  WorkoutEntryMode,
  WorkoutSessionStatus,
} from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import {
  requireMyMemberByUserId,
  requireTrainerProfile,
} from "@/server/trainers/trainer.service";
import { getSessionById } from "@/server/workouts/workout.service";

import { JournalEditError, startJournal } from "./journal-editor.service";

/**
 * 트레이너가 PT 수업에서 한 운동을 회원 대신 적는다.
 *
 * 알림장의 `workoutSummary` 는 "3세트째 자세가 무너졌다" 같은 말을 적는 칸이라
 * 남겨 두고, 무게와 횟수는 회원의 운동 기록으로 들어가게 한다.
 *
 * 이게 중요한 이유는 하나다. PT 수업은 회원의 중량이 가장 많이 오르는 구간인데,
 * 그게 글로만 남으면 "지난 PT 에서 스쿼트 60kg, 오늘 혼자 65kg" 같은 비교를
 * 영영 할 수 없다. 운동 기록은 한 곳에 모여 있어야 의미가 생긴다.
 *
 * 기록의 주인은 회원이다(`WorkoutSession.userId`). 트레이너는 `recordedByUserId`
 * 에만 남는다. 그래야 회원의 캘린더 · 그래프 · 최고 중량에 그대로 합류한다.
 */

/** 수업이 붙지 않은 알림장에는 운동을 적을 수 없다. */
async function requireJournalWithSession(userId: string, journalId: string) {
  const trainer = await requireTrainerProfile(userId);

  const journal = await prisma.journal.findFirst({
    where: { id: journalId, trainerProfileId: trainer.id },
    select: {
      id: true,
      status: true,
      memberUserId: true,
      ptSessionId: true,
      ptSession: {
        select: {
          id: true,
          scheduledAt: true,
          durationMinutes: true,
          status: true,
          workoutSession: { select: { id: true } },
        },
      },
    },
  });

  if (!journal) {
    throw new JournalEditError("NOT_FOUND", "알림장을 찾을 수 없어요.");
  }

  await requireMyMemberByUserId(trainer.id, journal.memberUserId);

  if (!journal.ptSession) {
    throw new JournalEditError(
      "INVALID",
      "먼저 어떤 수업인지 골라 주세요. 수업에 붙어야 회원 기록으로 들어가요.",
    );
  }

  return { trainer, journal, ptSession: journal.ptSession };
}

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

/**
 * 운동 기록을 연다. 이미 있으면 그걸 준다.
 *
 * 처음부터 COMPLETED 로 만든다. 회원이 한 운동이 아니라 이미 끝난 수업을 옮겨
 * 적는 것이라 "진행 중" 인 순간이 없다. 진행 중으로 두면 회원의 기록 목록에
 * 끝나지 않은 운동이 하나 걸려 있게 된다.
 *
 * 시간은 수업 시간을 그대로 쓴다. 회원이 직접 몰아서 적을 때는 소요 시간을
 * 비워 두지만(입력한 시간이 운동 시간이 되어 버리므로), 여기서는 수업이 몇 분
 * 짜리였는지 우리가 이미 알고 있다.
 */
export async function openJournalWorkout(userId: string, journalId: string) {
  const { trainer, journal, ptSession } = await requireJournalWithSession(
    userId,
    journalId,
  );

  if (ptSession.workoutSession) {
    return getSessionById(userId, ptSession.workoutSession.id);
  }

  const durationSec = ptSession.durationMinutes * 60;

  const created = await prisma.workoutSession.create({
    data: {
      userId: journal.memberUserId,
      ptSessionId: ptSession.id,
      recordedByUserId: trainer.userId,
      startedAt: ptSession.scheduledAt,
      endedAt: new Date(ptSession.scheduledAt.getTime() + durationSec * 1000),
      durationSec,
      entryMode: WorkoutEntryMode.MANUAL,
      status: WorkoutSessionStatus.COMPLETED,
    },
    select: { id: true },
  });

  return getSessionById(userId, created.id);
}

/**
 * 운동 기록을 통째로 지운다.
 *
 * 수업을 잘못 골라 붙였을 때 되돌릴 길이 필요하다. 다만 이미 게시한 알림장의
 * 기록은 회원이 봤을 수 있으므로 지우지 않는다 — 회원 입장에서는 어제 본 운동
 * 기록이 소리 없이 사라지는 일이 된다. 세트를 하나씩 고치는 건 여전히 된다.
 */
export async function deleteJournalWorkout(userId: string, journalId: string) {
  const { journal, ptSession } = await requireJournalWithSession(
    userId,
    journalId,
  );

  if (journal.status !== JournalStatus.DRAFT) {
    throw new JournalEditError(
      "PUBLISHED",
      "게시한 알림장의 운동 기록은 지울 수 없어요. 세트는 고칠 수 있어요.",
    );
  }

  if (!ptSession.workoutSession) return false;

  await prisma.workoutSession.delete({
    where: { id: ptSession.workoutSession.id },
  });

  return true;
}

/**
 * "수업 기록" 한 번으로 초안과 운동 기록을 함께 연다.
 *
 * 트레이너가 이 버튼을 누르는 순간은 대개 수업 중이거나 막 끝난 직후이고,
 * 그때 하려는 일은 방금 든 무게를 적는 것이다. 들어가서 "운동 기록 적기" 를
 * 한 번 더 눌러야 하면 그 한 번이 수업 중에는 크다.
 *
 * 빈 운동 기록이 생기는 게 아깝지 않은 이유는, 세트가 하나도 없으면 회원
 * 화면에 운동 없는 PT 한 줄로만 보이고 초안을 지우면 함께 사라지기 때문이다.
 *
 * 수업이 안 붙은 알림장이면 초안만 만든다. 어느 수업에 매달지 알 수 없다.
 */
export async function startSessionRecord(
  userId: string,
  connectionId: string,
  ptSessionId?: string,
) {
  const journalId = await startJournal(userId, connectionId, ptSessionId);

  if (ptSessionId) {
    await openJournalWorkout(userId, journalId);
  }

  return journalId;
}
