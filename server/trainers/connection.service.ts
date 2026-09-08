import "server-only";

import { ConnectionStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { generateCode, normalizeCode } from "@/server/centers/center.service";

/**
 * 트레이너와 회원의 연결.
 *
 * 센터를 거치지 않는다. 프리랜서 트레이너도, 센터 소속 트레이너도 똑같이
 * 자기 코드를 뿌리고 회원이 그 코드를 넣으면 연결된다. 센터 코드는 소속만
 * 만들 뿐 이 관계에 관여하지 않는다.
 */

export class ConnectionError extends Error {
  constructor(
    readonly code:
      | "NOT_TRAINER"
      | "INVALID_CODE"
      | "EXPIRED"
      | "EXHAUSTED"
      | "SELF"
      | "ALREADY_CONNECTED"
      | "NOT_FOUND",
    message: string,
  ) {
    super(message);
    this.name = "ConnectionError";
  }
}

/** 코드 앞에 붙는 표시. 센터 코드와 눈으로 구분되게 한다. */
const PREFIX = "TR";

/** 기본 유효기간. 한 달이면 회원에게 전하고 넣기에 충분하다. */
const DEFAULT_DAYS = 30;

function displayName(profile: {
  displayName: string | null;
  user: { name: string };
}) {
  return profile.displayName ?? profile.user.name;
}

/**
 * 트레이너로 시작한다.
 *
 * 센터도, 초대 코드도 필요 없다. 지금까지는 트레이너가 되는 유일한 길이 센터
 * 관리자에게 코드를 받는 것이었는데, 혼자 하는 트레이너는 그 코드를 줄 사람이
 * 없어 아예 시작할 수가 없었다.
 */
export async function startTrainerProfile(
  userId: string,
  input: {
    displayName?: string | null;
    bio?: string | null;
    specialty?: string | null;
    careerYears?: number | null;
  } = {},
) {
  const clean = (value: string | null | undefined) => {
    const trimmed = value?.trim();
    return trimmed ? trimmed : null;
  };

  return prisma.trainerProfile.upsert({
    where: { userId },
    create: {
      userId,
      displayName: clean(input.displayName),
      bio: clean(input.bio),
      specialty: clean(input.specialty),
      careerYears: input.careerYears ?? null,
    },
    update: {
      displayName: clean(input.displayName),
      bio: clean(input.bio),
      specialty: clean(input.specialty),
      careerYears: input.careerYears ?? null,
    },
    select: { id: true, displayName: true },
  });
}

async function requireProfileId(userId: string) {
  const profile = await prisma.trainerProfile.findUnique({
    where: { userId },
    select: { id: true },
  });

  if (!profile) {
    throw new ConnectionError("NOT_TRAINER", "트레이너만 할 수 있어요.");
  }

  return profile.id;
}

/**
 * 회원 연결 코드를 만든다.
 *
 * 한 코드를 여러 회원이 쓴다. 회원 서른 명에게 코드를 서른 번 발급하게 하면
 * 트레이너가 쓰지 않는다. 대신 쓴 횟수를 세어 두고 언제든 끌 수 있게 한다.
 */
export async function createTrainerInvitation(
  userId: string,
  options: { maxUses?: number; days?: number } = {},
) {
  const trainerProfileId = await requireProfileId(userId);

  const maxUses = Math.min(Math.max(options.maxUses ?? 50, 1), 200);
  const days = Math.min(Math.max(options.days ?? DEFAULT_DAYS, 1), 90);

  // 코드가 겹치면 만들기가 실패한다. 확률은 낮지만 몇 번 다시 해 본다.
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = `${PREFIX}${generateCode()}`;

    const exists = await prisma.trainerInvitation.findUnique({
      where: { code },
      select: { id: true },
    });
    if (exists) continue;

    return prisma.trainerInvitation.create({
      data: {
        trainerProfileId,
        code,
        maxUses,
        expiresAt: new Date(Date.now() + days * 86_400_000),
      },
      select: {
        id: true,
        code: true,
        maxUses: true,
        usedCount: true,
        expiresAt: true,
      },
    });
  }

  throw new ConnectionError("INVALID_CODE", "코드를 만들지 못했어요.");
}

export async function listActiveTrainerInvitations(userId: string) {
  const trainerProfileId = await requireProfileId(userId);

  return prisma.trainerInvitation.findMany({
    where: {
      trainerProfileId,
      revokedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      code: true,
      maxUses: true,
      usedCount: true,
      expiresAt: true,
    },
  });
}

export async function revokeTrainerInvitation(
  userId: string,
  invitationId: string,
) {
  const trainerProfileId = await requireProfileId(userId);

  const result = await prisma.trainerInvitation.updateMany({
    where: { id: invitationId, trainerProfileId, revokedAt: null },
    data: { revokedAt: new Date() },
  });

  if (result.count === 0) {
    throw new ConnectionError("NOT_FOUND", "코드를 찾을 수 없어요.");
  }
}

/**
 * 회원이 트레이너 코드를 넣는다.
 *
 * 승인 단계를 두지 않았다. 코드는 트레이너가 직접 건네준 것이라 이미 트레이너가
 * 동의한 셈이고, 여기에 승인을 또 끼우면 회원은 코드를 넣고도 아무것도 못 하는
 * 상태로 기다리게 된다.
 */
export async function redeemTrainerCode(userId: string, rawCode: string) {
  const code = normalizeCode(rawCode);

  if (code.length === 0) {
    throw new ConnectionError("INVALID_CODE", "코드를 입력해주세요.");
  }

  return prisma.$transaction(async (tx) => {
    const invitation = await tx.trainerInvitation.findUnique({
      where: { code },
      select: {
        id: true,
        maxUses: true,
        usedCount: true,
        expiresAt: true,
        revokedAt: true,
        trainerProfileId: true,
        trainerProfile: {
          select: {
            userId: true,
            displayName: true,
            user: { select: { name: true } },
          },
        },
      },
    });

    // 없는 코드와 꺼진 코드를 같은 말로 답한다. 코드를 찍어 보는 사람에게
    // "있긴 한데 만료됨" 을 알려 주면 유효한 코드를 좁혀 나갈 수 있다.
    if (!invitation || invitation.revokedAt !== null) {
      throw new ConnectionError("INVALID_CODE", "코드를 확인해주세요.");
    }
    if (invitation.expiresAt.getTime() <= Date.now()) {
      throw new ConnectionError("EXPIRED", "만료된 코드예요.");
    }
    if (invitation.usedCount >= invitation.maxUses) {
      throw new ConnectionError("EXHAUSTED", "다 쓴 코드예요.");
    }
    if (invitation.trainerProfile.userId === userId) {
      throw new ConnectionError("SELF", "내 코드는 넣을 수 없어요.");
    }

    const existing = await tx.trainerMemberConnection.findUnique({
      where: {
        trainerProfileId_memberUserId: {
          trainerProfileId: invitation.trainerProfileId,
          memberUserId: userId,
        },
      },
      select: { id: true, status: true },
    });

    if (existing?.status === ConnectionStatus.ACTIVE) {
      throw new ConnectionError(
        "ALREADY_CONNECTED",
        "이미 연결된 트레이너예요.",
      );
    }

    /*
      끊었다 다시 이으면 같은 줄을 되살린다.

      새 줄을 만들면 지난 기록이 어느 관계에 속했는지 갈라지고, 무엇보다
      @@unique([trainerProfileId, memberUserId]) 에 걸린다. 다만 startedAt 은
      오늘로 다시 잡는다 — 다시 봐 주기 시작한 날이 기준이어야 그 사이에 회원이
      혼자 남긴 기록까지 딸려 들어가지 않는다.
    */
    const connection = existing
      ? await tx.trainerMemberConnection.update({
          where: { id: existing.id },
          data: {
            status: ConnectionStatus.ACTIVE,
            startedAt: new Date(),
            endedAt: null,
          },
          select: { id: true },
        })
      : await tx.trainerMemberConnection.create({
          data: {
            trainerProfileId: invitation.trainerProfileId,
            memberUserId: userId,
            // 이 회원이 지금 어느 센터에 있는지를 관계의 출처로 남긴다.
            originCenterId: await tx.centerMembership
              .findFirst({
                where: { userId, status: "ACTIVE" },
                select: { centerId: true },
              })
              .then((row) => row?.centerId ?? null),
          },
          select: { id: true },
        });

    await tx.trainerInvitation.update({
      where: { id: invitation.id },
      data: { usedCount: { increment: 1 } },
    });

    return {
      connectionId: connection.id,
      trainerName: displayName(invitation.trainerProfile),
    };
  });
}

/**
 * 연결을 끝낸다. 트레이너와 회원 어느 쪽이든 할 수 있다.
 *
 * 줄을 지우지 않고 ENDED 로 둔다. 지우면 그동안 쌓인 알림장과 PT 기록이
 * 어떤 관계에서 나온 것인지 알 수 없게 된다. 끝난 뒤에는 트레이너가 자기가 쓴
 * 것까지만 보고, 회원이 올린 식단과 개인 운동은 닫힌다.
 */
export async function endConnection(userId: string, connectionId: string) {
  const connection = await prisma.trainerMemberConnection.findFirst({
    where: {
      id: connectionId,
      status: ConnectionStatus.ACTIVE,
      OR: [{ memberUserId: userId }, { trainerProfile: { userId } }],
    },
    select: { id: true },
  });

  if (!connection) {
    throw new ConnectionError("NOT_FOUND", "연결을 찾을 수 없어요.");
  }

  return prisma.trainerMemberConnection.update({
    where: { id: connection.id },
    data: { status: ConnectionStatus.ENDED, endedAt: new Date() },
    select: { id: true },
  });
}

/** 나를 지금 봐 주고 있는 트레이너들. */
export async function getMyTrainers(userId: string) {
  const rows = await prisma.trainerMemberConnection.findMany({
    where: { memberUserId: userId, status: ConnectionStatus.ACTIVE },
    orderBy: { startedAt: "desc" },
    select: {
      id: true,
      startedAt: true,
      trainerProfile: {
        select: {
          id: true,
          displayName: true,
          specialty: true,
          user: { select: { name: true } },
        },
      },
    },
  });

  return rows.map((row) => ({
    connectionId: row.id,
    startedAt: row.startedAt,
    trainerProfileId: row.trainerProfile.id,
    name: displayName(row.trainerProfile),
    specialty: row.trainerProfile.specialty,
  }));
}
