import { describe, expect, it } from "vitest";

import { prisma } from "@/lib/prisma";
import {
  cancelSession,
  completeSession,
  createContract,
  reopenSession,
  scheduleSession,
} from "@/server/pt/pt.service";

import { makeContract } from "./helpers";

const when = (hoursFromNow: number) =>
  new Date(Date.now() + hoursFromNow * 3_600_000);

const contractOf = (id: string) =>
  prisma.pTContract.findUniqueOrThrow({
    where: { id },
    select: { usedSessions: true, status: true },
  });

async function book(
  userId: string,
  contractId: string,
  hoursFromNow: number,
) {
  return scheduleSession(userId, {
    contractId,
    scheduledAt: when(hoursFromNow),
  });
}

describe("횟수 차감", () => {
  it("완료하면 차감되고, 다 쓰면 계약이 닫히고, 되돌리면 다시 열린다", async () => {
    const { trainer, contractId } = await makeContract(2, createContract);

    const first = await book(trainer.userId, contractId, 1);
    const second = await book(trainer.userId, contractId, 2);

    await completeSession(trainer.userId, first.id);
    expect(await contractOf(contractId)).toEqual({
      usedSessions: 1,
      status: "ACTIVE",
    });

    await completeSession(trainer.userId, second.id);
    expect(await contractOf(contractId)).toEqual({
      usedSessions: 2,
      status: "COMPLETED",
    });

    await reopenSession(trainer.userId, second.id);
    expect(await contractOf(contractId)).toEqual({
      usedSessions: 1,
      status: "ACTIVE",
    });
  });

  it("취소한 수업은 차감하지 않고, 취소한 자리는 다시 잡을 수 있다", async () => {
    const { trainer, contractId } = await makeContract(1, createContract);

    const session = await book(trainer.userId, contractId, 1);
    await cancelSession(trainer.userId, session.id, {
      cancelledBy: "TRAINER",
    });

    expect((await contractOf(contractId)).usedSessions).toBe(0);
    await expect(book(trainer.userId, contractId, 2)).resolves.toBeDefined();
  });

  it("같은 수업을 동시에 두 번 완료해도 한 번만 차감된다", async () => {
    const { trainer, contractId } = await makeContract(5, createContract);
    const session = await book(trainer.userId, contractId, 1);

    await Promise.allSettled([
      completeSession(trainer.userId, session.id),
      completeSession(trainer.userId, session.id),
    ]);

    expect((await contractOf(contractId)).usedSessions).toBe(1);
  });

  it("다른 트레이너는 남의 수업을 완료할 수 없다", async () => {
    const { trainer, contractId } = await makeContract(3, createContract);
    const other = await makeContract(3, createContract);
    const session = await book(trainer.userId, contractId, 1);

    await expect(
      completeSession(other.trainer.userId, session.id),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect((await contractOf(contractId)).usedSessions).toBe(0);
  });
});

describe("수업 잡기", () => {
  it("남은 횟수를 넘겨서 잡을 수 없다", async () => {
    const { trainer, contractId } = await makeContract(2, createContract);

    await book(trainer.userId, contractId, 1);
    await book(trainer.userId, contractId, 2);

    await expect(book(trainer.userId, contractId, 3)).rejects.toMatchObject({
      code: "NO_SESSIONS_LEFT",
    });
  });

  it("동시에 잡아도 남은 횟수를 넘지 않는다", async () => {
    const { trainer, contractId } = await makeContract(1, createContract);

    const results = await Promise.allSettled(
      [1, 2, 3, 4].map((h) => book(trainer.userId, contractId, h)),
    );

    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(
      await prisma.pTSession.count({ where: { contractId } }),
    ).toBe(1);
  });

  it("동시에 잡아도 회차 번호가 겹치지 않고 모두 성공한다", async () => {
    const { trainer, contractId } = await makeContract(10, createContract);

    const results = await Promise.allSettled(
      [1, 2, 3, 4, 5].map((h) => book(trainer.userId, contractId, h)),
    );

    expect(results.map((r) => r.status)).toEqual(Array(5).fill("fulfilled"));

    const numbers = (
      await prisma.pTSession.findMany({
        where: { contractId },
        select: { sessionNumber: true },
        orderBy: { sessionNumber: "asc" },
      })
    ).map((s) => s.sessionNumber);

    expect(numbers).toEqual([1, 2, 3, 4, 5]);
  });
});
