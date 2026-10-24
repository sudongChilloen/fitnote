import { describe, expect, it } from "vitest";

import { prisma } from "@/lib/prisma";
import { NotificationType } from "@/generated/prisma/enums";
import {
  runDailyReminders,
  sendContractExpiryNotices,
  sendSessionReminders,
} from "@/server/notifications/reminder.service";

import { makeTrainer, uniq } from "./helpers";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

async function makeMember(status: "ACTIVE" | "PENDING" = "ACTIVE") {
  return prisma.user.create({
    data: {
      name: `회원${uniq()}`,
      email: status === "ACTIVE" ? `rem-${uniq()}@test.com` : null,
      passwordHash: status === "ACTIVE" ? "x" : null,
      status,
    },
    select: { id: true },
  });
}

async function makeContract(
  trainerProfileId: string,
  memberUserId: string,
  overrides: {
    totalSessions?: number;
    usedSessions?: number;
    expiresAt?: Date | null;
    status?: "ACTIVE" | "COMPLETED";
  } = {},
) {
  return prisma.pTContract.create({
    data: {
      title: "PT 10회",
      totalSessions: 10,
      usedSessions: 0,
      startedAt: new Date(Date.now() - 30 * DAY),
      expiresAt: null,
      trainerProfileId,
      memberUserId,
      ...overrides,
    },
    select: { id: true },
  });
}

async function makeSession(
  contractId: string,
  trainerProfileId: string,
  memberUserId: string,
  scheduledAt: Date,
  status: "SCHEDULED" | "CANCELLED" = "SCHEDULED",
) {
  return prisma.pTSession.create({
    data: {
      contractId,
      sessionNumber: 1,
      scheduledAt,
      status,
      trainerProfileId,
      memberUserId,
    },
    select: { id: true },
  });
}

const notificationsOf = (userId: string, type: NotificationType) =>
  prisma.notification.findMany({
    where: { userId, type },
    select: { title: true, message: true, relatedType: true, relatedId: true },
  });

describe("수업 알림", () => {
  it("24시간 안의 수업을 회원과 트레이너에게 한 번씩 알린다", async () => {
    const trainer = await makeTrainer();
    const member = await makeMember();
    const contract = await makeContract(trainer.profileId, member.id);
    const session = await makeSession(
      contract.id,
      trainer.profileId,
      member.id,
      new Date(Date.now() + 5 * HOUR),
    );

    await sendSessionReminders();

    const toMember = await notificationsOf(
      member.id,
      NotificationType.PT_SESSION_REMINDER,
    );
    const toTrainer = await notificationsOf(
      trainer.userId,
      NotificationType.PT_SESSION_REMINDER,
    );

    expect(toMember).toHaveLength(1);
    expect(toMember[0].relatedId).toBe(session.id);
    expect(toTrainer).toHaveLength(1);
    expect(toTrainer[0].message).toContain("회원 수업");
  });

  it("두 번 돌려도 같은 수업은 한 번만 알린다", async () => {
    const trainer = await makeTrainer();
    const member = await makeMember();
    const contract = await makeContract(trainer.profileId, member.id);
    await makeSession(
      contract.id,
      trainer.profileId,
      member.id,
      new Date(Date.now() + 2 * HOUR),
    );

    await sendSessionReminders();
    await sendSessionReminders();

    expect(
      await notificationsOf(member.id, NotificationType.PT_SESSION_REMINDER),
    ).toHaveLength(1);
  });

  it("멀리 있는 수업, 지난 수업, 취소된 수업은 알리지 않는다", async () => {
    const trainer = await makeTrainer();
    const member = await makeMember();
    const contract = await makeContract(trainer.profileId, member.id);

    // 회차 번호가 겹치지 않게 계약을 따로 만든다.
    const far = await makeContract(trainer.profileId, member.id);
    const past = await makeContract(trainer.profileId, member.id);

    await makeSession(
      contract.id,
      trainer.profileId,
      member.id,
      new Date(Date.now() + 30 * HOUR),
    );
    await makeSession(
      far.id,
      trainer.profileId,
      member.id,
      new Date(Date.now() + 3 * HOUR),
      "CANCELLED",
    );
    await makeSession(
      past.id,
      trainer.profileId,
      member.id,
      new Date(Date.now() - 2 * HOUR),
    );

    await sendSessionReminders();

    expect(
      await notificationsOf(member.id, NotificationType.PT_SESSION_REMINDER),
    ).toHaveLength(0);
  });

  it("아직 가입하지 않은 회원에게는 보내지 않고 트레이너에게는 보낸다", async () => {
    const trainer = await makeTrainer();
    const pending = await makeMember("PENDING");
    const contract = await makeContract(trainer.profileId, pending.id);
    await makeSession(
      contract.id,
      trainer.profileId,
      pending.id,
      new Date(Date.now() + 4 * HOUR),
    );

    await sendSessionReminders();

    expect(
      await notificationsOf(pending.id, NotificationType.PT_SESSION_REMINDER),
    ).toHaveLength(0);
    expect(
      await notificationsOf(
        trainer.userId,
        NotificationType.PT_SESSION_REMINDER,
      ),
    ).toHaveLength(1);
  });
});

describe("이용권 안내", () => {
  it("만료가 3일 안이면 알리고, 멀면 알리지 않는다", async () => {
    const trainer = await makeTrainer();
    const member = await makeMember();
    const soon = await makeContract(trainer.profileId, member.id, {
      expiresAt: new Date(Date.now() + 2 * DAY),
    });
    const later = await makeContract(trainer.profileId, member.id, {
      expiresAt: new Date(Date.now() + 20 * DAY),
    });

    await sendContractExpiryNotices();

    const toMember = await notificationsOf(
      member.id,
      NotificationType.PT_CONTRACT_EXPIRING,
    );

    expect(toMember.map((n) => n.relatedId)).toEqual([soon.id]);
    expect(toMember[0].relatedType).toBe("PT_CONTRACT_EXPIRY");
    expect(toMember.some((n) => n.relatedId === later.id)).toBe(false);
  });

  it("이미 끝난 계약이나 만료일이 지난 계약은 알리지 않는다", async () => {
    const trainer = await makeTrainer();
    const member = await makeMember();
    await makeContract(trainer.profileId, member.id, {
      expiresAt: new Date(Date.now() - DAY),
    });
    await makeContract(trainer.profileId, member.id, {
      expiresAt: new Date(Date.now() + DAY),
      status: "COMPLETED",
    });

    await sendContractExpiryNotices();

    expect(
      await notificationsOf(member.id, NotificationType.PT_CONTRACT_EXPIRING),
    ).toHaveLength(0);
  });

  it("남은 횟수가 2회 이하이면 한 번만 알린다", async () => {
    const trainer = await makeTrainer();
    const member = await makeMember();
    const contract = await makeContract(trainer.profileId, member.id, {
      totalSessions: 10,
      usedSessions: 8,
    });

    await sendContractExpiryNotices();
    await sendContractExpiryNotices();

    const toMember = await notificationsOf(
      member.id,
      NotificationType.PT_CONTRACT_EXPIRING,
    );
    const toTrainer = await notificationsOf(
      trainer.userId,
      NotificationType.PT_CONTRACT_EXPIRING,
    );

    expect(toMember).toHaveLength(1);
    expect(toMember[0]).toMatchObject({
      relatedType: "PT_CONTRACT_SESSIONS",
      relatedId: contract.id,
    });
    expect(toMember[0].message).toContain("2회 남았어요");
    expect(toTrainer).toHaveLength(1);
  });

  it("횟수를 다 쓴 계약은 '0회 남음' 알림을 보내지 않는다", async () => {
    const trainer = await makeTrainer();
    const member = await makeMember();
    await makeContract(trainer.profileId, member.id, {
      totalSessions: 10,
      usedSessions: 10,
    });

    await sendContractExpiryNotices();

    expect(
      await notificationsOf(member.id, NotificationType.PT_CONTRACT_EXPIRING),
    ).toHaveLength(0);
  });

  it("만료일과 남은 횟수 조건이 모두 맞으면 알림이 각각 간다", async () => {
    const trainer = await makeTrainer();
    const member = await makeMember();
    await makeContract(trainer.profileId, member.id, {
      totalSessions: 10,
      usedSessions: 9,
      expiresAt: new Date(Date.now() + DAY),
    });

    await runDailyReminders();

    const kinds = (
      await notificationsOf(member.id, NotificationType.PT_CONTRACT_EXPIRING)
    )
      .map((n) => n.relatedType)
      .sort();

    expect(kinds).toEqual(["PT_CONTRACT_EXPIRY", "PT_CONTRACT_SESSIONS"]);
  });
});
