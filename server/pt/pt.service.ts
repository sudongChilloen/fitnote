import "server-only";

import {
  PTContractStatus,
  PTSessionActor,
  PTSessionStatus,
} from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import {
  requireMyMember,
  requireTrainerProfile,
} from "@/server/trainers/trainer.service";

/**
 * PT 계약과 수업.
 *
 * FitNote 는 결제를 하지 않는다. 돈은 센터나 트레이너가 이미 따로 받는다.
 * 여기서 하는 일은 "몇 회를 언제까지 쓰는지" 와 "그 회차가 실제로 어떻게
 * 됐는지" 를 관리하는 것뿐이다.
 */

export class PTError extends Error {
  constructor(
    readonly code:
      | "NOT_FOUND"
      | "INVALID"
      | "CONTRACT_CLOSED"
      | "SESSION_CLOSED"
      | "NO_SESSIONS_LEFT",
    message: string,
  ) {
    super(message);
    this.name = "PTError";
  }
}

export const SESSION_STATUS_LABEL: Record<PTSessionStatus, string> = {
  SCHEDULED: "예정",
  COMPLETED: "완료",
  CANCELLED: "취소",
  NO_SHOW: "노쇼",
};

export const CONTRACT_STATUS_LABEL: Record<PTContractStatus, string> = {
  ACTIVE: "진행 중",
  COMPLETED: "모두 사용",
  EXPIRED: "기간 만료",
  CANCELLED: "중단",
};

/**
 * 남은 횟수를 회차에서 다시 센다.
 *
 * usedSessions 는 화면에서 매번 회차를 세지 않으려고 둔 값이라 언제든 실제와
 * 어긋날 수 있다. 세는 방법을 여기 한 곳에만 두고, 회차 상태를 건드릴 때마다
 * 이 함수로 다시 맞춘다. 두 군데서 세기 시작하면 반드시 갈라진다.
 */
async function syncUsedSessions(
  tx: Pick<typeof prisma, "pTSession" | "pTContract">,
  contractId: string,
) {
  const used = await tx.pTSession.count({
    where: { contractId, deducted: true },
  });

  const contract = await tx.pTContract.findUniqueOrThrow({
    where: { id: contractId },
    select: { totalSessions: true, status: true },
  });

  /*
    다 쓴 계약은 스스로 닫히고, 되돌리면 다시 열린다.

    만료는 여기서 판단하지 않는다. 시간이 지나서 되는 일이라 아무도 이 함수를
    부르지 않는 동안 조용히 지나가기 때문이다. 기간은 읽을 때 함께 본다.
  */
  let status = contract.status;

  if (status === PTContractStatus.ACTIVE && used >= contract.totalSessions) {
    status = PTContractStatus.COMPLETED;
  } else if (
    status === PTContractStatus.COMPLETED &&
    used < contract.totalSessions
  ) {
    status = PTContractStatus.ACTIVE;
  }

  await tx.pTContract.update({
    where: { id: contractId },
    data: { usedSessions: used, status },
  });

  return used;
}

/** 기간이 지났는가. 만료일이 없으면 무기한이다. */
export function isExpired(contract: {
  expiresAt: Date | null;
  status: PTContractStatus;
}) {
  if (contract.status !== PTContractStatus.ACTIVE) return false;
  if (contract.expiresAt === null) return false;

  return contract.expiresAt.getTime() < Date.now();
}

/**
 * 계약을 만든다.
 *
 * 트레이너가 채우는 건 횟수와 기간뿐이다. 이름을 비우면 횟수로 채운다 —
 * 이름 짓느라 멈추게 하면 정작 필요한 값을 넣기도 전에 그만둔다.
 */
export async function createContract(
  userId: string,
  input: {
    connectionId: string;
    totalSessions: number;
    startedAt: Date;
    expiresAt?: Date | null;
    title?: string | null;
  },
) {
  const trainer = await requireTrainerProfile(userId);
  const connection = await requireMyMember(trainer.id, input.connectionId);

  const total = Math.trunc(input.totalSessions);

  if (!Number.isFinite(total) || total < 1 || total > 300) {
    throw new PTError("INVALID", "횟수는 1회부터 300회까지 넣을 수 있어요.");
  }
  if (Number.isNaN(input.startedAt.getTime())) {
    throw new PTError("INVALID", "시작일을 확인해주세요.");
  }
  if (
    input.expiresAt &&
    input.expiresAt.getTime() < input.startedAt.getTime()
  ) {
    throw new PTError("INVALID", "만료일이 시작일보다 앞서요.");
  }

  const centerId = await prisma.centerMembership
    .findFirst({
      where: { userId: connection.memberUserId, status: "ACTIVE" },
      select: { centerId: true },
    })
    .then((row) => row?.centerId ?? null);

  return prisma.pTContract.create({
    data: {
      memberUserId: connection.memberUserId,
      trainerProfileId: trainer.id,
      title: input.title?.trim() || `PT ${total}회`,
      totalSessions: total,
      startedAt: input.startedAt,
      expiresAt: input.expiresAt ?? null,
      // 이 회원이 지금 어느 센터에 있는지. 개인 트레이너면 비어 있다.
      centerId,
    },
    select: { id: true, title: true, totalSessions: true },
  });
}

async function requireMyContract(trainerProfileId: string, contractId: string) {
  const contract = await prisma.pTContract.findFirst({
    where: { id: contractId, trainerProfileId },
    select: {
      id: true,
      status: true,
      totalSessions: true,
      usedSessions: true,
      expiresAt: true,
      memberUserId: true,
    },
  });

  if (!contract) {
    throw new PTError("NOT_FOUND", "계약을 찾을 수 없어요.");
  }

  return contract;
}

/**
 * 기간을 늘린다.
 *
 * 출장이나 부상으로 몇 주를 못 오는 일은 예외가 아니라 늘 있는 일이다.
 * 연장할 방법이 없으면 트레이너는 계약을 지우고 다시 만들게 되고, 그러면
 * 그동안의 회차 기록이 통째로 사라진다.
 */
export async function extendContract(
  userId: string,
  contractId: string,
  expiresAt: Date | null,
) {
  const trainer = await requireTrainerProfile(userId);
  const contract = await requireMyContract(trainer.id, contractId);

  if (expiresAt && Number.isNaN(expiresAt.getTime())) {
    throw new PTError("INVALID", "만료일을 확인해주세요.");
  }

  return prisma.pTContract.update({
    where: { id: contract.id },
    data: {
      expiresAt,
      // 만료로 닫혔던 계약은 기간을 늘리면 다시 살아난다.
      status:
        contract.status === PTContractStatus.EXPIRED
          ? PTContractStatus.ACTIVE
          : contract.status,
    },
    select: { id: true, expiresAt: true, status: true },
  });
}

/** 계약을 중단한다. 남은 회차는 그대로 두고 상태만 바꾼다. */
export async function cancelContract(userId: string, contractId: string) {
  const trainer = await requireTrainerProfile(userId);
  const contract = await requireMyContract(trainer.id, contractId);

  return prisma.$transaction(async (tx) => {
    // 아직 안 한 수업은 함께 취소한다. 남겨 두면 끝난 계약의 수업이
    // 트레이너의 오늘 일정에 계속 뜬다. 차감은 하지 않는다.
    await tx.pTSession.updateMany({
      where: { contractId: contract.id, status: PTSessionStatus.SCHEDULED },
      data: {
        status: PTSessionStatus.CANCELLED,
        cancelledAt: new Date(),
        cancelledBy: PTSessionActor.TRAINER,
        cancelReason: "계약 중단",
      },
    });

    return tx.pTContract.update({
      where: { id: contract.id },
      data: { status: PTContractStatus.CANCELLED },
      select: { id: true, status: true },
    });
  });
}

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

async function requireMySession(trainerProfileId: string, sessionId: string) {
  const session = await prisma.pTSession.findFirst({
    where: { id: sessionId, trainerProfileId },
    select: {
      id: true,
      status: true,
      contractId: true,
      scheduledAt: true,
      deducted: true,
    },
  });

  if (!session) {
    throw new PTError("NOT_FOUND", "수업을 찾을 수 없어요.");
  }

  return session;
}

/**
 * 아직 안 끝난 수업인지 본다.
 *
 * 결과를 적는 것은 예정 상태에서만 한다. 이미 완료한 회차를 취소로 덮어쓸 수
 * 있으면 붙어 있던 운동 기록이 취소된 회차에 매달리고, 뒤로 가기 한 번에
 * 같은 처리가 두 번 들어간다. 고치려면 되돌리기를 먼저 눌러야 한다.
 */
function requireOpenSession(session: { status: PTSessionStatus }) {
  if (session.status !== PTSessionStatus.SCHEDULED) {
    throw new PTError(
      "SESSION_CLOSED",
      "이미 처리한 수업이에요. 되돌린 뒤에 다시 해주세요.",
    );
  }
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

    return tx.pTSession.update({
      where: { id: session.id },
      data: { scheduledAt: input.scheduledAt, memberAlertAt: new Date() },
      select: { id: true, scheduledAt: true },
    });
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
      },
      select: { id: true, deducted: true },
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
      select: { id: true, deducted: true },
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
      select: { id: true },
    });

    await syncUsedSessions(tx, session.contractId);

    return updated;
  });
}

export interface ContractSummary {
  id: string;
  title: string;
  totalSessions: number;
  /** 실제로 깎인 회차 수. */
  usedSessions: number;
  /** 아직 안 한, 이미 잡아 둔 수업 수. */
  scheduledCount: number;
  remaining: number;
  startedAt: Date;
  expiresAt: Date | null;
  status: PTContractStatus;
  /** 기간이 지났는가. 상태를 바꾸지 않고 읽을 때 판단한다. */
  expired: boolean;
}

/**
 * 한 회원의 계약들.
 *
 * 끝난 계약도 함께 준다. 재등록 상담에서 "지난번엔 20회 중 18회 하셨죠" 를
 * 말할 수 있어야 하는데, 진행 중인 것만 보여 주면 그 자리에서 못 꺼낸다.
 */
export async function listContracts(
  userId: string,
  connectionId: string,
): Promise<ContractSummary[]> {
  const trainer = await requireTrainerProfile(userId);
  const connection = await requireMyMember(trainer.id, connectionId);

  const contracts = await prisma.pTContract.findMany({
    where: {
      memberUserId: connection.memberUserId,
      trainerProfileId: trainer.id,
    },
    orderBy: [{ status: "asc" }, { startedAt: "desc" }],
    select: {
      id: true,
      title: true,
      totalSessions: true,
      usedSessions: true,
      startedAt: true,
      expiresAt: true,
      status: true,
      _count: {
        select: { sessions: { where: { status: PTSessionStatus.SCHEDULED } } },
      },
    },
  });

  return contracts.map((contract) => ({
    id: contract.id,
    title: contract.title,
    totalSessions: contract.totalSessions,
    usedSessions: contract.usedSessions,
    scheduledCount: contract._count.sessions,
    remaining: Math.max(contract.totalSessions - contract.usedSessions, 0),
    startedAt: contract.startedAt,
    expiresAt: contract.expiresAt,
    status: contract.status,
    expired: isExpired(contract),
  }));
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

/**
 * 회원이 보는 내 다음 수업.
 *
 * 트레이너만 일정을 아는 상태가 제일 이상하다. 회원은 자기가 언제 가는지
 * 카톡을 뒤져서 확인하고 있다.
 *
 * 지난 세 시간까지 함께 보여 준다. 오후 7시 수업이 7시 1분에 목록에서
 * 사라지면, 수업 직전에 확인하려던 사람이 못 본다.
 */
/**
 * 지금 수업을 잡을 수 있는 계약들.
 *
 * 일정 화면에서 바로 수업을 잡으려면 "누구의" 를 먼저 골라야 한다. 그런데
 * 회원을 고르고 계약을 또 고르게 하면 단계가 둘이다. 회원 한 명에게 진행 중인
 * 계약은 대개 하나뿐이라, 계약을 고르는 것으로 회원 선택까지 끝낸다.
 *
 * 남은 횟수가 없는 계약은 뺀다. 어차피 scheduleSession 이 막는데, 고를 수 있게
 * 두면 고르고 나서야 안 된다는 말을 듣는다. 못 고르게 하는 편이 낫다.
 *
 * 남은 횟수는 차감된 회차와 아직 안 한 예정 회차를 함께 센다. scheduleSession
 * 이 쓰는 기준과 같아야 여기서 보이는 숫자와 실제로 잡히는 개수가 어긋나지
 * 않는다.
 */
export async function listSchedulableContracts(userId: string) {
  const trainer = await requireTrainerProfile(userId);

  const contracts = await prisma.pTContract.findMany({
    where: {
      trainerProfileId: trainer.id,
      status: PTContractStatus.ACTIVE,
      OR: [{ expiresAt: null }, { expiresAt: { gte: new Date() } }],
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      totalSessions: true,
      expiresAt: true,
      memberUser: { select: { name: true } },
      _count: {
        select: {
          sessions: {
            where: {
              OR: [{ deducted: true }, { status: PTSessionStatus.SCHEDULED }],
            },
          },
        },
      },
    },
  });

  return contracts
    .map((contract) => ({
      id: contract.id,
      title: contract.title,
      memberName: contract.memberUser.name,
      totalSessions: contract.totalSessions,
      remaining: contract.totalSessions - contract._count.sessions,
      expiresAt: contract.expiresAt,
    }))
    .filter((contract) => contract.remaining > 0)
    /*
      이름순으로 세운다. 만든 순서는 트레이너의 기억에 없고, 고를 때 찾는
      단서는 회원 이름뿐이다.
    */
    .sort((a, b) => a.memberName.localeCompare(b.memberName, "ko"));
}

/**
 * 회원이 보는 다가오는 수업.
 *
 * 예정된 수업만 보여주면 조용히 사라지는 것이 생긴다. 트레이너가 취소하면
 * 목록에서 빠질 뿐이라, 회원은 그 사실을 알 방법이 없다. 그래서 아직 확인하지
 * 못한 취소는 "취소됨" 인 채로 남겨 둔다 — 사라지는 것보다 남아 있는 쪽이
 * 확실히 눈에 띈다. 회원이 확인을 누르면 그때 목록에서 빠진다.
 *
 * 지나간 것은 확인 여부와 상관없이 뺀다. 어제 취소된 어제 수업을 오늘 띄우면
 * 그때부터는 안내가 아니라 잔소리다.
 */
export async function getMyUpcomingSessions(userId: string, limit = 5) {
  const since = new Date(Date.now() - 3 * 3_600_000);

  const sessions = await prisma.pTSession.findMany({
    where: {
      memberUserId: userId,
      scheduledAt: { gte: since },
      OR: [
        { status: PTSessionStatus.SCHEDULED },
        {
          status: PTSessionStatus.CANCELLED,
          memberAlertAt: { not: null },
        },
      ],
    },
    orderBy: { scheduledAt: "asc" },
    take: limit,
    select: {
      id: true,
      scheduledAt: true,
      sessionNumber: true,
      durationMinutes: true,
      status: true,
      cancelReason: true,
      memberAlertAt: true,
      contract: { select: { title: true, totalSessions: true } },
      trainerProfile: {
        select: { displayName: true, user: { select: { name: true } } },
      },
    },
  });

  return sessions.map((session) => ({
    id: session.id,
    scheduledAt: session.scheduledAt,
    sessionNumber: session.sessionNumber,
    durationMinutes: session.durationMinutes,
    totalSessions: session.contract.totalSessions,
    status: session.status,
    cancelReason: session.cancelReason,
    /** 아직 확인하지 않은 변경이 있다. */
    changed: session.memberAlertAt !== null,
    trainerName:
      session.trainerProfile.displayName ?? session.trainerProfile.user.name,
  }));
}

/**
 * 회원이 일정 변경을 확인했다.
 *
 * 확인한 뒤에도 예정된 수업은 목록에 그대로 남고 표시만 사라진다. 취소된
 * 수업은 그때 목록에서 빠진다.
 *
 * 트레이너는 이걸 볼 수 없다. 회원이 확인했는지를 트레이너 화면에 띄우면
 * 다시 읽음 추적이 되고, 그건 이미 안 하기로 한 것이다. 이 표시는 회원이
 * 자기 화면을 정리하는 용도다.
 */
export async function acknowledgeSessionChange(
  userId: string,
  sessionId: string,
) {
  const result = await prisma.pTSession.updateMany({
    where: { id: sessionId, memberUserId: userId },
    data: { memberAlertAt: null },
  });

  if (result.count === 0) {
    throw new PTError("NOT_FOUND", "수업을 찾을 수 없어요.");
  }

  return { id: sessionId };
}
