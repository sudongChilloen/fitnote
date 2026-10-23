import { describe, expect, it } from "vitest";

import { prisma } from "@/lib/prisma";
import { getNotificationHref } from "@/server/notifications/notification-href";
import { getNotificationAudience } from "@/server/notifications/notification-audience";

import { makeTrainer, uniq } from "./helpers";

async function makeUser() {
  return prisma.user.create({
    data: {
      name: `사용자${uniq()}`,
      email: `role-${uniq()}@test.com`,
      passwordHash: "x",
    },
    select: { id: true },
  });
}

describe("한 계정은 하나의 역할만", () => {
  it("회원 프로필이 있는 계정에는 트레이너 프로필을 만들 수 없다", async () => {
    const user = await makeUser();
    await prisma.memberProfile.create({ data: { userId: user.id } });

    await expect(
      prisma.trainerProfile.create({ data: { userId: user.id } }),
    ).rejects.toThrow();
  });

  it("트레이너 프로필이 있는 계정에는 회원 프로필을 만들 수 없다", async () => {
    const trainer = await makeTrainer();

    await expect(
      prisma.memberProfile.create({ data: { userId: trainer.userId } }),
    ).rejects.toThrow();
  });

  it("역할이 다른 계정끼리는 서로 막지 않는다", async () => {
    const trainer = await makeTrainer();
    const member = await makeUser();

    await prisma.memberProfile.create({ data: { userId: member.id } });

    expect(await getNotificationAudience(trainer.userId)).toBe("TRAINER");
    expect(await getNotificationAudience(member.id)).toBe("MEMBER");
  });
});

describe("알림 이동 경로는 받는 사람의 역할을 따른다", () => {
  const base = { type: "GENERAL" as const, relatedType: null, relatedId: null };

  it("트레이너는 회원 화면 주소를 받지 않는다", () => {
    expect(
      getNotificationHref(
        { ...base, relatedType: "JOURNAL", relatedId: "j1" },
        "TRAINER",
      ),
    ).toBe("/trainer/notifications");

    expect(
      getNotificationHref(
        { ...base, relatedType: "JOURNAL_COMMENT", relatedId: "j1" },
        "TRAINER",
      ),
    ).toBe("/trainer/journals/j1");

    expect(
      getNotificationHref({ ...base, relatedType: "PT_SESSION", relatedId: "s1" }, "TRAINER"),
    ).toBe("/trainer/schedule");
  });

  it("회원은 기존 경로를 그대로 받는다", () => {
    expect(
      getNotificationHref({ ...base, relatedType: "JOURNAL", relatedId: "j1" }),
    ).toBe("/journal/j1");
  });
});
