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
import { PTError, isExpired, requireMyContract } from "./pt-shared";

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

  const centerId = input.centerId?.trim() || null;

  if (centerId) {
    const membership = await prisma.centerMembership.findFirst({
      where: {
        centerId,
        userId: trainer.userId,
        status: "ACTIVE",
        role: {
          in: ["TRAINER", "CENTER_ADMIN"],
        },
      },
      select: {
        centerId: true,
      },
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

  return (
    contracts
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
      .sort((a, b) => a.memberName.localeCompare(b.memberName, "ko"))
  );
}
