import "server-only";

import { cache } from "react";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { SESSION_COOKIE_NAME, decrypt } from "@/app/lib/jwt";

/**
 * 쿠키만 확인하는 낙관적(optimistic) 검증.
 * DB 를 조회하지 않으므로 렌더링 경로에서 가볍게 쓸 수 있다.
 */
export const getOptionalSession = cache(async () => {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  return decrypt(token);
});

/** 로그인이 반드시 필요한 곳에서 사용. 미로그인 시 /login 으로 보낸다. */
export const verifySession = cache(async () => {
  const session = await getOptionalSession();

  if (!session) {
    redirect("/login");
  }

  return session;
});

/**
 * DB 까지 확인하는 보안(secure) 검증.
 * 세션이 폐기·만료되지 않았는지 확인하고 사용자 정보를 반환한다.
 */
export const getCurrentUser = cache(async () => {
  const session = await getOptionalSession();

  if (!session) return null;

  const authSession = await prisma.authSession.findFirst({
    where: {
      id: session.sessionId,
      userId: session.userId,
      revokedAt: null,
      expiresAt: { gt: new Date() },
    },
    select: {
      user: {
        select: {
          id: true,
          email: true,
          name: true,
          profileImageUrl: true,
          status: true,
        },
      },
    },
  });

  if (!authSession || authSession.user.status !== "ACTIVE") {
    return null;
  }

  return authSession.user;
});

/** 보안 검증까지 통과한 사용자만 반환. 실패 시 /login 으로 보낸다. */
export const requireUser = cache(async () => {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return user;
});
