import "server-only";

import { NotificationType } from "@/generated/prisma/enums";
import { formatKstDateLabel, formatKstTimeLabel } from "@/lib/date";
import { prisma } from "@/lib/prisma";

import { createNotification } from "./notification.service";

/**
 * 하루에 한 번 돌며 보내는 알림. 수업 알림과 이용권 만료 알림.
 *
 * 같은 일로 두 번 보내지 않는다. 이미 같은 대상에 같은 종류의 알림이 있으면
 * 건너뛰므로 두 번 돌려도, 시간대가 겹쳐도 알림은 한 번만 간다.
 */

/** 만료 며칠 전부터 알리는가. */
export const EXPIRY_NOTICE_DAYS = 3;

/** 남은 횟수가 이 이하이면 알린다. */
export const LOW_SESSIONS_THRESHOLD = 2;

const DAY_MS = 86_400_000;

type Recipient = { userId: string; active: boolean };

async function alreadySent(
  userId: string,
  type: NotificationType,
  relatedType: string,
  relatedId: string,
) {
  const found = await prisma.notification.findFirst({
    where: { userId, type, relatedType, relatedId },
    select: { id: true },
  });

  return found !== null;
}

async function notifyOnce(
  recipient: Recipient,
  input: {
    type: NotificationType;
    title: string;
    message: string;
    relatedType: string;
    relatedId: string;
  },
) {
  // 아직 가입하지 않은 회원에게는 알림을 받을 곳이 없다.
  if (!recipient.active) return false;

  if (
    await alreadySent(
      recipient.userId,
      input.type,
      input.relatedType,
      input.relatedId,
    )
  ) {
    return false;
  }

  await prisma.$transaction((tx) =>
    createNotification(tx, { userId: recipient.userId, ...input }),
  );

  return true;
}

/** 지금부터 24시간 안에 있는 수업을 회원과 트레이너에게 알린다. */
export async function sendSessionReminders(now: Date = new Date()) {
  const sessions = await prisma.pTSession.findMany({
    where: {
      status: "SCHEDULED",
      scheduledAt: { gte: now, lt: new Date(now.getTime() + DAY_MS) },
    },
    select: {
      id: true,
      scheduledAt: true,
      memberUser: { select: { id: true, name: true, status: true } },
      trainerProfile: {
        select: { user: { select: { id: true, status: true } } },
      },
    },
  });

  let sent = 0;

  for (const session of sessions) {
    const when = `${formatKstDateLabel(session.scheduledAt)} ${formatKstTimeLabel(session.scheduledAt)}`;

    const toMember = await notifyOnce(
      {
        userId: session.memberUser.id,
        active: session.memberUser.status === "ACTIVE",
      },
      {
        type: NotificationType.PT_SESSION_REMINDER,
        title: "수업이 곧 있어요",
        message: `${when}에 PT 수업이 있어요.`,
        relatedType: "PT_SESSION",
        relatedId: session.id,
      },
    );

    const toTrainer = await notifyOnce(
      {
        userId: session.trainerProfile.user.id,
        active: session.trainerProfile.user.status === "ACTIVE",
      },
      {
        type: NotificationType.PT_SESSION_REMINDER,
        title: "수업이 곧 있어요",
        message: `${when}에 ${session.memberUser.name} 회원 수업이 있어요.`,
        relatedType: "PT_SESSION",
        relatedId: session.id,
      },
    );

    sent += Number(toMember) + Number(toTrainer);
  }

  return { sessions: sessions.length, sent };
}

/** 만료가 가깝거나 남은 횟수가 적은 이용권을 회원과 트레이너에게 알린다. */
export async function sendContractExpiryNotices(now: Date = new Date()) {
  const soon = new Date(now.getTime() + EXPIRY_NOTICE_DAYS * DAY_MS);

  const contracts = await prisma.pTContract.findMany({
    where: { status: "ACTIVE" },
    select: {
      id: true,
      title: true,
      totalSessions: true,
      usedSessions: true,
      expiresAt: true,
      memberUser: { select: { id: true, name: true, status: true } },
      trainerProfile: {
        select: { user: { select: { id: true, status: true } } },
      },
    },
  });

  let sent = 0;

  for (const contract of contracts) {
    const remaining = contract.totalSessions - contract.usedSessions;

    const notices: {
      relatedType: string;
      memberMessage: string;
      trainerMessage: string;
    }[] = [];

    if (
      contract.expiresAt &&
      contract.expiresAt >= now &&
      contract.expiresAt <= soon
    ) {
      const until = formatKstDateLabel(contract.expiresAt);
      notices.push({
        relatedType: "PT_CONTRACT_EXPIRY",
        memberMessage: `'${contract.title}'이(가) ${until}에 끝나요.`,
        trainerMessage: `${contract.memberUser.name} 회원의 '${contract.title}'이(가) ${until}에 끝나요.`,
      });
    }

    if (remaining > 0 && remaining <= LOW_SESSIONS_THRESHOLD) {
      notices.push({
        relatedType: "PT_CONTRACT_SESSIONS",
        memberMessage: `'${contract.title}'이(가) ${remaining}회 남았어요.`,
        trainerMessage: `${contract.memberUser.name} 회원의 '${contract.title}'이(가) ${remaining}회 남았어요.`,
      });
    }

    for (const notice of notices) {
      const base = {
        type: NotificationType.PT_CONTRACT_EXPIRING,
        title: "이용권 안내",
        relatedType: notice.relatedType,
        relatedId: contract.id,
      };

      const toMember = await notifyOnce(
        {
          userId: contract.memberUser.id,
          active: contract.memberUser.status === "ACTIVE",
        },
        { ...base, message: notice.memberMessage },
      );

      const toTrainer = await notifyOnce(
        {
          userId: contract.trainerProfile.user.id,
          active: contract.trainerProfile.user.status === "ACTIVE",
        },
        { ...base, message: notice.trainerMessage },
      );

      sent += Number(toMember) + Number(toTrainer);
    }
  }

  return { contracts: contracts.length, sent };
}

export async function runDailyReminders(now: Date = new Date()) {
  const sessions = await sendSessionReminders(now);
  const contracts = await sendContractExpiryNotices(now);

  return { sessions, contracts };
}
