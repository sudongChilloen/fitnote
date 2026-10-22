import "server-only";

import {
  PTContractStatus,
  PTSessionActor,
  PTSessionStatus,
  NotificationType,
} from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { createNotification } from "@/server/notifications/notification.service";
import { lockPTContract } from "./pt-session-lock";
import { requireTrainerProfile } from "@/server/trainers/trainer.service";
import {
  PTError,
  syncUsedSessions,
  requireMyContract,
  requireMySession,
  requireOpenSession,
} from "./pt-shared";

/**
 * 수업을 잡는다.
 *
 * 회차 번호는 잡은 순서로 매긴다. 실제로 한 순서와 다를 수 있지만, 미루고
 * 취소하는 일이 흔해서 "몇 번째로 할 수업" 을 미리 정해 두면 어차피 어긋난다.
 * 번호는 계약 안에서 겹치지 않기만 하면 된다.
 */
export async function scheduleSession(
  userId: string,
  input: {
    contractId: string;
    scheduledAt: Date;
    durationMinutes?: number;
    memo?: string | null;
  },
) {
  const trainer = await requireTrainerProfile(userId);
  const contract = await requireMyContract(trainer.id, input.contractId);

  if (contract.status !== PTContractStatus.ACTIVE) {
    throw new PTError("CONTRACT_CLOSED", "진행 중인 계약이 아니에요.");
  }
  if (Number.isNaN(input.scheduledAt.getTime())) {
    throw new PTError("INVALID", "수업 시각을 확인해주세요.");
  }

  return prisma.$transaction(async (tx) => {
    /*
      같은 계약에 동시에 들어온 예약을 줄 세운다.

      잠그지 않으면 두 요청이 같은 "마지막 회차" 를 읽고 같은 번호를 만들려다
      한쪽이 unique 위반으로 죽고, 횟수를 세는 쪽도 서로의 예약을 못 본다.
    */
    await lockPTContract(tx, contract.id);

    /*
      아직 안 한 수업까지 세서 남은 횟수를 본다.

      차감된 회차만 세면 20회 계약에 수업을 서른 개 잡을 수 있다. 잡을 때
      막지 않으면 나중에 "계약에 없는 회차" 를 손으로 정리해야 한다.
    */
    const taken = await tx.pTSession.count({
      where: {
        contractId: contract.id,
        OR: [{ deducted: true }, { status: PTSessionStatus.SCHEDULED }],
      },
    });

    if (taken >= contract.totalSessions) {
      throw new PTError(
        "NO_SESSIONS_LEFT",
        "남은 횟수가 없어요. 횟수나 기간을 먼저 확인해주세요.",
      );
    }

    const last = await tx.pTSession.findFirst({
      where: { contractId: contract.id },
      orderBy: { sessionNumber: "desc" },
      select: { sessionNumber: true },
    });

    return tx.pTSession.create({
      data: {
        /*
          새로 잡은 수업도 회원에게 알린다.

          "변경" 이 아니라 목록에 새로 나타나는 것뿐이라 넘어갈 뻔했는데,
          회원이 모르는 수업은 노쇼가 되고 노쇼는 횟수를 깎는다. 돈이 걸린
          쪽은 알려야 한다.
        */
        memberAlertAt: new Date(),
        contractId: contract.id,
        memberUserId: contract.memberUserId,
        trainerProfileId: trainer.id,
        sessionNumber: (last?.sessionNumber ?? 0) + 1,
        scheduledAt: input.scheduledAt,
        durationMinutes: input.durationMinutes ?? 60,
        memo: input.memo?.trim() || null,
      },
      select: { id: true, sessionNumber: true, scheduledAt: true },
    });
  });
}

/**
 * 수업을 미룬다.
 *
 * 상태는 그대로 SCHEDULED 다. 미룬 수업도 여전히 앞으로 할 수업이라 다음 수업
 * 목록에 남아야 한다. 대신 언제에서 언제로 누가 옮겼는지를 이력으로 쌓는다.
 * "회원이 자주 미뤘다" 와 "트레이너 사정으로 밀렸다" 는 재등록 상담에서 완전히
 * 다른 이야기인데, 안 남기면 나중에 둘 다 그냥 "일정 변경 3회" 로만 보인다.
 *
 * 횟수는 깎지 않는다.
 */
export async function rescheduleSession(
  userId: string,
  input: {
    sessionId: string;
    scheduledAt: Date;
    movedBy: PTSessionActor;
    reason?: string | null;
  },
) {
  const trainer = await requireTrainerProfile(userId);
  const session = await requireMySession(trainer.id, input.sessionId);

  if (session.status !== PTSessionStatus.SCHEDULED) {
    throw new PTError("SESSION_CLOSED", "이미 끝난 수업이에요.");
  }
  if (Number.isNaN(input.scheduledAt.getTime())) {
    throw new PTError("INVALID", "옮길 시각을 확인해주세요.");
  }
  if (input.scheduledAt.getTime() === session.scheduledAt.getTime()) {
    throw new PTError("INVALID", "같은 시각이에요.");
  }

  requireOpenSession(session);

  return prisma.$transaction(async (tx) => {
    await tx.pTSessionReschedule.create({
      data: {
        sessionId: session.id,
        fromScheduledAt: session.scheduledAt,
        toScheduledAt: input.scheduledAt,
        movedBy: input.movedBy,
        reason: input.reason?.trim() || null,
      },
    });

    const updated = await tx.pTSession.update({
      where: { id: session.id },
      data: { scheduledAt: input.scheduledAt, memberAlertAt: new Date() },
      select: { id: true, scheduledAt: true, memberUserId: true },
    });

    await createNotification(tx, {
      userId: updated.memberUserId,
      type: NotificationType.PT_SESSION_CHANGED,
      title: "PT 일정이 변경되었어요",
      message: `${trainer.name} 트레이너가 예정된 PT 수업 시간을 변경했어요.`,
      relatedType: "PT_SESSION",
      relatedId: updated.id,
    });

    return updated;
  });
}

/** 수업을 마쳤다. 횟수를 깎는다. */
export async function completeSession(userId: string, sessionId: string) {
  const trainer = await requireTrainerProfile(userId);
  const session = await requireMySession(trainer.id, sessionId);

  requireOpenSession(session);

  return prisma.$transaction(async (tx) => {
    const updated = await tx.pTSession.update({
      where: { id: session.id },
      data: {
        status: PTSessionStatus.COMPLETED,
        completedAt: new Date(),
        deducted: true,
        cancelledAt: null,
        cancelledBy: null,
        cancelReason: null,
        /*
          끝난 수업에는 알릴 것이 없다.

          회원은 그 자리에 있었다. 남아 있던 표시가 있으면 여기서 내린다.
        */
        memberAlertAt: null,
      },
      select: { id: true },
    });

    await syncUsedSessions(tx, session.contractId);

    return updated;
  });
}

/**
 * 회원이 안 왔다.
 *
 * 차감할지는 트레이너가 고른다. 정책이 사람마다 다르고, 같은 사람도 상황에
 * 따라 봐준다. 여기서 규칙을 정해 버리면 봐주고 싶을 때 손쓸 방법이 없다.
 */
export async function markNoShow(
  userId: string,
  sessionId: string,
  options: { deduct: boolean; reason?: string | null },
) {
  const trainer = await requireTrainerProfile(userId);
  const session = await requireMySession(trainer.id, sessionId);

  requireOpenSession(session);

  return prisma.$transaction(async (tx) => {
    const updated = await tx.pTSession.update({
      where: { id: session.id },
      data: {
        status: PTSessionStatus.NO_SHOW,
        deducted: options.deduct,
        completedAt: null,
        cancelledAt: new Date(),
        cancelledBy: PTSessionActor.MEMBER,
        cancelReason: options.reason?.trim() || null,
        memberAlertAt: new Date(),
      },
      select: { id: true, deducted: true, memberUserId: true },
    });

    await createNotification(tx, {
      userId: updated.memberUserId,
      type: NotificationType.PT_SESSION_CHANGED,
      title: "PT 수업 상태가 변경되었어요",
      message: `${trainer.name} 트레이너가 이번 수업을 노쇼로 처리했어요.`,
      relatedType: "PT_SESSION",
      relatedId: updated.id,
    });

    await syncUsedSessions(tx, session.contractId);

    return updated;
  });
}

/**
 * 수업을 취소한다.
 *
 * 기본은 차감하지 않는다. 당일 취소를 깎는 트레이너도 있어서 고를 수 있게
 * 뒀지만, 기본값을 차감으로 두면 그냥 눌렀다가 회원 횟수가 줄어든다.
 */
export async function cancelSession(
  userId: string,
  sessionId: string,
  options: {
    cancelledBy: PTSessionActor;
    deduct?: boolean;
    reason?: string | null;
  },
) {
  const trainer = await requireTrainerProfile(userId);
  const session = await requireMySession(trainer.id, sessionId);

  requireOpenSession(session);

  return prisma.$transaction(async (tx) => {
    const updated = await tx.pTSession.update({
      where: { id: session.id },
      data: {
        status: PTSessionStatus.CANCELLED,
        deducted: options.deduct ?? false,
        completedAt: null,
        cancelledAt: new Date(),
        cancelledBy: options.cancelledBy,
        cancelReason: options.reason?.trim() || null,
        memberAlertAt: new Date(),
      },
      select: {
        id: true,
        deducted: true,
        memberUserId: true,
        cancelReason: true,
      },
    });

    await createNotification(tx, {
      userId: updated.memberUserId,
      type: NotificationType.PT_SESSION_CHANGED,
      title: "PT 수업이 취소되었어요",
      message: updated.cancelReason
        ? `${trainer.name} 트레이너가 수업을 취소했어요. 사유: ${updated.cancelReason}`
        : `${trainer.name} 트레이너가 예정된 PT 수업을 취소했어요.`,
      relatedType: "PT_SESSION",
      relatedId: updated.id,
    });

    await syncUsedSessions(tx, session.contractId);

    return updated;
  });
}

/** 잘못 누른 것을 되돌린다. 예정 상태로 돌아간다. */
export async function reopenSession(userId: string, sessionId: string) {
  const trainer = await requireTrainerProfile(userId);
  const session = await requireMySession(trainer.id, sessionId);

  if (session.status === PTSessionStatus.SCHEDULED) {
    return { id: session.id };
  }

  // 운동 기록이 이미 붙었으면 되돌리지 않는다. 완료를 취소하면 그 기록이
  // 어느 회차의 것인지 알 수 없게 된다.
  const workout = await prisma.workoutSession.findUnique({
    where: { ptSessionId: session.id },
    select: { id: true },
  });

  if (workout) {
    throw new PTError(
      "SESSION_CLOSED",
      "운동 기록이 있는 수업은 되돌릴 수 없어요.",
    );
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.pTSession.update({
      where: { id: session.id },
      data: {
        status: PTSessionStatus.SCHEDULED,
        deducted: false,
        completedAt: null,
        cancelledAt: null,
        cancelledBy: null,
        cancelReason: null,
        /*
          되살린 것도 알린다.

          취소를 이미 본 회원은 그날 안 온다. 잘못 눌러서 되돌렸다는 사실을
          안 알리면, 트레이너 화면에서는 예정인 수업에 회원만 안 나타난다.
        */
        memberAlertAt: new Date(),
      },
      select: { id: true, memberUserId: true },
    });

    await createNotification(tx, {
      userId: updated.memberUserId,
      type: NotificationType.PT_SESSION_CHANGED,
      title: "PT 수업이 다시 예약되었어요",
      message: `${trainer.name} 트레이너가 취소했던 수업을 다시 예약 상태로 변경했어요.`,
      relatedType: "PT_SESSION",
      relatedId: updated.id,
    });

    await syncUsedSessions(tx, session.contractId);

    return updated;
  });
}

export interface SessionRow {
  id: string;
  sessionNumber: number;
  scheduledAt: Date;
  durationMinutes: number;
  status: PTSessionStatus;
  deducted: boolean;
  memo: string | null;
  cancelReason: string | null;
  cancelledBy: PTSessionActor | null;
  /** 미룬 이력. 최근 것이 먼저. */
  reschedules: {
    fromScheduledAt: Date;
    toScheduledAt: Date;
    movedBy: PTSessionActor;
    reason: string | null;
  }[];
  workoutSessionId: string | null;
  journalId: string | null;
}

/**
 * 한 계약의 회차 전부.
 *
 * 미룬 이력까지 함께 준다. "9/10 → 9/17 로 옮김" 은 상태가 아니라 이력이라
 * 회차 줄에 붙여야 타임라인에서 한 회차의 사연이 한자리에 모인다.
 */
export async function listSessions(
  userId: string,
  contractId: string,
): Promise<SessionRow[]> {
  const trainer = await requireTrainerProfile(userId);
  const contract = await requireMyContract(trainer.id, contractId);

  const sessions = await prisma.pTSession.findMany({
    where: { contractId: contract.id },
    orderBy: { scheduledAt: "asc" },
    select: {
      id: true,
      sessionNumber: true,
      scheduledAt: true,
      durationMinutes: true,
      status: true,
      deducted: true,
      memo: true,
      cancelReason: true,
      cancelledBy: true,
      reschedules: {
        orderBy: { createdAt: "desc" },
        select: {
          fromScheduledAt: true,
          toScheduledAt: true,
          movedBy: true,
          reason: true,
        },
      },
      workoutSession: { select: { id: true } },
      journals: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { id: true },
      },
    },
  });

  return sessions.map((session) => ({
    id: session.id,
    sessionNumber: session.sessionNumber,
    scheduledAt: session.scheduledAt,
    durationMinutes: session.durationMinutes,
    status: session.status,
    deducted: session.deducted,
    memo: session.memo,
    cancelReason: session.cancelReason,
    cancelledBy: session.cancelledBy,
    reschedules: session.reschedules,
    workoutSessionId: session.workoutSession?.id ?? null,
    journalId: session.journals[0]?.id ?? null,
  }));
}
