import "server-only";

import { Prisma } from "@/generated/prisma/client";
import {
  JournalStatus,
  PTContractStatus,
  PTSessionActor,
  PTSessionStatus,
} from "@/generated/prisma/enums";
import { kstStartOfDay } from "@/lib/date";
import { prisma } from "@/lib/prisma";
import {
  requireMyMember,
  requireTrainerProfile,
} from "@/server/trainers/trainer.service";
import { lockPTContract, lockPTSession } from "./pt-session-lock";

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
 * DB serialization 충돌은 동시에 같은 계약/수업을 변경할 때 발생할 수 있다.
 *
 * Serializable transaction은 모든 확인/변경을 하나의 원자적 작업으로 묶고,
 * PostgreSQL이 serialization failure(P2034)를 반환하면 전체 transaction을
 * 처음부터 다시 시도한다.
 */
const SERIALIZABLE_RETRY_COUNT = 3;

function isSerializationConflict(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2034"
  );
}

async function runSerializable<T>(
  operation: (tx: Prisma.TransactionClient) => Promise<T>,
) {
  let lastError: unknown;

  for (let attempt = 0; attempt < SERIALIZABLE_RETRY_COUNT; attempt += 1) {
    try {
      return await prisma.$transaction(operation, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
    } catch (error) {
      lastError = error;

      if (!isSerializationConflict(error)) {
        throw error;
      }

      if (attempt === SERIALIZABLE_RETRY_COUNT - 1) {
        throw error;
      }
    }
  }

  throw lastError;
}

/**
 * 남은 횟수를 회차에서 다시 센다.
 *
 * usedSessions 는 화면에서 매번 회차를 세지 않으려고 둔 값이라 언제든 실제와
 * 어긋날 수 있다. 세는 방법을 여기 한 곳에만 두고, 회차 상태를 건드릴 때마다
 * 이 함수로 다시 맞춘다.
 */
async function syncUsedSessions(
  tx: Prisma.TransactionClient,
  contractId: string,
) {
  const used = await tx.pTSession.count({
    where: {
      contractId,
      deducted: true,
    },
  });

  const contract = await tx.pTContract.findUniqueOrThrow({
    where: { id: contractId },
    select: {
      totalSessions: true,
      status: true,
    },
  });

  let status = contract.status;

  if (
    status === PTContractStatus.ACTIVE &&
    used >= contract.totalSessions
  ) {
    status = PTContractStatus.COMPLETED;
  } else if (
    status === PTContractStatus.COMPLETED &&
    used < contract.totalSessions
  ) {
    status = PTContractStatus.ACTIVE;
  }

  await tx.pTContract.update({
    where: { id: contractId },
    data: {
      usedSessions: used,
      status,
    },
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
 * 트레이너가 채우는 건 횟수와 기간뿐이다.
 */
export async function createContract(
  userId: string,
  input: {
    connectionId: string;
    totalSessions: number;
    startedAt: Date;
    expiresAt?: Date | null;
    title?: string | null;
    /** 이 계약이 실제로 맺어진 센터. 개인 트레이너면 null. */
    centerId?: string | null;
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

  /*
   * 계약의 센터는 회원의 현재 센터 소속으로 추정하지 않는다.
   * 실제 계약을 만든 트레이너가 선택한 센터를 그대로 기록하되,
   * 그 센터에 현재 트레이너로 소속되어 있는지는 서버에서 다시 확인한다.
   * 독립 트레이너는 centerId=null 로 계약을 만든다.
   */
  const centerId = input.centerId?.trim() || null;

  if (centerId) {
    const membership = await prisma.centerMembership.findFirst({
      where: {
        centerId,
        userId: trainer.userId,
        status: "ACTIVE",
        role: { in: ["TRAINER", "CENTER_ADMIN"] },
      },
      select: { centerId: true },
    });

    if (!membership) {
      throw new PTError(
        "INVALID",
        "선택한 센터에 현재 트레이너로 소속되어 있지 않아요.",
      );
    }
  }

  return prisma.pTContract.create({
    data: {
      memberUserId: connection.memberUserId,
      trainerProfileId: trainer.id,
      title: input.title?.trim() || `PT ${total}회`,
      totalSessions: total,
      startedAt: input.startedAt,
      expiresAt: input.expiresAt ?? null,
      centerId,
    },
    select: {
      id: true,
      title: true,
      totalSessions: true,
    },
  });
}

async function requireMyContract(
  trainerProfileId: string,
  contractId: string,
) {
  const contract = await prisma.pTContract.findFirst({
    where: {
      id: contractId,
      trainerProfileId,
    },
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

/** 기간을 늘린다. */
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

  return runSerializable(async (tx) => {
    await lockPTContract(tx, contract.id);

    const current = await tx.pTContract.findUnique({
      where: { id: contract.id },
      select: {
        id: true,
        status: true,
        startedAt: true,
      },
    });

    if (!current) {
      throw new PTError("NOT_FOUND", "계약을 찾을 수 없어요.");
    }

    if (
      expiresAt &&
      expiresAt.getTime() < current.startedAt.getTime()
    ) {
      throw new PTError(
        "INVALID",
        "만료일이 시작일보다 앞서요.",
      );
    }

    return tx.pTContract.update({
      where: { id: current.id },
      data: {
        expiresAt,
        status:
          current.status === PTContractStatus.EXPIRED
            ? PTContractStatus.ACTIVE
            : current.status,
      },
      select: {
        id: true,
        expiresAt: true,
        status: true,
      },
    });
  });
}

/**
 * 계약을 중단한다.
 *
 * 아직 안 한 수업은 함께 취소한다.
 * 이미 차감된 수업은 건드리지 않는다.
 */
export async function cancelContract(
  userId: string,
  contractId: string,
) {
  const trainer = await requireTrainerProfile(userId);
  const contract = await requireMyContract(trainer.id, contractId);

  return runSerializable(async (tx) => {
    await lockPTContract(tx, contract.id);

    /*
     * 운동 기록 쪽도 같은 PTSession advisory lock을 사용한다.
     * 계약 중단이 여러 예정 수업을 한 번에 취소할 때도 각 수업 lock을
     * 잡은 뒤 상태를 바꿔야 "취소 직전에 운동 추가" 같은 race가 생기지 않는다.
     * id 순서대로 lock을 잡아 여러 수업을 동시에 처리할 때의 순서도 고정한다.
     */
    const scheduledSessions = await tx.pTSession.findMany({
      where: {
        contractId: contract.id,
        status: PTSessionStatus.SCHEDULED,
      },
      orderBy: { id: "asc" },
      select: { id: true },
    });

    for (const session of scheduledSessions) {
      await lockPTSession(tx, session.id);
    }

    await tx.pTSession.updateMany({
      where: {
        contractId: contract.id,
        status: PTSessionStatus.SCHEDULED,
      },
      data: {
        status: PTSessionStatus.CANCELLED,
        cancelledAt: new Date(),
        cancelledBy: PTSessionActor.TRAINER,
        cancelReason: "계약 중단",
        deducted: false,
        memberAlertAt: new Date(),
      },
    });

    return tx.pTContract.update({
      where: { id: contract.id },
      data: {
        status: PTContractStatus.CANCELLED,
      },
      select: {
        id: true,
        status: true,
      },
    });
  });
}

/**
 * 수업을 잡는다.
 *
 * 남은 회차와 예정 회차를 transaction 안에서 함께 확인한다.
 *
 * 계약 advisory lock + Serializable transaction을 사용하기 때문에 동시에 마지막
 * 남은 회차를 잡으려는 요청도 하나씩 처리된다.
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
  const contract = await requireMyContract(
    trainer.id,
    input.contractId,
  );

  if (contract.status !== PTContractStatus.ACTIVE) {
    throw new PTError(
      "CONTRACT_CLOSED",
      "진행 중인 계약이 아니에요.",
    );
  }

  if (Number.isNaN(input.scheduledAt.getTime())) {
    throw new PTError("INVALID", "수업 시각을 확인해주세요.");
  }

  if (
    input.durationMinutes !== undefined &&
    (!Number.isFinite(input.durationMinutes) ||
      input.durationMinutes <= 0 ||
      input.durationMinutes > 300)
  ) {
    throw new PTError(
      "INVALID",
      "수업 시간을 확인해주세요.",
    );
  }

  return runSerializable(async (tx) => {
    await lockPTContract(tx, contract.id);

    /*
     * transaction 안에서 계약 상태를 다시 읽는다.
     * 실제 예약 가능 여부는 transaction 시점의 값을 기준으로 판단한다.
     */
    const currentContract = await tx.pTContract.findUnique({
      where: { id: contract.id },
      select: {
        id: true,
        status: true,
        totalSessions: true,
        memberUserId: true,
        expiresAt: true,
      },
    });

    if (!currentContract) {
      throw new PTError("NOT_FOUND", "계약을 찾을 수 없어요.");
    }

    if (currentContract.status !== PTContractStatus.ACTIVE) {
      throw new PTError(
        "CONTRACT_CLOSED",
        "진행 중인 계약이 아니에요.",
      );
    }

    if (
      currentContract.expiresAt &&
      currentContract.expiresAt.getTime() < input.scheduledAt.getTime()
    ) {
      throw new PTError(
        "INVALID",
        "계약 기간이 지난 날짜에는 수업을 잡을 수 없어요.",
      );
    }

    const taken = await tx.pTSession.count({
      where: {
        contractId: currentContract.id,
        OR: [
          { deducted: true },
          { status: PTSessionStatus.SCHEDULED },
        ],
      },
    });

    if (taken >= currentContract.totalSessions) {
      throw new PTError(
        "NO_SESSIONS_LEFT",
        "남은 횟수가 없어요. 횟수나 기간을 먼저 확인해주세요.",
      );
    }

    const last = await tx.pTSession.findFirst({
      where: {
        contractId: currentContract.id,
      },
      orderBy: {
        sessionNumber: "desc",
      },
      select: {
        sessionNumber: true,
      },
    });

    return tx.pTSession.create({
      data: {
        memberAlertAt: new Date(),
        contractId: currentContract.id,
        memberUserId: currentContract.memberUserId,
        trainerProfileId: trainer.id,
        sessionNumber: (last?.sessionNumber ?? 0) + 1,
        scheduledAt: input.scheduledAt,
        durationMinutes: input.durationMinutes ?? 60,
        memo: input.memo?.trim() || null,
      },
      select: {
        id: true,
        sessionNumber: true,
        scheduledAt: true,
      },
    });
  });
}

async function requireMySession(
  trainerProfileId: string,
  sessionId: string,
) {
  const session = await prisma.pTSession.findFirst({
    where: {
      id: sessionId,
      trainerProfileId,
    },
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

/** 아직 안 끝난 수업인지 본다. */
function requireOpenSession(session: {
  status: PTSessionStatus;
}) {
  if (session.status !== PTSessionStatus.SCHEDULED) {
    throw new PTError(
      "SESSION_CLOSED",
      "이미 처리한 수업이에요. 되돌린 뒤에 다시 해주세요.",
    );
  }
}

/** 수업을 미룬다. */
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
  const session = await requireMySession(
    trainer.id,
    input.sessionId,
  );

  if (session.status !== PTSessionStatus.SCHEDULED) {
    throw new PTError(
      "SESSION_CLOSED",
      "이미 끝난 수업이에요.",
    );
  }

  if (Number.isNaN(input.scheduledAt.getTime())) {
    throw new PTError(
      "INVALID",
      "옮길 시각을 확인해주세요.",
    );
  }

  if (
    input.scheduledAt.getTime() ===
    session.scheduledAt.getTime()
  ) {
    throw new PTError("INVALID", "같은 시각이에요.");
  }

  requireOpenSession(session);

  return runSerializable(async (tx) => {
    await lockPTContract(tx, session.contractId);
    await lockPTSession(tx, session.id);

    const current = await tx.pTSession.findUnique({
      where: { id: session.id },
      select: {
        id: true,
        status: true,
        scheduledAt: true,
        contractId: true,
        contract: {
          select: {
            status: true,
            expiresAt: true,
          },
        },
      },
    });

    if (!current) {
      throw new PTError("NOT_FOUND", "수업을 찾을 수 없어요.");
    }

    if (current.status !== PTSessionStatus.SCHEDULED) {
      throw new PTError(
        "SESSION_CLOSED",
        "이미 처리한 수업이에요. 되돌린 뒤에 다시 해주세요.",
      );
    }

    if (current.scheduledAt.getTime() === input.scheduledAt.getTime()) {
      throw new PTError("INVALID", "같은 시각이에요.");
    }

    if (current.contract.status !== PTContractStatus.ACTIVE) {
      throw new PTError(
        "CONTRACT_CLOSED",
        "진행 중인 계약이 아니에요.",
      );
    }

    if (
      current.contract.expiresAt &&
      current.contract.expiresAt.getTime() < input.scheduledAt.getTime()
    ) {
      throw new PTError(
        "INVALID",
        "계약 기간이 지난 날짜로는 수업을 옮길 수 없어요.",
      );
    }

    const updated = await tx.pTSession.updateMany({
      where: {
        id: current.id,
        status: PTSessionStatus.SCHEDULED,
      },
      data: {
        scheduledAt: input.scheduledAt,
        memberAlertAt: new Date(),
      },
    });

    if (updated.count === 0) {
      throw new PTError(
        "SESSION_CLOSED",
        "이미 처리한 수업이에요. 되돌린 뒤에 다시 해주세요.",
      );
    }

    await tx.pTSessionReschedule.create({
      data: {
        sessionId: current.id,
        fromScheduledAt: current.scheduledAt,
        toScheduledAt: input.scheduledAt,
        movedBy: input.movedBy,
        reason: input.reason?.trim() || null,
      },
    });

    return {
      id: current.id,
      scheduledAt: input.scheduledAt,
    };
  });
}

/**
 * 수업을 마쳤다.
 *
 * 핵심:
 * 1. SCHEDULED인 경우에만 상태 변경
 * 2. PTSession.deducted = true
 * 3. 실제 deducted 회차를 다시 세어 contract.usedSessions 동기화
 *
 * 세 작업은 하나의 transaction이다.
 */
export async function completeSession(
  userId: string,
  sessionId: string,
) {
  const trainer = await requireTrainerProfile(userId);
  const session = await requireMySession(
    trainer.id,
    sessionId,
  );

  requireOpenSession(session);

  return runSerializable(async (tx) => {
    await lockPTContract(tx, session.contractId);
    await lockPTSession(tx, session.id);

    const result = await tx.pTSession.updateMany({
      where: {
        id: session.id,
        status: PTSessionStatus.SCHEDULED,
      },
      data: {
        status: PTSessionStatus.COMPLETED,
        completedAt: new Date(),
        deducted: true,
        cancelledAt: null,
        cancelledBy: null,
        cancelReason: null,
        memberAlertAt: null,
      },
    });

    if (result.count === 0) {
      throw new PTError(
        "SESSION_CLOSED",
        "이미 처리한 수업이에요.",
      );
    }

    await syncUsedSessions(tx, session.contractId);

    return {
      id: session.id,
    };
  });
}

/** 회원이 안 왔다. 차감 여부는 트레이너가 선택한다. */
export async function markNoShow(
  userId: string,
  sessionId: string,
  options: {
    deduct: boolean;
    reason?: string | null;
  },
) {
  const trainer = await requireTrainerProfile(userId);
  const session = await requireMySession(
    trainer.id,
    sessionId,
  );

  requireOpenSession(session);

  return runSerializable(async (tx) => {
    await lockPTContract(tx, session.contractId);
    await lockPTSession(tx, session.id);

    const result = await tx.pTSession.updateMany({
      where: {
        id: session.id,
        status: PTSessionStatus.SCHEDULED,
      },
      data: {
        status: PTSessionStatus.NO_SHOW,
        deducted: options.deduct,
        completedAt: null,
        cancelledAt: new Date(),
        cancelledBy: PTSessionActor.MEMBER,
        cancelReason: options.reason?.trim() || null,
        memberAlertAt: new Date(),
      },
    });

    if (result.count === 0) {
      throw new PTError(
        "SESSION_CLOSED",
        "이미 처리한 수업이에요.",
      );
    }

    await syncUsedSessions(tx, session.contractId);

    return {
      id: session.id,
      deducted: options.deduct,
    };
  });
}

/** 수업을 취소한다. 기본은 차감하지 않는다. */
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
  const session = await requireMySession(
    trainer.id,
    sessionId,
  );

  requireOpenSession(session);

  return runSerializable(async (tx) => {
    await lockPTContract(tx, session.contractId);
    await lockPTSession(tx, session.id);

    const result = await tx.pTSession.updateMany({
      where: {
        id: session.id,
        status: PTSessionStatus.SCHEDULED,
      },
      data: {
        status: PTSessionStatus.CANCELLED,
        deducted: options.deduct ?? false,
        completedAt: null,
        cancelledAt: new Date(),
        cancelledBy: options.cancelledBy,
        cancelReason: options.reason?.trim() || null,
        memberAlertAt: new Date(),
      },
    });

    if (result.count === 0) {
      throw new PTError(
        "SESSION_CLOSED",
        "이미 처리한 수업이에요.",
      );
    }

    await syncUsedSessions(tx, session.contractId);

    return {
      id: session.id,
      deducted: options.deduct ?? false,
    };
  });
}

/**
 * 잘못 누른 것을 되돌린다.
 *
 * 운동 기록이 이미 붙었으면 되돌리지 않는다.
 */
export async function reopenSession(
  userId: string,
  sessionId: string,
) {
  const trainer = await requireTrainerProfile(userId);
  const session = await requireMySession(
    trainer.id,
    sessionId,
  );

  if (session.status === PTSessionStatus.SCHEDULED) {
    return { id: session.id };
  }

  return runSerializable(async (tx) => {
    await lockPTContract(tx, session.contractId);
    await lockPTSession(tx, session.id);

    const currentContract = await tx.pTContract.findUnique({
      where: { id: session.contractId },
      select: {
        status: true,
      },
    });

    if (!currentContract) {
      throw new PTError("NOT_FOUND", "계약을 찾을 수 없어요.");
    }

    // 기간 만료/계약 중단 상태에서 수업만 다시 예정으로 돌리면
    // 닫힌 계약에 새 예정 수업이 생긴다. 계약을 먼저 연장/복구해야 한다.
    if (
      currentContract.status !== PTContractStatus.ACTIVE &&
      currentContract.status !== PTContractStatus.COMPLETED
    ) {
      throw new PTError(
        "CONTRACT_CLOSED",
        "계약이 종료된 상태라 수업을 되돌릴 수 없어요. 계약을 먼저 확인해주세요.",
      );
    }

    /*
     * 상태 변경과 운동 기록 확인을 같은 transaction 안에서 한다.
     * 바깥에서 먼저 확인하면 동시에 다른 요청이 WorkoutSession을 붙이는 사이에
     * reopen이 실행될 수 있다.
     */
    const workout = await tx.workoutSession.findUnique({
      where: {
        ptSessionId: session.id,
      },
      select: {
        id: true,
      },
    });

    if (workout) {
      throw new PTError(
        "SESSION_CLOSED",
        "운동 기록이 있는 수업은 되돌릴 수 없어요.",
      );
    }

    const result = await tx.pTSession.updateMany({
      where: {
        id: session.id,
        status: {
          in: [
            PTSessionStatus.COMPLETED,
            PTSessionStatus.CANCELLED,
            PTSessionStatus.NO_SHOW,
          ],
        },
      },
      data: {
        status: PTSessionStatus.SCHEDULED,
        deducted: false,
        completedAt: null,
        cancelledAt: null,
        cancelledBy: null,
        cancelReason: null,
        memberAlertAt: new Date(),
      },
    });

    if (result.count === 0) {
      throw new PTError(
        "SESSION_CLOSED",
        "이미 처리한 수업이에요.",
      );
    }

    await syncUsedSessions(tx, session.contractId);

    return {
      id: session.id,
    };
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

/** 한 회원의 계약들. */
export async function listContracts(
  userId: string,
  connectionId: string,
): Promise<ContractSummary[]> {
  const trainer = await requireTrainerProfile(userId);
  const connection = await requireMyMember(
    trainer.id,
    connectionId,
  );

  const contracts = await prisma.pTContract.findMany({
    where: {
      memberUserId: connection.memberUserId,
      trainerProfileId: trainer.id,
    },
    orderBy: [
      { status: "asc" },
      { startedAt: "desc" },
    ],
    select: {
      id: true,
      title: true,
      totalSessions: true,
      usedSessions: true,
      startedAt: true,
      expiresAt: true,
      status: true,
      _count: {
        select: {
          sessions: {
            where: {
              status: PTSessionStatus.SCHEDULED,
            },
          },
        },
      },
    },
  });

  return contracts.map((contract) => ({
    id: contract.id,
    title: contract.title,
    totalSessions: contract.totalSessions,
    usedSessions: contract.usedSessions,
    scheduledCount: contract._count.sessions,
    remaining: Math.max(
      contract.totalSessions - contract.usedSessions,
      0,
    ),
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

/** 한 계약의 회차 전부. */
export async function listSessions(
  userId: string,
  contractId: string,
): Promise<SessionRow[]> {
  const trainer = await requireTrainerProfile(userId);
  const contract = await requireMyContract(
    trainer.id,
    contractId,
  );

  const sessions = await prisma.pTSession.findMany({
    where: {
      contractId: contract.id,
    },
    orderBy: {
      scheduledAt: "asc",
    },
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
        orderBy: {
          createdAt: "desc",
        },
        select: {
          fromScheduledAt: true,
          toScheduledAt: true,
          movedBy: true,
          reason: true,
        },
      },
      workoutSession: {
        select: {
          id: true,
        },
      },
      journals: {
        orderBy: {
          createdAt: "desc",
        },
        take: 1,
        select: {
          id: true,
        },
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
    workoutSessionId:
      session.workoutSession?.id ?? null,
    journalId:
      session.journals[0]?.id ?? null,
  }));
}

/** 지금 수업을 잡을 수 있는 계약들. */
export async function listSchedulableContracts(
  userId: string,
) {
  const trainer = await requireTrainerProfile(userId);

  const contracts = await prisma.pTContract.findMany({
    where: {
      trainerProfileId: trainer.id,
      status: PTContractStatus.ACTIVE,
      OR: [
        { expiresAt: null },
        { expiresAt: { gte: new Date() } },
      ],
    },
    orderBy: {
      createdAt: "desc",
    },
    select: {
      id: true,
      title: true,
      totalSessions: true,
      expiresAt: true,
      memberUser: {
        select: {
          name: true,
        },
      },
      _count: {
        select: {
          sessions: {
            where: {
              OR: [
                { deducted: true },
                { status: PTSessionStatus.SCHEDULED },
              ],
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
      remaining:
        contract.totalSessions -
        contract._count.sessions,
      expiresAt: contract.expiresAt,
    }))
    .filter((contract) => contract.remaining > 0)
    .sort((a, b) =>
      a.memberName.localeCompare(b.memberName, "ko"),
    );
}

/** 회원이 보는 다가오는 수업. */
export async function getMyUpcomingSessions(
  userId: string,
  limit = 5,
) {
  const since = new Date(
    Date.now() - 3 * 3_600_000,
  );

  const sessions = await prisma.pTSession.findMany({
    where: {
      memberUserId: userId,
      scheduledAt: {
        gte: since,
      },
      OR: [
        {
          status: PTSessionStatus.SCHEDULED,
        },
        {
          status: PTSessionStatus.CANCELLED,
          memberAlertAt: {
            not: null,
          },
        },
      ],
    },
    orderBy: {
      scheduledAt: "asc",
    },
    take: limit,
    select: {
      id: true,
      scheduledAt: true,
      sessionNumber: true,
      durationMinutes: true,
      status: true,
      cancelReason: true,
      memberAlertAt: true,
      contract: {
        select: {
          title: true,
          totalSessions: true,
        },
      },
      trainerProfile: {
        select: {
          displayName: true,
          user: {
            select: {
              name: true,
            },
          },
        },
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
    changed: session.memberAlertAt !== null,
    trainerName:
      session.trainerProfile.displayName ??
      session.trainerProfile.user.name,
  }));
}

/** 회원이 일정 변경을 확인했다. */
export async function acknowledgeSessionChange(
  userId: string,
  sessionId: string,
) {
  const result = await prisma.pTSession.updateMany({
    where: {
      id: sessionId,
      memberUserId: userId,
    },
    data: {
      memberAlertAt: null,
    },
  });

  if (result.count === 0) {
    throw new PTError(
      "NOT_FOUND",
      "수업을 찾을 수 없어요.",
    );
  }

  return {
    id: sessionId,
  };
}

export interface MyPtSessionRow {
  id: string;
  sessionNumber: number;
  scheduledAt: Date;
  durationMinutes: number;
  status: PTSessionStatus;
  /** 이 회차가 횟수에서 빠졌는가. */
  deducted: boolean;
  cancelReason: string | null;
  cancelledBy: PTSessionActor | null;
  reschedules: {
    fromScheduledAt: Date;
    toScheduledAt: Date;
  }[];
  workoutSessionId: string | null;
  journalId: string | null;
}

export interface MyPtContract {
  id: string;
  title: string;
  totalSessions: number;
  remaining: number;
  scheduledCount: number;
  completedCount: number;
  noShowCount: number;
  startedAt: Date;
  expiresAt: Date | null;
  daysLeft: number | null;
  status: PTContractStatus;
  expired: boolean;
  trainerName: string;
  sessions: MyPtSessionRow[];
}

/** 회원이 보는 내 PT. */
export async function getMyPt(
  userId: string,
): Promise<MyPtContract[]> {
  const contracts = await prisma.pTContract.findMany({
    where: {
      memberUserId: userId,
    },
    orderBy: [
      { status: "asc" },
      { startedAt: "desc" },
    ],
    select: {
      id: true,
      title: true,
      totalSessions: true,
      startedAt: true,
      expiresAt: true,
      status: true,
      trainerProfile: {
        select: {
          displayName: true,
          user: {
            select: {
              name: true,
            },
          },
        },
      },
      sessions: {
        orderBy: {
          scheduledAt: "asc",
        },
        select: {
          id: true,
          sessionNumber: true,
          scheduledAt: true,
          durationMinutes: true,
          status: true,
          deducted: true,
          cancelReason: true,
          cancelledBy: true,
          reschedules: {
            orderBy: {
              createdAt: "desc",
            },
            select: {
              fromScheduledAt: true,
              toScheduledAt: true,
            },
          },
          workoutSession: {
            select: {
              id: true,
            },
          },
          journals: {
            where: {
              status: JournalStatus.PUBLISHED,
            },
            orderBy: {
              createdAt: "desc",
            },
            take: 1,
            select: {
              id: true,
            },
          },
        },
      },
    },
  });

  const todayStart = kstStartOfDay();

  return contracts.map((contract) => {
    const sessions = contract.sessions;

    const deducted = sessions.filter(
      (session) => session.deducted,
    ).length;

    return {
      id: contract.id,
      title: contract.title,
      totalSessions: contract.totalSessions,
      remaining: Math.max(
        contract.totalSessions - deducted,
        0,
      ),
      scheduledCount: sessions.filter(
        (session) =>
          session.status === PTSessionStatus.SCHEDULED,
      ).length,
      completedCount: sessions.filter(
        (session) =>
          session.status === PTSessionStatus.COMPLETED,
      ).length,
      noShowCount: sessions.filter(
        (session) =>
          session.status === PTSessionStatus.NO_SHOW,
      ).length,
      startedAt: contract.startedAt,
      expiresAt: contract.expiresAt,
      daysLeft:
        contract.expiresAt === null
          ? null
          : Math.max(
              0,
              Math.ceil(
                (contract.expiresAt.getTime() -
                  todayStart.getTime()) /
                  (24 * 60 * 60 * 1000),
              ) - 1,
            ),
      status: contract.status,
      expired: isExpired(contract),
      trainerName:
        contract.trainerProfile.displayName ??
        contract.trainerProfile.user.name,
      sessions: sessions.map((session) => ({
        id: session.id,
        sessionNumber: session.sessionNumber,
        scheduledAt: session.scheduledAt,
        durationMinutes: session.durationMinutes,
        status: session.status,
        deducted: session.deducted,
        cancelReason: session.cancelReason,
        cancelledBy: session.cancelledBy,
        reschedules: session.reschedules,
        workoutSessionId:
          session.workoutSession?.id ?? null,
        journalId:
          session.journals[0]?.id ?? null,
      })),
    };
  });
}
