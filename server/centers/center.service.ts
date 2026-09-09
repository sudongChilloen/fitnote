import "server-only";

import { randomInt } from "node:crypto";

import { Prisma } from "@/generated/prisma/client";
import { MembershipRole, MembershipStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";

export class CenterError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = "CenterError";
  }
}

/**
 * 코드에 쓸 글자.
 *
 * 0/O, 1/I/L 처럼 헷갈리는 것은 뺐다. 코드는 카톡으로 받아 손으로 옮겨
 * 적는 물건이라 한 글자만 잘못 봐도 "없는 코드" 를 만난다.
 */
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 8;

export function generateCode() {
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i += 1) {
    // Math.random 은 예측 가능하다. 코드를 찍어 맞히면 남의 센터에 들어간다.
    code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  }
  return code;
}

/** 사람은 소문자로도, 하이픈을 넣어서도 적는다. */
export function normalizeCode(input: string) {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

const membershipSelect = {
  id: true,
  role: true,
  status: true,
  joinedAt: true,
  centerId: true,
  center: { select: { id: true, name: true, status: true } },
} satisfies Prisma.CenterMembershipSelect;

export type MembershipDto = Prisma.CenterMembershipGetPayload<{
  select: typeof membershipSelect;
}>;

/**
 * 소속된 센터 전부.
 *
 * 지금은 한 곳만 허용하지만 목록으로 다룬다. "한 곳뿐" 이라는 가정이 서비스
 * 전체에 스며들면 나중에 두 곳을 허용할 때 전부 뜯어야 한다. 집 앞과 회사 앞을
 * 같이 다니는 회원, 다른 헬스장의 회원이기도 한 트레이너가 실제로 있다.
 */
export async function getActiveMemberships(userId: string) {
  return prisma.centerMembership.findMany({
    where: { userId, status: MembershipStatus.ACTIVE },
    orderBy: { joinedAt: "desc" },
    select: membershipSelect,
  });
}

/**
 * 지금 보고 있는 센터.
 *
 * 여러 센터를 허용하게 되면 이 함수만 "고른 센터를 돌려준다" 로 바뀐다.
 * 아래 함수들이 membershipId 를 받는 이유가 이것이다.
 */
export async function getCurrentMembership(userId: string) {
  const [first] = await getActiveMemberships(userId);
  return first ?? null;
}

async function requireMembership(userId: string, membershipId: string) {
  const membership = await prisma.centerMembership.findFirst({
    where: { id: membershipId, userId, status: MembershipStatus.ACTIVE },
    select: membershipSelect,
  });

  if (!membership) {
    throw new CenterError("NO_MEMBERSHIP", "센터에 소속되어 있지 않아요.");
  }

  return membership;
}

/**
 * 트레이너로 활동할 수 있는가.
 *
 * 센터 관리자도 트레이너 기능을 쓴다. 한 센터에 한 사람당 소속이 하나뿐이라
 * (@@unique([centerId, userId])), 혼자 하는 트레이너가 관리자 소속과 트레이너
 * 소속을 따로 가질 수 없기 때문이다.
 */
export function canActAsTrainer(membership: { role: MembershipRole }) {
  return (
    membership.role === MembershipRole.TRAINER ||
    membership.role === MembershipRole.CENTER_ADMIN
  );
}

/** 이 소속이 발급할 수 있는 역할. */
export function invitableRoles(role: MembershipRole): MembershipRole[] {
  if (role === MembershipRole.CENTER_ADMIN) {
    // 관리자를 코드로 늘리지는 않는다. 코드 한 장이 새면 센터를 통째로 잃는다.
    return [MembershipRole.TRAINER, MembershipRole.MEMBER];
  }
  if (role === MembershipRole.TRAINER) {
    return [MembershipRole.MEMBER];
  }
  return [];
}

export interface CreateInvitationInput {
  userId: string;
  membershipId: string;
  role: MembershipRole;
  maxUses?: number;
  expiresInDays?: number;
}

export async function createInvitation({
  userId,
  membershipId,
  role,
  maxUses,
  expiresInDays = 14,
}: CreateInvitationInput) {
  const membership = await requireMembership(userId, membershipId);

  if (!invitableRoles(membership.role).includes(role)) {
    throw new CenterError("FORBIDDEN", "이 역할의 코드를 만들 권한이 없어요.");
  }

  /**
   * 트레이너 코드는 한 명만 쓸 수 있다. 트레이너 권한은 남의 기록을 볼 수
   * 있어서, 코드가 단톡방에 돌면 피해가 크다.
   */
  const uses =
    role === MembershipRole.TRAINER
      ? 1
      : Math.min(Math.max(maxUses ?? 50, 1), 200);

  const expiresAt = new Date(
    Date.now() + Math.min(Math.max(expiresInDays, 1), 90) * 24 * 60 * 60 * 1000,
  );

  // 코드가 겹칠 확률은 낮지만 unique 라 실패할 수 있다. 몇 번 다시 뽑는다.
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      return await prisma.centerInvitation.create({
        data: {
          centerId: membership.centerId,
          createdByMembershipId: membership.id,
          code: generateCode(),
          role,
          maxUses: uses,
          expiresAt,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        continue;
      }
      throw error;
    }
  }

  throw new CenterError(
    "CODE_COLLISION",
    "코드를 만들지 못했어요. 다시 시도해주세요.",
  );
}

/** 아직 살아 있는 코드 목록. */
export async function listActiveInvitations(
  userId: string,
  membershipId: string,
) {
  const membership = await requireMembership(userId, membershipId);

  return prisma.centerInvitation.findMany({
    where: {
      centerId: membership.centerId,
      // 관리자는 센터 전체, 트레이너는 자기가 뿌린 것만 본다.
      ...(membership.role === MembershipRole.CENTER_ADMIN
        ? {}
        : { createdByMembershipId: membership.id }),
      revokedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      code: true,
      role: true,
      maxUses: true,
      usedCount: true,
      expiresAt: true,
      createdBy: { select: { id: true, user: { select: { name: true } } } },
    },
  });
}

export async function revokeInvitation(
  userId: string,
  membershipId: string,
  invitationId: string,
) {
  const membership = await requireMembership(userId, membershipId);

  const invitation = await prisma.centerInvitation.findFirst({
    where: {
      id: invitationId,
      centerId: membership.centerId,
      ...(membership.role === MembershipRole.CENTER_ADMIN
        ? {}
        : { createdByMembershipId: membership.id }),
    },
    select: { id: true },
  });

  if (!invitation) {
    throw new CenterError("NOT_FOUND", "코드를 찾을 수 없어요.");
  }

  return prisma.centerInvitation.update({
    where: { id: invitation.id },
    data: { revokedAt: new Date() },
  });
}

export type RedeemOutcome = "JOINED" | "TRAINER_CHANGED";

/**
 * 코드를 넣어 센터에 들어가거나 담당 트레이너를 바꾼다.
 *
 * 코드 확인부터 소속 생성, 사용 횟수 증가까지 한 트랜잭션이다. 나눠 두면
 * 두 사람이 마지막 한 자리를 동시에 가져갈 수 있다.
 */
export async function redeemInvitation(userId: string, rawCode: string) {
  const code = normalizeCode(rawCode);

  if (code.length !== CODE_LENGTH) {
    throw new CenterError("INVALID_CODE", "코드는 8자리예요.");
  }

  return prisma.$transaction(
    async (
      tx,
    ): Promise<{ outcome: RedeemOutcome; membership: MembershipDto }> => {
      const invitation = await tx.centerInvitation.findUnique({
        where: { code },
        include: {
          center: { select: { id: true, name: true, status: true } },
          createdBy: { select: { id: true, role: true, status: true } },
        },
      });

      if (!invitation) {
        throw new CenterError("INVALID_CODE", "없는 코드예요.");
      }
      if (invitation.revokedAt) {
        throw new CenterError("REVOKED", "사용을 중지한 코드예요.");
      }
      if (invitation.expiresAt <= new Date()) {
        throw new CenterError("EXPIRED", "기한이 지난 코드예요.");
      }
      if (invitation.usedCount >= invitation.maxUses) {
        throw new CenterError("EXHAUSTED", "이미 다 사용된 코드예요.");
      }
      if (invitation.center.status !== "ACTIVE") {
        throw new CenterError("CENTER_INACTIVE", "운영하지 않는 센터예요.");
      }
      // 발급한 사람이 센터를 떠났다면 그 코드도 효력을 잃는다.
      if (invitation.createdBy.status !== MembershipStatus.ACTIVE) {
        throw new CenterError("REVOKED", "사용할 수 없는 코드예요.");
      }

      const active = await tx.centerMembership.findFirst({
        where: { userId, status: MembershipStatus.ACTIVE },
        select: { id: true, centerId: true, role: true },
      });

      if (active) {
        if (active.centerId !== invitation.centerId) {
          throw new CenterError(
            "ALREADY_IN_CENTER",
            "이미 다른 센터에 소속되어 있어요. 먼저 나가야 해요.",
          );
        }

        /*
          같은 센터의 코드를 또 넣었다.

          예전에는 트레이너가 뿌린 코드로 담당이 바뀌었지만, 담당 관계는 이제
          센터 소속이 아니라 트레이너 연결 코드가 만든다. 센터 코드는 소속만
          만든다 — 한 코드가 두 가지 일을 하면 회원은 무엇이 바뀌었는지 모른다.
        */
        throw new CenterError(
          "ALREADY_JOINED",
          "이미 이 센터에 소속되어 있어요.",
        );
      }

      // 나간 적이 있다면 그 행을 되살린다. 같은 센터에 두 줄이 생기면
      // @@unique([centerId, userId]) 에 걸린다.
      const previous = await tx.centerMembership.findUnique({
        where: { centerId_userId: { centerId: invitation.centerId, userId } },
        select: { id: true },
      });

      const data = {
        role: invitation.role,
        status: MembershipStatus.ACTIVE,
        joinedAt: new Date(),
        leftAt: null,
        joinedViaInvitationId: invitation.id,
      };

      const membership = previous
        ? await tx.centerMembership.update({
            where: { id: previous.id },
            data,
            select: membershipSelect,
          })
        : await tx.centerMembership.create({
            data: { centerId: invitation.centerId, userId, ...data },
            select: membershipSelect,
          });

      await tx.centerInvitation.update({
        where: { id: invitation.id },
        data: { usedCount: { increment: 1 } },
      });

      return { outcome: "JOINED", membership };
    },
  );
}

/**
 * 센터에서 나간다.
 *
 * 행을 지우지 않고 LEFT 로 남긴다. PT 계약과 알림장이 이 소속을 참조하고
 * 있어서, 지우면 지난 기록이 함께 사라진다.
 */
export async function leaveCenter(userId: string, membershipId: string) {
  const membership = await requireMembership(userId, membershipId);

  return prisma.$transaction(async (tx) => {
    /*
      담당 회원과의 연결은 건드리지 않는다.

      트레이너가 센터를 나가도 회원을 계속 봐 주는 경우가 실제로 흔하다. 나가는
      순간 연결을 끊으면 그 관계의 기록이 통째로 안 보이게 된다. 그만두겠다는
      뜻은 회원별로 따로 밝히게 한다.
    */

    // 뿌려 둔 코드도 함께 끈다.
    await tx.centerInvitation.updateMany({
      where: { createdByMembershipId: membership.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    return tx.centerMembership.update({
      where: { id: membership.id },
      data: { status: MembershipStatus.LEFT, leftAt: new Date() },
    });
  });
}
