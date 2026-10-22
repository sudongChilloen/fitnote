import "server-only";

import { ConnectionStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { generateCode, normalizeCode } from "@/server/centers/center.service";
import {
  ConnectionError,
  displayName,
  requireProfileId,
} from "./connection-shared";

/** 이어받기 코드 앞에 붙는 표시. 트레이너 코드와 눈으로 구분되게 한다. */
const CLAIM_PREFIX = "MB";

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

    return {
      connectionId: connection.id,
      memberUserId: member.id,
      name: member.name,
    };
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
export async function getMemberClaimCode(userId: string, connectionId: string) {
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
    throw new ConnectionError("ALREADY_CONNECTED", "이미 가입된 이메일이에요.");
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
