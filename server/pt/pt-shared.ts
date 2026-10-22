import "server-only";

import { PTContractStatus, PTSessionStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";

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
export async function syncUsedSessions(
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

export async function requireMyContract(
  trainerProfileId: string,
  contractId: string,
) {
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

export async function requireMySession(
  trainerProfileId: string,
  sessionId: string,
) {
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
export function requireOpenSession(session: { status: PTSessionStatus }) {
  if (session.status !== PTSessionStatus.SCHEDULED) {
    throw new PTError(
      "SESSION_CLOSED",
      "이미 처리한 수업이에요. 되돌린 뒤에 다시 해주세요.",
    );
  }
}
