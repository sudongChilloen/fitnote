import "server-only";

import { Prisma } from "@/generated/prisma/client";

/**
 * PT 수업을 변경하는 모든 서비스가 공유하는 advisory-lock key.
 *
 * 중요: workout.service.ts와 pt.service.ts가 같은 key를 써야
 * "운동 기록 저장"과 "수업 취소/완료/reopen"이 같은 순서로 처리된다.
 */
export function ptSessionLockKey(sessionId: string) {
  return `pt-session:${sessionId}`;
}

export async function lockPTSession(
  tx: Prisma.TransactionClient,
  sessionId: string,
) {
  const key = ptSessionLockKey(sessionId);
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${key}))`;
}

export function ptContractLockKey(contractId: string) {
  return `pt-contract:${contractId}`;
}

export async function lockPTContract(
  tx: Prisma.TransactionClient,
  contractId: string,
) {
  const key = ptContractLockKey(contractId);
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${key}))`;
}
