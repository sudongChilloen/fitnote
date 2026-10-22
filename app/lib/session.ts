import "server-only";

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

/**
 * AuthSession 레코드를 만들고 서명된 JWT 를 쿠키에 저장한다.
 *
 * 쿠키의 JWT 는 { userId, sessionId } 만 담고, 유효한지는 요청마다 DB 의 이 행으로
 * 판단한다(dal.getCurrentUser). 그래서 행을 폐기하면 JWT 가 만료 전이어도 바로 무효다.
 */
export async function createSession(userId: string) {
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);

  const authSession = await prisma.authSession.create({
    data: { userId, expiresAt },
    select: { id: true },
  });

  await sweepDeadSessions();

  const jwt = await encrypt(
    { userId, sessionId: authSession.id },
    expiresAt,
  );

  const cookieStore = await cookies();

  cookieStore.set(SESSION_COOKIE_NAME, jwt, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    expires: expiresAt,
    path: "/",
  });
}

/** 만료되거나 폐기된 지 하루 넘은 세션을 치운다. 로그인할 때 가끔만 돈다. */
async function sweepDeadSessions() {
  if (Math.random() >= 0.05) return;

  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);

  await prisma.authSession.deleteMany({
    where: { OR: [{ expiresAt: { lt: cutoff } }, { revokedAt: { lt: cutoff } }] },
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
