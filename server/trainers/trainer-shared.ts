import "server-only";

import {
  ConnectionStatus,
  MembershipRole,
  MembershipStatus,
} from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";

export class TrainerError extends Error {
  constructor(
    readonly code: "NOT_TRAINER" | "NOT_MY_MEMBER" | "NOT_FOUND",
    message: string,
  ) {
    super(message);
    this.name = "TrainerError";
  }
}

/**
 * 트레이너 프로필.
 *
 * 트레이너라는 신분은 센터 소속이 아니라 프로필 자체다. 센터에 속하지 않은
 * 트레이너도 회원을 받고 알림장을 쓴다. 프로필이 없으면 아예 들어오면 안 되는
 * 화면이라 여기서 던진다.
 */
export async function requireTrainerProfile(userId: string) {
  const profile = await prisma.trainerProfile.findUnique({
    where: { userId },
    select: {
      id: true,
      userId: true,
      displayName: true,
      user: { select: { name: true } },
    },
  });

  if (!profile) {
    throw new TrainerError("NOT_TRAINER", "트레이너만 볼 수 있는 화면이에요.");
  }

  return {
    id: profile.id,
    userId: profile.userId,
    name: profile.displayName ?? profile.user.name,
  };
}

/**
 * 현재 로그인한 트레이너가 실제로 소속되어 있는 활성 센터 목록.
 *
 * PT 계약 생성 시 센터를 선택할 수 있게 하는 화면에서 사용한다.
 * 회원의 센터 소속이 아니라 "계약을 만드는 트레이너 본인"의 소속을 기준으로
 * 해야 하므로 trainer.service에 둔다.
 */
export async function getActiveMemberships(userId: string) {
  const memberships = await prisma.centerMembership.findMany({
    where: {
      userId,
      status: MembershipStatus.ACTIVE,
      role: {
        in: [MembershipRole.TRAINER, MembershipRole.CENTER_ADMIN],
      },
    },
    orderBy: {
      center: { name: "asc" },
    },
    select: {
      centerId: true,
      center: {
        select: {
          id: true,
          name: true,
          status: true,
        },
      },
    },
  });

  return memberships.filter(
    (membership) => membership.center.status === "ACTIVE",
  );
}

/**
 * 이 회원이 내 담당인지 확인한다.
 *
 * 트레이너 화면의 회원 식별자는 회원의 userId 가 아니라 연결의 id 다. 연결에는
 * 언제부터 봐 주기 시작했는지가 담겨 있고, 남의 기록을 읽을 때 그 시점이
 * 기준이 되기 때문이다. userId 를 주소에 쓰면 그 기준을 매번 다시 찾아야 한다.
 */
export async function requireMyMember(
  trainerProfileId: string,
  connectionId: string,
) {
  const connection = await prisma.trainerMemberConnection.findFirst({
    where: {
      id: connectionId,
      trainerProfileId,
      status: ConnectionStatus.ACTIVE,
    },
    select: {
      id: true,
      startedAt: true,
      memberUserId: true,
      memberUser: { select: { id: true, name: true, status: true } },
    },
  });

  if (!connection) {
    throw new TrainerError("NOT_MY_MEMBER", "담당 회원이 아니에요.");
  }

  return connection;
}

/**
 * 회원의 userId 로 연결을 찾는다.
 *
 * 알림장처럼 이미 회원이 정해진 기록에서 출발할 때 쓴다. 주소로 들어오는
 * 경로에는 쓰지 않는다 — 그쪽은 연결 id 로 받아야 남의 회원을 찍어 볼 수 없다.
 */
export async function requireMyMemberByUserId(
  trainerProfileId: string,
  memberUserId: string,
) {
  const connection = await prisma.trainerMemberConnection.findUnique({
    where: {
      trainerProfileId_memberUserId: { trainerProfileId, memberUserId },
    },
    select: {
      id: true,
      status: true,
      startedAt: true,
      memberUserId: true,
      memberUser: { select: { id: true, name: true, status: true } },
    },
  });

  if (!connection || connection.status !== ConnectionStatus.ACTIVE) {
    throw new TrainerError("NOT_MY_MEMBER", "담당 회원이 아니에요.");
  }

  return connection;
}
