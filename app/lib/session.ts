import "server-only";

import { createHash, randomBytes } from "node:crypto";

import { cookies } from "next/headers";

import {
  SESSION_COOKIE_NAME,
  SESSION_DURATION_MS,
  decrypt,
  encrypt,
} from "@/app/lib/jwt";
import { prisma } from "@/lib/prisma";

export { SESSION_COOKIE_NAME, decrypt } from "@/app/lib/jwt";
export type { SessionPayload } from "@/app/lib/jwt";

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * AuthSession 레코드를 만들고 서명된 JWT 를 쿠키에 저장한다.
 * DB 에는 토큰 해시만 저장해 유출 시에도 세션을 되살릴 수 없도록 한다.
 */
export async function createSession(userId: string) {
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
  const rawToken = randomBytes(32).toString("hex");

  const authSession = await prisma.authSession.create({
    data: {
      userId,
      refreshTokenHash: hashToken(rawToken),
      expiresAt,
    },
    select: { id: true },
  });

  const jwt = await encrypt({ userId, sessionId: authSession.id }, expiresAt);

  const cookieStore = await cookies();

  cookieStore.set(SESSION_COOKIE_NAME, jwt, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    expires: expiresAt,
    path: "/",
  });
}

/** 로그아웃: DB 세션을 폐기하고 쿠키를 제거한다. */
export async function deleteSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const payload = await decrypt(token);

  if (payload) {
    await prisma.authSession.updateMany({
      where: { id: payload.sessionId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  cookieStore.delete(SESSION_COOKIE_NAME);
}
