import "server-only";

import { Prisma } from "@/generated/prisma/client";

/**
 * PT 동시성 제어용 공통 row lock.
 *
 * Supabase transaction-mode pooler(6543)에서는 advisory lock을 사용할 수 없고,
 * Prisma 7 driver adapter에서 pg_advisory_xact_lock()의 void 반환값을
 * $queryRaw로 읽으려 하면 deserialization 오류가 발생한다.
 *
 * 그래서 실제 업무 row를 SELECT ... FOR UPDATE로 잠근다.
 * 같은 PTSession을 변경하는 모든 transaction이 같은 row를 먼저 잠근다.
 */

export function ptSessionLockKey(sessionId: string) {
  return `pt-session:${sessionId}`;
}

export async function lockPTSession(
  tx: Prisma.TransactionClient,
  sessionId: string,
) {
  const rows = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT "id"
    FROM "PTSession"
    WHERE "id" = ${sessionId}
    FOR UPDATE
  `;

  if (rows.length === 0) {
    throw new Error("PTSession을 찾을 수 없습니다.");
  }
}

export function ptContractLockKey(contractId: string) {
  return `pt-contract:${contractId}`;
}

export async function lockPTContract(
  tx: Prisma.TransactionClient,
  contractId: string,
) {
  const rows = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT "id"
    FROM "PTContract"
    WHERE "id" = ${contractId}
    FOR UPDATE
  `;

  if (rows.length === 0) {
    throw new Error("PTContract를 찾을 수 없습니다.");
  }
}
