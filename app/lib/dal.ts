import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import {
  SESSION_COOKIE_NAME,
  decrypt,
} from "@/app/lib/jwt";

export const getOptionalSession = cache(async () => {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  return decrypt(token);
});

export const verifySession = cache(async () => {
  const session = await getOptionalSession();

  if (!session) {
    redirect("/login");
  }

  return session;
});

export const getCurrentUser = cache(async () => {
  const session = await getOptionalSession();

  if (!session) {
    return null;
  }

  const authSession = await prisma.authSession.findFirst({
    where: {
      id: session.sessionId,
      userId: session.userId,
      revokedAt: null,
      expiresAt: {
        gt: new Date(),
      },
    },
    select: {
      user: {
        select: {
          id: true,
          email: true,
          name: true,
          profileImageUrl: true,
          status: true,

          trainerProfile: {
            select: {
              id: true,
              displayName: true,
            },
          },

          memberProfile: {
            select: {
              id: true,
            },
          },
        },
      },
    },
  });

  if (!authSession || authSession.user.status !== "ACTIVE") {
    return null;
  }

  const user = authSession.user;

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    profileImageUrl: user.profileImageUrl,
    status: user.status,

    /**
     * 프로필 존재 여부를 현재 앱의 역할 판단 기준으로 사용한다.
     *
     * TrainerProfile이 있으면 기본 진입 화면은 /trainer.
     * MemberProfile도 있으면 회원 기능도 사용할 수 있는 트레이너다.
     */
    isTrainer: user.trainerProfile !== null,
    isMember: user.memberProfile !== null,

    trainerProfile: user.trainerProfile,
    memberProfile: user.memberProfile,

    trainerDisplayName:
      user.trainerProfile?.displayName ?? null,
  };
});

export const requireUser = cache(async () => {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return user;
});