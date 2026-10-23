import { randomUUID } from "node:crypto";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { prisma } from "@/lib/prisma";

vi.mock("@/lib/storage", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/storage")>()),
  removeObjects: vi.fn(async () => {}),
}));

import { removeObjects } from "@/lib/storage";
import {
  cancelGoal,
  deleteBodyRecord,
  getBodyOverview,
  getTrends,
  listBodyRecords,
  saveBodyRecord,
  setGoal,
} from "@/server/body/body.service";
import {
  createDiet,
  createDietPhotoUpload,
  deleteDiet,
  discardDietPhoto,
} from "@/server/diet/diet.service";

import { makePendingMember, makeTrainer } from "./helpers";

/** 오늘에서 days 일 떨어진 KST 날짜. 음수는 과거. */
const dateKey = (days: number) =>
  new Date(Date.now() + days * 86_400_000 + 9 * 3_600_000)
    .toISOString()
    .slice(0, 10);

async function makeMember() {
  const trainer = await makeTrainer();
  const member = await makePendingMember(trainer.userId);
  return member.memberUserId;
}

const removeMock = vi.mocked(removeObjects);

beforeEach(() => {
  removeMock.mockClear();
});

describe("체성분 흐름", () => {
  it("지표마다 따로 센다. 안 잰 칸은 건너뛴다", async () => {
    const userId = await makeMember();

    // 체중은 매일, 체지방은 사흘 전과 오늘만 쟀다.
    await saveBodyRecord(userId, {
      dateKey: dateKey(-3),
      weightKg: 72,
      bodyFatPercent: 25,
    });
    await saveBodyRecord(userId, { dateKey: dateKey(-2), weightKg: 71.5 });
    await saveBodyRecord(userId, { dateKey: dateKey(-1), weightKg: 71 });
    await saveBodyRecord(userId, {
      dateKey: dateKey(0),
      weightKg: 70.4,
      bodyFatPercent: 23.5,
    });

    const trends = getTrends(await listBodyRecords(userId));
    const weight = trends.find((t) => t.type === "WEIGHT")!;
    const fat = trends.find((t) => t.type === "BODY_FAT")!;
    const muscle = trends.find((t) => t.type === "MUSCLE_MASS")!;

    expect(weight.latest).toBe(70.4);
    expect(weight.previous).toBe(71);
    expect(weight.delta).toBe(-0.6);
    expect(weight.points.map((p) => p.value)).toEqual([72, 71.5, 71, 70.4]);

    // 사이의 빈 칸을 건너뛰고 실제로 잰 두 날을 비교한다.
    expect(fat.latest).toBe(23.5);
    expect(fat.previous).toBe(25);
    expect(fat.delta).toBe(-1.5);

    expect(muscle).toMatchObject({
      latest: null,
      previous: null,
      delta: null,
      points: [],
    });
  });

  it("점이 하나뿐이면 변화량을 말하지 않는다", async () => {
    const userId = await makeMember();
    await saveBodyRecord(userId, { dateKey: dateKey(0), weightKg: 70 });

    const weight = getTrends(await listBodyRecords(userId)).find(
      (t) => t.type === "WEIGHT",
    )!;

    expect(weight.latest).toBe(70);
    expect(weight.previous).toBeNull();
    expect(weight.delta).toBeNull();
  });

  it("남의 기록은 지우지 못한다", async () => {
    const owner = await makeMember();
    const other = await makeMember();
    const row = await saveBodyRecord(owner, {
      dateKey: dateKey(0),
      weightKg: 70,
    });

    await expect(deleteBodyRecord(other, row.id)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect(await listBodyRecords(owner)).toHaveLength(1);

    await deleteBodyRecord(owner, row.id);
    expect(await listBodyRecords(owner)).toHaveLength(0);
  });
});

describe("체성분 목표", () => {
  it("시작값은 그 시점의 가장 최근 값이다", async () => {
    const userId = await makeMember();
    await saveBodyRecord(userId, { dateKey: dateKey(-1), weightKg: 80 });

    const goal = await setGoal(userId, { type: "WEIGHT", targetValue: "70" });

    const row = await prisma.goal.findUniqueOrThrow({
      where: { id: goal.id },
      select: { startValue: true, targetValue: true, unit: true, status: true },
    });

    expect(Number(row.startValue)).toBe(80);
    expect(Number(row.targetValue)).toBe(70);
    expect(row.unit).toBe("kg");
    expect(row.status).toBe("ACTIVE");
  });

  it("같은 지표를 다시 세우면 이전 목표는 취소되고 하나만 남는다", async () => {
    const userId = await makeMember();
    await saveBodyRecord(userId, { dateKey: dateKey(0), weightKg: 80 });

    const first = await setGoal(userId, { type: "WEIGHT", targetValue: 75 });
    await setGoal(userId, { type: "BODY_FAT", targetValue: 20 });
    const second = await setGoal(userId, { type: "WEIGHT", targetValue: 70 });

    const active = await prisma.goal.findMany({
      where: { userId, status: "ACTIVE" },
      select: { id: true, type: true },
    });

    expect(active.map((g) => g.id).sort()).toHaveLength(2);
    expect(active.find((g) => g.type === "WEIGHT")!.id).toBe(second.id);

    const old = await prisma.goal.findUniqueOrThrow({
      where: { id: first.id },
      select: { status: true },
    });
    expect(old.status).toBe("CANCELLED");
  });

  it("진행률은 시작값에서 목표값까지의 비율이고 방향을 가리지 않는다", async () => {
    const userId = await makeMember();
    await saveBodyRecord(userId, {
      dateKey: dateKey(-2),
      weightKg: 80,
      skeletalMuscleKg: 30,
    });
    await setGoal(userId, { type: "WEIGHT", targetValue: 70 });
    await setGoal(userId, { type: "MUSCLE_MASS", targetValue: 34 });

    await saveBodyRecord(userId, {
      dateKey: dateKey(0),
      weightKg: 75,
      skeletalMuscleKg: 34.5,
    });

    const { goals } = await getBodyOverview(userId);
    const weight = goals.find((g) => g.type === "WEIGHT")!;
    const muscle = goals.find((g) => g.type === "MUSCLE_MASS")!;

    expect(weight.progress).toBe(0.5);
    expect(weight.remaining).toBe(5);
    expect(weight.reached).toBe(false);

    // 늘리려는 목표를 넘어섰다.
    expect(muscle.progress).toBe(1);
    expect(muscle.reached).toBe(true);
  });

  it("값이 비었거나 범위 밖이거나 날짜가 이상하면 거절한다", async () => {
    const userId = await makeMember();

    await expect(
      setGoal(userId, { type: "WEIGHT", targetValue: "" }),
    ).rejects.toMatchObject({ code: "EMPTY" });
    await expect(
      setGoal(userId, { type: "WEIGHT", targetValue: 700 }),
    ).rejects.toMatchObject({ code: "INVALID" });
    await expect(
      setGoal(userId, { type: "WEIGHT", targetValue: "abc" }),
    ).rejects.toMatchObject({ code: "INVALID" });
    await expect(
      setGoal(userId, {
        type: "WEIGHT",
        targetValue: 70,
        targetDate: "not-a-date",
      }),
    ).rejects.toMatchObject({ code: "INVALID" });

    expect(await prisma.goal.count({ where: { userId } })).toBe(0);
  });

  it("남의 목표는 취소하지 못한다", async () => {
    const owner = await makeMember();
    const other = await makeMember();
    const goal = await setGoal(owner, { type: "WEIGHT", targetValue: 70 });

    await expect(cancelGoal(other, goal.id)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });

    const row = await prisma.goal.findUniqueOrThrow({
      where: { id: goal.id },
      select: { status: true },
    });
    expect(row.status).toBe("ACTIVE");

    await cancelGoal(owner, goal.id);
    await expect(cancelGoal(owner, goal.id)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});

describe("식단 사진", () => {
  it("기록을 지우면 사진과 썸네일도 저장소에서 지운다", async () => {
    const userId = await makeMember();
    const key = randomUUID();
    const image = `diets/${userId}/${key}.webp`;
    const thumb = `diets/${userId}/${key}-thumb.webp`;

    const diet = await createDiet(userId, {
      dateKey: dateKey(0),
      mealType: "LUNCH",
      imagePath: image,
      thumbnailPath: thumb,
    });

    const result = await deleteDiet(userId, diet.id);

    expect(result.dateKey).toBe(dateKey(0));
    expect(
      await prisma.dietRecord.findUnique({ where: { id: diet.id } }),
    ).toBeNull();
    expect(removeMock).toHaveBeenCalledWith([image, thumb]);
  });

  it("사진이 없는 기록은 저장소를 건드리지 않는다", async () => {
    const userId = await makeMember();
    const diet = await createDiet(userId, {
      dateKey: dateKey(0),
      mealType: "DINNER",
      foodName: "샐러드",
    });

    await deleteDiet(userId, diet.id);

    // 빈 목록으로 부르는 것은 실제 구현에서 아무 일도 하지 않는다.
    expect(removeMock.mock.calls.every(([paths]) => paths.length === 0)).toBe(
      true,
    );
  });

  it("남의 기록은 지우지 못하고 사진도 그대로다", async () => {
    const owner = await makeMember();
    const other = await makeMember();
    const diet = await createDiet(owner, {
      dateKey: dateKey(0),
      mealType: "LUNCH",
      imagePath: `diets/${owner}/${randomUUID()}.webp`,
    });

    await expect(deleteDiet(other, diet.id)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });

    expect(
      await prisma.dietRecord.findUnique({ where: { id: diet.id } }),
    ).not.toBeNull();
    expect(removeMock).not.toHaveBeenCalled();
  });

  it("등록하지 않은 사진 버리기는 내 폴더 것만 지운다", async () => {
    const userId = await makeMember();
    const other = await makeMember();
    const mine = `diets/${userId}/${randomUUID()}.webp`;

    await discardDietPhoto(userId, mine);
    expect(removeMock).toHaveBeenCalledWith([
      mine,
      mine.replace(/\.webp$/, "-thumb.webp"),
    ]);

    removeMock.mockClear();
    await discardDietPhoto(userId, `diets/${other}/${randomUUID()}.webp`);
    await discardDietPhoto(userId, 123);
    await discardDietPhoto(userId, "");
    expect(removeMock).not.toHaveBeenCalled();
  });

  it("이미지가 아닌 파일은 올릴 자리를 주지 않는다", async () => {
    const userId = await makeMember();

    await expect(
      createDietPhotoUpload(userId, "application/pdf"),
    ).rejects.toMatchObject({ code: "INVALID" });
  });
});
