import { describe, expect, it } from "vitest";

import { prisma } from "@/lib/prisma";
import {
  deleteJournalDraft,
  getJournalDraft,
  removePhoto,
  saveJournal,
  startJournal,
} from "@/server/journals/journal-editor.service";
import {
  addJournalComment,
  getJournalDetail,
} from "@/server/journals/journal.service";
import {
  cancelContract,
  createContract,
  extendContract,
} from "@/server/pt/pt.service";
import { endConnection } from "@/server/trainers/connection.service";
import { getTrainerHome } from "@/server/trainers/trainer.service";

import { makePendingMember, makeTrainer, uniq } from "./helpers";

/**
 * 서비스가 호출한 사람을 직접 확인하는지 본다.
 *
 * 서버 액션은 세션에서 사용자를 읽어 서비스에 넘길 뿐이라, 권한 검사는 서비스에
 * 있어야 한다. 화면이 숨기는 것은 막은 것이 아니다.
 */
async function setup() {
  const trainer = await makeTrainer();
  const member = await makePendingMember(trainer.userId);
  const stranger = await makeTrainer();

  // 회원이 아닌 일반 계정. 트레이너 프로필이 없다.
  const outsider = await prisma.user.create({
    data: {
      name: `일반${uniq()}`,
      email: `perm-${uniq()}@test.com`,
      passwordHash: "x",
    },
    select: { id: true },
  });

  return { trainer, member, stranger, outsider: outsider.id };
}

async function publishedJournal() {
  const ctx = await setup();
  const journalId = await startJournal(
    ctx.trainer.userId,
    ctx.member.connectionId,
  );
  await saveJournal(ctx.trainer.userId, journalId, {
    title: "오늘 수업",
    content: "스쿼트",
    publish: true,
  });
  return { ...ctx, journalId };
}

describe("트레이너 전용 서비스", () => {
  it("트레이너 프로필이 없는 계정은 쓰지 못한다", async () => {
    const { member, outsider } = await setup();

    await expect(getTrainerHome(outsider)).rejects.toThrow();
    await expect(startJournal(outsider, member.connectionId)).rejects.toThrow();
    await expect(
      createContract(outsider, {
        connectionId: member.connectionId,
        totalSessions: 10,
        startedAt: new Date(),
      }),
    ).rejects.toThrow();
  });

  it("담당이 아닌 트레이너는 남의 회원에게 알림장도 계약도 만들지 못한다", async () => {
    const { member, stranger } = await setup();

    await expect(
      startJournal(stranger.userId, member.connectionId),
    ).rejects.toThrow();
    await expect(
      createContract(stranger.userId, {
        connectionId: member.connectionId,
        totalSessions: 10,
        startedAt: new Date(),
      }),
    ).rejects.toThrow();

    expect(
      await prisma.journal.count({
        where: { memberUserId: member.memberUserId },
      }),
    ).toBe(0);
    expect(
      await prisma.pTContract.count({
        where: { memberUserId: member.memberUserId },
      }),
    ).toBe(0);
  });

  it("담당이 아닌 트레이너는 남의 계약을 바꾸거나 취소하지 못한다", async () => {
    const { trainer, member, stranger } = await setup();
    const contract = await createContract(trainer.userId, {
      connectionId: member.connectionId,
      totalSessions: 10,
      startedAt: new Date(),
    });

    await expect(
      cancelContract(stranger.userId, contract.id),
    ).rejects.toThrow();
    await expect(
      extendContract(stranger.userId, contract.id, new Date()),
    ).rejects.toThrow();

    const row = await prisma.pTContract.findUniqueOrThrow({
      where: { id: contract.id },
      select: { status: true },
    });
    expect(row.status).toBe("ACTIVE");
  });

  it("담당이 아닌 트레이너는 남의 알림장을 보거나 고치거나 지우지 못한다", async () => {
    const { trainer, member, stranger } = await setup();
    const journalId = await startJournal(trainer.userId, member.connectionId);

    await expect(getJournalDraft(stranger.userId, journalId)).rejects.toThrow();
    await expect(
      saveJournal(stranger.userId, journalId, {
        title: "바꿈",
        content: "x",
        publish: true,
      }),
    ).rejects.toThrow();
    await expect(
      deleteJournalDraft(stranger.userId, journalId),
    ).rejects.toThrow();
    await expect(
      removePhoto(stranger.userId, journalId, "none"),
    ).rejects.toThrow();

    const row = await prisma.journal.findUniqueOrThrow({
      where: { id: journalId },
      select: { status: true, title: true },
    });
    expect(row.status).toBe("DRAFT");
    expect(row.title).not.toBe("바꿈");
  });
});

describe("알림장 열람과 댓글", () => {
  it("게시된 알림장도 당사자가 아니면 보거나 댓글을 달지 못한다", async () => {
    const { journalId, trainer, member, stranger, outsider } =
      await publishedJournal();

    for (const userId of [stranger.userId, outsider]) {
      await expect(getJournalDetail(userId, journalId)).rejects.toThrow();
      await expect(
        addJournalComment(userId, journalId, "끼어들기"),
      ).rejects.toThrow();
    }

    // 당사자는 본다.
    await expect(
      getJournalDetail(trainer.userId, journalId),
    ).resolves.toBeTruthy();
    await expect(
      getJournalDetail(member.memberUserId, journalId),
    ).resolves.toBeTruthy();

    expect(await prisma.journalComment.count({ where: { journalId } })).toBe(0);
  });

  it("작성 중인 초안은 회원에게도 보이지 않는다", async () => {
    const { trainer, member } = await setup();
    const journalId = await startJournal(trainer.userId, member.connectionId);

    await expect(
      getJournalDetail(member.memberUserId, journalId),
    ).rejects.toThrow();
  });
});

describe("연결 끊기", () => {
  it("연결의 당사자가 아니면 끊지 못한다", async () => {
    const { member, stranger, outsider } = await setup();

    await expect(
      endConnection(stranger.userId, member.connectionId),
    ).rejects.toThrow();
    await expect(
      endConnection(outsider, member.connectionId),
    ).rejects.toThrow();

    const row = await prisma.trainerMemberConnection.findUniqueOrThrow({
      where: { id: member.connectionId },
      select: { status: true },
    });
    expect(row.status).toBe("ACTIVE");
  });
});
