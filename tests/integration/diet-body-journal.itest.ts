import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import { prisma } from "@/lib/prisma";
import { saveBodyRecord } from "@/server/body/body.service";
import { getMemberBody } from "@/server/body/body-trainer.service";
import { createDiet, DietError } from "@/server/diet/diet.service";
import {
  addDietFeedback,
  getMemberDietDetail,
  listMemberDiet,
} from "@/server/diet/diet-trainer.service";
import {
  MAX_PHOTOS,
  attachPhoto,
  deleteJournalDraft,
  saveJournal,
  startJournal,
} from "@/server/journals/journal-editor.service";
import {
  addJournalComment,
  getJournalDetail,
} from "@/server/journals/journal.service";
import { getNotificationHref } from "@/server/notifications/notification.service";
import { SharingError } from "@/server/sharing/sharing.service";

import { makePendingMember, makeTrainer, uniq } from "./helpers";

const dateKeyDaysFromNow = (days: number) =>
  new Date(Date.now() + days * 86_400_000 + 9 * 3_600_000)
    .toISOString()
    .slice(0, 10);

/** 트레이너 한 명, 담당 회원 한 명, 그리고 담당이 아닌 다른 트레이너. */
async function setup() {
  const trainer = await makeTrainer();
  const member = await makePendingMember(trainer.userId);
  const stranger = await makeTrainer();

  return { trainer, member, stranger };
}

const setSharing = (
  memberUserId: string,
  data: Partial<{
    shareDiet: boolean;
    shareDietPhoto: boolean;
    shareBody: boolean;
    sharePersonalWorkout: boolean;
  }>,
) =>
  prisma.trainerSharingSetting.upsert({
    where: { userId: memberUserId },
    create: { userId: memberUserId, ...data },
    update: data,
  });

describe("식단", () => {
  it("사진도 글도 없으면 남기지 않는다", async () => {
    const { member } = await setup();

    await expect(
      createDiet(member.memberUserId, {
        dateKey: dateKeyDaysFromNow(0),
        mealType: "LUNCH",
      }),
    ).rejects.toMatchObject({ code: "EMPTY" });
  });

  it("남의 폴더 사진 경로는 붙지 않는다", async () => {
    const { member } = await setup();

    const created = await createDiet(member.memberUserId, {
      dateKey: dateKeyDaysFromNow(0),
      mealType: "LUNCH",
      foodName: "닭가슴살",
      imagePath: `diets/${randomUUID()}/other.webp`,
    });

    const row = await prisma.dietRecord.findUniqueOrThrow({
      where: { id: created.id },
      select: { imagePath: true, thumbnailPath: true },
    });

    expect(row).toEqual({ imagePath: null, thumbnailPath: null });
  });

  it("공유 중이면 트레이너가 피드백을 남기고 회원에게 알림이 간다", async () => {
    const { trainer, member } = await setup();

    const diet = await createDiet(member.memberUserId, {
      dateKey: dateKeyDaysFromNow(0),
      mealType: "DINNER",
      foodName: "샐러드",
    });

    const feedback = await addDietFeedback(
      trainer.userId,
      member.connectionId,
      diet.id,
      "  단백질을 더 드세요  ",
    );

    const saved = await prisma.dietFeedback.findUniqueOrThrow({
      where: { id: feedback.id },
      select: { content: true },
    });
    expect(saved.content).toBe("단백질을 더 드세요");

    expect(
      await prisma.notification.count({
        where: { userId: member.memberUserId, relatedId: diet.id },
      }),
    ).toBe(1);
  });

  it("회원이 식단 공유를 끄면 목록도 피드백도 막힌다", async () => {
    const { trainer, member } = await setup();
    const diet = await createDiet(member.memberUserId, {
      dateKey: dateKeyDaysFromNow(0),
      mealType: "LUNCH",
      foodName: "비빔밥",
    });

    await setSharing(member.memberUserId, { shareDiet: false });

    await expect(
      listMemberDiet(trainer.userId, member.connectionId),
    ).rejects.toBeInstanceOf(SharingError);
    await expect(
      addDietFeedback(trainer.userId, member.connectionId, diet.id, "안녕"),
    ).rejects.toBeInstanceOf(SharingError);
  });

  it("담당이 아닌 트레이너는 회원이 있는지조차 알 수 없다", async () => {
    const { member, stranger } = await setup();

    await expect(
      listMemberDiet(stranger.userId, member.connectionId),
    ).rejects.toMatchObject({ code: "NOT_MY_MEMBER" });
  });

  it("내 회원이라도 다른 회원의 식단에는 피드백을 못 남긴다", async () => {
    const { trainer, member } = await setup();
    const other = await setup();

    const othersDiet = await createDiet(other.member.memberUserId, {
      dateKey: dateKeyDaysFromNow(0),
      mealType: "LUNCH",
      foodName: "남의 점심",
    });

    await expect(
      addDietFeedback(
        trainer.userId,
        member.connectionId,
        othersDiet.id,
        "피드백",
      ),
    ).rejects.toBeInstanceOf(DietError);
  });
});

describe("식단 공유는 연결한 날부터", () => {
  async function withOldAndNewDiet() {
    const ctx = await setup();

    const old = await createDiet(ctx.member.memberUserId, {
      dateKey: dateKeyDaysFromNow(-5),
      mealType: "LUNCH",
      foodName: "연결 전 점심",
    });
    const fresh = await createDiet(ctx.member.memberUserId, {
      dateKey: dateKeyDaysFromNow(0),
      mealType: "DINNER",
      foodName: "연결한 날 저녁",
    });

    return { ...ctx, old, fresh };
  }

  it("연결 전에 올린 식단은 목록에 안 보이고, 연결한 날 것은 보인다", async () => {
    const { trainer, member } = await withOldAndNewDiet();

    const { days } = await listMemberDiet(trainer.userId, member.connectionId);
    const names = JSON.stringify(days);

    expect(names).toContain("연결한 날 저녁");
    expect(names).not.toContain("연결 전 점심");
  });

  it("연결 전 식단은 주소를 직접 알아도 열 수 없다", async () => {
    const { trainer, member, old, fresh } = await withOldAndNewDiet();

    await expect(
      getMemberDietDetail(trainer.userId, member.connectionId, old.id),
    ).rejects.toBeDefined();

    const detail = await getMemberDietDetail(
      trainer.userId,
      member.connectionId,
      fresh.id,
    );
    expect(detail.detail.foodName).toBe("연결한 날 저녁");
  });

  it("연결 전 식단에는 피드백을 남길 수 없다", async () => {
    const { trainer, member, old } = await withOldAndNewDiet();

    await expect(
      addDietFeedback(trainer.userId, member.connectionId, old.id, "피드백"),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });

    expect(
      await prisma.dietFeedback.count({ where: { dietRecordId: old.id } }),
    ).toBe(0);
  });
});

describe("신체 기록 공유", () => {
  it("기본값은 비공개라 트레이너가 볼 수 없다", async () => {
    const { trainer, member } = await setup();

    await saveBodyRecord(member.memberUserId, {
      dateKey: dateKeyDaysFromNow(0),
      weightKg: 70,
    });

    await expect(
      getMemberBody(trainer.userId, member.connectionId),
    ).rejects.toBeInstanceOf(SharingError);
  });

  it("공유를 켜면 연결한 날의 기록부터 보이고, 그 이전 날짜는 잘린다", async () => {
    const { trainer, member } = await setup();

    await saveBodyRecord(member.memberUserId, {
      dateKey: dateKeyDaysFromNow(-3),
      weightKg: 80,
    });
    // 날짜 단위 기록이라 자정으로 저장된다. 연결한 날 적은 오늘 기록도 보여야 한다.
    await saveBodyRecord(member.memberUserId, {
      dateKey: dateKeyDaysFromNow(0),
      weightKg: 75,
    });

    await setSharing(member.memberUserId, { shareBody: true });

    const body = await getMemberBody(trainer.userId, member.connectionId);

    expect(body.rows.map((row) => row.weightKg)).toEqual([75]);
    // 날짜 키는 회원이 적은 날(KST)과 같아야 한다.
    expect(body.rows[0].dateKey).toBe(dateKeyDaysFromNow(0));
  });
});

describe("알림장", () => {
  async function publishedJournal() {
    const ctx = await setup();
    const journalId = await startJournal(
      ctx.trainer.userId,
      ctx.member.connectionId,
    );

    await saveJournal(ctx.trainer.userId, journalId, {
      title: "오늘 수업",
      content: "스쿼트 잘 했어요",
      publish: true,
    });

    return { ...ctx, journalId };
  }

  it("같은 날 초안은 새로 만들지 않고 이어 쓴다", async () => {
    const { trainer, member } = await setup();

    const first = await startJournal(trainer.userId, member.connectionId);
    const second = await startJournal(trainer.userId, member.connectionId);

    expect(second).toBe(first);
  });

  it("내용 없이는 게시할 수 없다", async () => {
    const { trainer, member } = await setup();
    const id = await startJournal(trainer.userId, member.connectionId);

    await expect(
      saveJournal(trainer.userId, id, { content: "   ", publish: true }),
    ).rejects.toMatchObject({ code: "INVALID" });
  });

  it("게시하면 회원에게 알림이 한 번만 가고, 다시 저장해도 또 가지 않는다", async () => {
    const { trainer, member, journalId } = await publishedJournal();

    const count = () =>
      prisma.notification.count({
        where: {
          userId: member.memberUserId,
          type: "JOURNAL_CREATED",
          relatedId: journalId,
        },
      });

    expect(await count()).toBe(1);

    await saveJournal(trainer.userId, journalId, {
      content: "수정한 내용",
      publish: true,
    });

    expect(await count()).toBe(1);
  });

  it("초안은 회원이 볼 수 없고, 게시하면 볼 수 있다", async () => {
    const { trainer, member } = await setup();
    const id = await startJournal(trainer.userId, member.connectionId);

    await saveJournal(trainer.userId, id, { content: "초안", publish: false });

    await expect(
      getJournalDetail(member.memberUserId, id),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });

    await saveJournal(trainer.userId, id, { content: "초안", publish: true });

    const detail = await getJournalDetail(member.memberUserId, id);
    expect(detail.viewerRole).toBe("MEMBER");
  });

  it("게시한 알림장은 삭제할 수 없다", async () => {
    const { trainer, journalId } = await publishedJournal();

    await expect(
      deleteJournalDraft(trainer.userId, journalId),
    ).rejects.toBeDefined();

    expect(await prisma.journal.count({ where: { id: journalId } })).toBe(1);
  });

  it("담당이 아닌 사람은 읽지도 댓글을 달지도 못한다", async () => {
    const { stranger, journalId } = await publishedJournal();
    const outsider = await makePendingMember(stranger.userId);

    await expect(
      getJournalDetail(outsider.memberUserId, journalId),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      addJournalComment(outsider.memberUserId, journalId, "끼어들기"),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      addJournalComment(stranger.userId, journalId, "끼어들기"),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("회원 댓글은 트레이너에게 알림이 가고, 빈 댓글과 긴 댓글은 거절된다", async () => {
    const { trainer, member, journalId } = await publishedJournal();

    await addJournalComment(member.memberUserId, journalId, "감사합니다");

    expect(
      await prisma.notification.count({
        where: { userId: trainer.userId, relatedType: "JOURNAL_COMMENT" },
      }),
    ).toBe(1);

    await expect(
      addJournalComment(member.memberUserId, journalId, "   "),
    ).rejects.toMatchObject({ code: "EMPTY" });
    await expect(
      addJournalComment(member.memberUserId, journalId, "가".repeat(1001)),
    ).rejects.toMatchObject({ code: "TOO_LONG" });
  });

  it("트레이너가 댓글을 달면 회원에게 알림이 가고, 알림은 그 알림장으로 연결된다", async () => {
    const { trainer, member, journalId } = await publishedJournal();

    await addJournalComment(trainer.userId, journalId, "다음 주에 봐요");

    const notices = await prisma.notification.findMany({
      where: { userId: member.memberUserId, relatedType: "JOURNAL" },
      select: { relatedId: true, title: true, type: true },
    });

    // 게시할 때 간 알림(JOURNAL_CREATED)과 별개로 댓글 알림이 하나 더 있다.
    const reply = notices.filter((n) => n.type === "GENERAL");
    expect(reply).toHaveLength(1);
    expect(reply[0].relatedId).toBe(journalId);
    expect(
      getNotificationHref({
        type: "GENERAL",
        relatedType: "JOURNAL",
        relatedId: journalId,
      }),
    ).toBe(`/journal/${journalId}`);
  });

  it("회원이 자기 댓글로 자기 알림을 받지는 않고, 트레이너 댓글은 트레이너에게 알림을 만들지 않는다", async () => {
    const { trainer, member, journalId } = await publishedJournal();

    await addJournalComment(member.memberUserId, journalId, "감사합니다");
    await addJournalComment(trainer.userId, journalId, "네");

    expect(
      await prisma.notification.count({
        where: { userId: member.memberUserId, type: "GENERAL" },
      }),
    ).toBe(1);
    expect(
      await prisma.notification.count({
        where: { userId: trainer.userId, relatedType: "JOURNAL_COMMENT" },
      }),
    ).toBe(1);
  });

  describe("사진", () => {
    it("업로드가 만든 경로만 붙고, 한도를 넘으면 거절된다", async () => {
      const { trainer, member } = await setup();
      const id = await startJournal(trainer.userId, member.connectionId);
      const path = () => `journals/${id}/${randomUUID()}.webp`;

      await expect(
        attachPhoto(trainer.userId, id, `journals/${id}/../x.webp`, null),
      ).rejects.toMatchObject({ code: "INVALID" });
      await expect(
        attachPhoto(trainer.userId, id, path(), `journals/${uniq()}/t.webp`),
      ).rejects.toMatchObject({ code: "INVALID" });

      for (let i = 0; i < MAX_PHOTOS; i += 1) {
        await attachPhoto(trainer.userId, id, path(), null);
      }

      await expect(
        attachPhoto(trainer.userId, id, path(), null),
      ).rejects.toMatchObject({ code: "TOO_MANY_PHOTOS" });
    });

    it("남의 알림장에는 사진을 붙일 수 없다", async () => {
      const { trainer, member, stranger } = await setup();
      const id = await startJournal(trainer.userId, member.connectionId);

      await expect(
        attachPhoto(
          stranger.userId,
          id,
          `journals/${id}/${randomUUID()}.webp`,
          null,
        ),
      ).rejects.toBeDefined();
    });
  });
});
