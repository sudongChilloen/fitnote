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

/** 이어받기 코드 앞에 붙는 표시. 트레이너 코드와 눈으로 구분되게 한다. */
const CLAIM_PREFIX = "MB";

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

/**
 * 트레이너가 회원을 직접 만든다. 이름만 있으면 된다.
 *
 * 지금까지 이 서비스에 회원이 들어오는 길은 하나뿐이었다. 회원이 스스로
 * 가입하고, 앱을 깔고, 트레이너 코드를 받아 넣는 것. 세 단계 모두를 넘는
 * 사람만 트레이너의 목록에 나타났다.
 *
 * 그런데 트레이너가 이 앱을 쓰기 시작하는 순간에는 회원이 한 명도 없다.
 * 목록이 비어 있으니 계약도 수업도 알림장도 쓸 데가 없고, 그 상태로 회원들이
 * 가입해 주기를 기다려야 한다. 회원 서른 명 중 다섯이 가입하면 트레이너는
 * 다섯 명은 앱에, 스물다섯 명은 수첩에 적게 되고, 두 군데를 오가느니 결국
 * 수첩 하나로 돌아간다. 도구가 쓸모 있으려면 첫날부터 서른 명이 다 들어와야
 * 한다.
 *
 * 그래서 트레이너가 이름만으로 회원을 만든다. 이 회원은 로그인할 수 없는
 * 껍데기지만, PT 계약도 수업도 운동 기록도 알림장도 다 붙는다. 나중에 본인이
 * 이 계정을 이어받으면 그때까지 쌓인 것이 전부 자기 것으로 보인다. 기록을
 * 옮기지 않기 때문에 옮기다 새는 일도 없다.
 *
 * email 과 passwordHash 를 비워 둔다. 로그인은 email 로 사람을 찾으므로
 * 이 계정에는 애초에 닿지 않고, 닿더라도 passwordHash 가 없어 막힌다.
 */
export async function createPendingMember(
  userId: string,
  input: { name: string; phone?: string | null },
) {
  const trainerProfileId = await requireProfileId(userId);

  const name = input.name.trim();
  if (name.length < 1 || name.length > 20) {
    throw new ConnectionError("NOT_FOUND", "이름을 1~20자로 적어 주세요.");
  }

  const phone = input.phone?.trim() ? input.phone.trim() : null;

  // 같은 트레이너 밑에 같은 이름이 이미 있으면 막는다. 동명이인이 있을 수는
  // 있지만, 목록에 똑같은 이름이 둘 있으면 트레이너가 누구에게 알림장을 쓰는지
  // 알 수 없다. 정말 동명이인이라면 "김민수(수)"처럼 구분해서 적게 한다.
  const duplicate = await prisma.trainerMemberConnection.findFirst({
    where: {
      trainerProfileId,
      status: ConnectionStatus.ACTIVE,
      memberUser: { name },
    },
    select: { id: true },
  });

  if (duplicate) {
    throw new ConnectionError(
      "ALREADY_CONNECTED",
      `이미 "${name}" 회원이 있어요. 동명이인이면 이름을 조금 다르게 적어 주세요.`,
    );
  }

  return prisma.$transaction(async (tx) => {
    const member = await tx.user.create({
      data: {
        name,
        phone,
        email: null,
        passwordHash: null,
        status: "PENDING",
        memberProfile: { create: {} },
      },
      select: { id: true, name: true },
    });

    const connection = await tx.trainerMemberConnection.create({
      data: {
        trainerProfileId,
        memberUserId: member.id,
        status: ConnectionStatus.ACTIVE,
      },
      select: { id: true },
    });

    return { connectionId: connection.id, memberUserId: member.id, name: member.name };
  });
}

/** 이어받기 코드의 유효기간. 초대 코드보다 짧다 — 이 코드는 계정 하나를 통째로 넘긴다. */
const CLAIM_DAYS = 14;

/**
 * 미가입 회원에게 줄, 계정을 이어받는 코드를 만든다.
 *
 * 이미 살아 있는 코드가 있으면 거둬들이고 새로 만든다. 한 회원에게 코드가
 * 여럿이면 트레이너가 어느 링크를 보냈는지 알 수 없고, 회원은 옛 링크를 눌러
 * "안 되는데요" 라고 한다. 살아 있는 코드는 늘 하나다.
 */
export async function createMemberClaimCode(
  userId: string,
  connectionId: string,
) {
  const trainerProfileId = await requireProfileId(userId);

  const connection = await prisma.trainerMemberConnection.findFirst({
    where: {
      id: connectionId,
      trainerProfileId,
      status: ConnectionStatus.ACTIVE,
    },
    select: { memberUserId: true, memberUser: { select: { status: true } } },
  });

  if (!connection) {
    throw new ConnectionError("NOT_FOUND", "담당 회원이 아니에요.");
  }

  // 이미 본인이 쓰고 있는 계정에는 코드를 못 만든다. 만들 수 있으면 트레이너가
  // 회원의 로그인을 갈아치울 수 있다는 뜻이 된다.
  if (connection.memberUser.status !== "PENDING") {
    throw new ConnectionError(
      "ALREADY_CONNECTED",
      "이미 가입한 회원이에요. 이어받기 코드는 필요 없어요.",
    );
  }

  await prisma.memberClaimCode.updateMany({
    where: {
      memberUserId: connection.memberUserId,
      claimedAt: null,
      revokedAt: null,
    },
    data: { revokedAt: new Date() },
  });

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = `${CLAIM_PREFIX}${generateCode()}`;

    const exists = await prisma.memberClaimCode.findUnique({
      where: { code },
      select: { id: true },
    });
    if (exists) continue;

    return prisma.memberClaimCode.create({
      data: {
        code,
        memberUserId: connection.memberUserId,
        trainerProfileId,
        expiresAt: new Date(Date.now() + CLAIM_DAYS * 86_400_000),
      },
      select: { id: true, code: true, expiresAt: true },
    });
  }

  throw new ConnectionError("INVALID_CODE", "코드를 만들지 못했어요.");
}

/** 이 회원에게 지금 살아 있는 이어받기 코드. 없으면 null. */
export async function getMemberClaimCode(
  userId: string,
  connectionId: string,
) {
  const trainerProfileId = await requireProfileId(userId);

  const connection = await prisma.trainerMemberConnection.findFirst({
    where: {
      id: connectionId,
      trainerProfileId,
      status: ConnectionStatus.ACTIVE,
    },
    select: { memberUserId: true },
  });

  if (!connection) return null;

  return prisma.memberClaimCode.findFirst({
    where: {
      memberUserId: connection.memberUserId,
      claimedAt: null,
      revokedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
    select: { id: true, code: true, expiresAt: true },
  });
}

/**
 * 코드가 누구의 것인지 미리 본다. 로그인하지 않은 사람이 부른다.
 *
 * 가입 화면이 "박준호 트레이너가 만든 김수정 계정을 이어받아요" 라고 말해 줘야
 * 회원이 자기 링크가 맞는지 안다. 그 확인 없이 비밀번호부터 정하게 하면,
 * 잘못 전달된 링크로 남의 기록을 가져가고도 아무도 모른다.
 *
 * 이름 말고는 아무것도 주지 않는다. 코드를 찍어 맞힌 사람에게 이메일이나
 * 전화번호까지 흘리지 않기 위해서다 — 애초에 이 계정에는 이메일이 없다.
 */
export async function previewMemberClaimCode(input: string) {
  const code = normalizeCode(input);
  if (!code) return null;

  const row = await prisma.memberClaimCode.findUnique({
    where: { code },
    select: {
      claimedAt: true,
      revokedAt: true,
      expiresAt: true,
      memberUser: { select: { name: true, status: true } },
      trainerProfile: {
        select: { displayName: true, user: { select: { name: true } } },
      },
    },
  });

  if (!row) return null;

  const dead =
    row.claimedAt !== null ||
    row.revokedAt !== null ||
    row.expiresAt.getTime() < Date.now() ||
    row.memberUser.status !== "PENDING";

  if (dead) return null;

  return {
    memberName: row.memberUser.name,
    trainerName: displayName(row.trainerProfile),
  };
}

/**
 * 회원이 계정을 이어받는다.
 *
 * 새 User 를 만들지 않는다. 트레이너가 만들어 둔 그 계정에 이메일과 비밀번호를
 * 채우고 상태만 ACTIVE 로 바꾼다. 기록을 옮기는 방식이었다면 계약·수업·차감·
 * 알림장·운동 기록을 전부 새 사람에게 다시 걸어야 하고, 그중 하나라도 놓치면
 * 회원은 "PT 3회를 어디로 갔냐" 고 묻게 된다. 옮기지 않으면 샐 데가 없다.
 *
 * 한 번에 다 하거나 아무것도 하지 않는다. 이메일만 채워지고 코드가 안 닫히면
 * 그 코드로 비밀번호를 다시 정할 수 있게 된다.
 */
export async function claimMemberAccount(
  input: string,
  credentials: { email: string; passwordHash: string },
) {
  const code = normalizeCode(input);

  const invalid = () =>
    new ConnectionError(
      "INVALID_CODE",
      "쓸 수 없는 링크예요. 트레이너에게 새 링크를 받아 주세요.",
    );

  if (!code) throw invalid();

  const row = await prisma.memberClaimCode.findUnique({
    where: { code },
    select: {
      id: true,
      memberUserId: true,
      claimedAt: true,
      revokedAt: true,
      expiresAt: true,
      memberUser: { select: { status: true } },
    },
  });

  if (
    !row ||
    row.claimedAt !== null ||
    row.revokedAt !== null ||
    row.expiresAt.getTime() < Date.now() ||
    row.memberUser.status !== "PENDING"
  ) {
    throw invalid();
  }

  const taken = await prisma.user.findUnique({
    where: { email: credentials.email },
    select: { id: true },
  });

  if (taken) {
    throw new ConnectionError(
      "ALREADY_CONNECTED",
      "이미 가입된 이메일이에요.",
    );
  }

  return prisma.$transaction(async (tx) => {
    /*
      코드를 먼저 닫는다. claimedAt 이 null 인 줄만 골라 갱신하므로, 같은
      링크로 두 번 동시에 눌러도 한쪽만 1을 받는다. 계정을 먼저 채우고 코드를
      나중에 닫으면 그 사이에 들어온 두 번째 요청이 비밀번호를 덮어쓴다.
    */
    const closed = await tx.memberClaimCode.updateMany({
      where: { id: row.id, claimedAt: null, revokedAt: null },
      data: { claimedAt: new Date() },
    });

    if (closed.count !== 1) throw invalid();

    const user = await tx.user.update({
      where: { id: row.memberUserId, status: "PENDING" },
      data: {
        email: credentials.email,
        passwordHash: credentials.passwordHash,
        status: "ACTIVE",
      },
      select: { id: true, name: true },
    });

    return user;
  });
}
