import "server-only";

import { createHash } from "node:crypto";

import { headers } from "next/headers";

import { prisma } from "@/lib/prisma";

/**
 * 시도 횟수 제한.
 *
 * 외부 저장소를 새로 두지 않고 Postgres 의 AuthAttempt 로 센다. 서버리스는 인스턴스
 * 메모리를 공유하지 않아서 메모리 카운터로는 제한이 되지 않는다.
 *
 * 창을 고정하지 않고 "지금부터 windowMs 전까지"를 센다. 고정 창은 경계 직전과 직후에
 * 시도를 몰아서 두 배를 넣을 수 있다.
 */

export const AUTH_LIMITS = {
  /** 같은 IP + 같은 이메일: 한 계정을 겨냥한 대입 공격 */
  loginAccount: { limit: 5, windowMs: 15 * 60 * 1000 },
  /** 같은 IP: 여러 계정을 돌려가며 두드리는 공격 */
  loginIp: { limit: 20, windowMs: 15 * 60 * 1000 },
  signupIp: { limit: 10, windowMs: 60 * 60 * 1000 },
  claimIp: { limit: 10, windowMs: 15 * 60 * 1000 },
} as const;

export const RATE_LIMIT_MESSAGE =
  "시도가 너무 많아요. 잠시 후 다시 시도해주세요.";

type Limit = { limit: number; windowMs: number };

/** 프록시 뒤에서는 가장 앞의 x-forwarded-for 가 실제 클라이언트다. */
export async function getClientIp() {
  const h = await headers();

  return (
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip") ||
    "unknown"
  );
}

/** 이메일을 그대로 키에 넣으면 시도 기록 테이블에 개인정보가 남는다. */
export function attemptKey(kind: string, ip: string, email?: string) {
  if (!email) return `${kind}:ip:${ip}`;

  const hash = createHash("sha256").update(email).digest("hex").slice(0, 32);

  return `${kind}:acct:${ip}:${hash}`;
}

/** 한도를 넘었는가. 기록은 하지 않는다. */
export async function isRateLimited(key: string, { limit, windowMs }: Limit) {
  const count = await prisma.authAttempt.count({
    where: { key, createdAt: { gt: new Date(Date.now() - windowMs) } },
  });

  return count >= limit;
}

export async function recordAttempt(key: string) {
  await prisma.authAttempt.create({ data: { key }, select: { id: true } });

  // 별도 작업 없이 오래된 기록을 치운다. 매번 지우면 쓰기가 느려지니 가끔만.
  if (Math.random() < 0.02) {
    await prisma.authAttempt.deleteMany({
      where: { createdAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
    });
  }
}

/** 성공하면 그 계정의 실패 기록을 비운다. 정상 사용자가 예전 실수에 계속 묶이지 않게. */
export async function clearAttempts(key: string) {
  await prisma.authAttempt.deleteMany({ where: { key } });
}
