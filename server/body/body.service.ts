import "server-only";

import { GoalStatus, GoalType } from "@/generated/prisma/enums";
import { kstStartOfDay, toKstDateKey } from "@/lib/date";
import { prisma } from "@/lib/prisma";

/**
 * 회원이 재는 몸.
 *
 * 체중 · 체지방 · 골격근 세 가지만 받는다. 인바디 용지에 있는 스무 가지를 다
 * 받으면 옮겨 적다가 안 적게 된다. 세 가지는 대부분의 체중계에도 뜬다.
 *
 * 목표도 이 세 가지에 대해서만 만든다. 목표의 "지금 값" 은 저장하지 않고 늘
 * 최신 기록에서 읽는다. 저장하면 회원이 체중을 새로 적는 순간 목표 카드만
 * 옛날 숫자로 남는다.
 */

export class BodyError extends Error {
  constructor(
    readonly code: "NOT_FOUND" | "INVALID" | "EMPTY",
    message: string,
  ) {
    super(message);
    this.name = "BodyError";
  }
}

/** 우리가 다루는 목표. Goal 표에는 여섯 종류가 있지만 나머지는 아직 출처가 없다. */
export const BODY_GOAL_TYPES = [
  GoalType.WEIGHT,
  GoalType.BODY_FAT,
  GoalType.MUSCLE_MASS,
] as const;

export type BodyGoalType = (typeof BODY_GOAL_TYPES)[number];

type MetricField = "weightKg" | "bodyFatPercent" | "skeletalMuscleKg";

/** 지표 하나를 다루는 데 필요한 것을 한자리에 모은다. */
export const METRIC: Record<
  BodyGoalType,
  {
    label: string;
    unit: string;
    field: MetricField;
    min: number;
    max: number;
  }
> = {
  WEIGHT: {
    label: "체중",
    unit: "kg",
    field: "weightKg",
    min: 20,
    max: 300,
  },
  BODY_FAT: {
    label: "체지방률",
    unit: "%",
    field: "bodyFatPercent",
    min: 1,
    max: 70,
  },
  MUSCLE_MASS: {
    label: "골격근량",
    unit: "kg",
    field: "skeletalMuscleKg",
    min: 5,
    max: 100,
  },
};

const WAIST = { label: "허리둘레", unit: "cm", min: 30, max: 200 };

const MAX_MEMO = 300;

export function parseGoalType(value: unknown): BodyGoalType | null {
  return typeof value === "string" && value in METRIC
    ? (value as BodyGoalType)
    : null;
}

/**
 * 폼에서 온 숫자.
 *
 * 빈 칸은 null 이다. 셋 다 선택이라 "안 쟀다" 와 "0 이다" 를 구분해야 한다.
 * 범위를 벗어나면 오류로 돌려보낸다. 71 을 710 으로 잘못 치는 일이 흔하고,
 * 한 번 들어가면 그래프가 통째로 눌린다.
 */
function readNumber(
  raw: unknown,
  range: { label: string; unit: string; min: number; max: number },
) {
  const text = String(raw ?? "").trim();
  if (text === "") return null;

  const value = Number(text);

  if (!Number.isFinite(value) || value < range.min || value > range.max) {
    throw new BodyError(
      "INVALID",
      `${range.label}은(는) ${range.min}${range.unit}부터 ${range.max}${range.unit} 사이로 넣어주세요.`,
    );
  }

  // 소수 한 자리까지만 둔다. 체중계가 더 주지 않고, 더 받으면 축이 지저분해진다.
  return Math.round(value * 10) / 10;
}

/** Decimal 을 화면으로 내보내기 전에 숫자로 바꾼다. 직렬화하면서 깨지지 않게. */
function toNumber(value: { toString(): string } | null | undefined) {
  return value === null || value === undefined
    ? null
    : Number(value.toString());
}

export interface BodyRow {
  id: string;
  recordedAt: Date;
  dateKey: string;
  weightKg: number | null;
  bodyFatPercent: number | null;
  skeletalMuscleKg: number | null;
  waistCm: number | null;
  memo: string | null;
}

const RECORD_SELECT = {
  id: true,
  recordedAt: true,
  weightKg: true,
  bodyFatPercent: true,
  skeletalMuscleKg: true,
  waistCm: true,
  memo: true,
} as const;

function toRow(record: {
  id: string;
  recordedAt: Date;
  weightKg: { toString(): string } | null;
  bodyFatPercent: { toString(): string } | null;
  skeletalMuscleKg: { toString(): string } | null;
  waistCm: { toString(): string } | null;
  memo: string | null;
}): BodyRow {
  return {
    id: record.id,
    recordedAt: record.recordedAt,
    dateKey: toKstDateKey(record.recordedAt),
    weightKg: toNumber(record.weightKg),
    bodyFatPercent: toNumber(record.bodyFatPercent),
    skeletalMuscleKg: toNumber(record.skeletalMuscleKg),
    waistCm: toNumber(record.waistCm),
    memo: record.memo,
  };
}

/**
 * 몸을 기록한다.
 *
 * 같은 날 다시 적으면 덮어쓴다. 새 줄을 만들면 하루에 두 점이 찍히는데,
 * 체중은 하루 안에서도 1~2kg 이 움직여서 그 톱니가 실제 변화보다 커 보인다.
 */
export async function saveBodyRecord(
  userId: string,
  input: {
    dateKey: string;
    weightKg?: unknown;
    bodyFatPercent?: unknown;
    skeletalMuscleKg?: unknown;
    waistCm?: unknown;
    memo?: unknown;
  },
) {
  const parsed = new Date(`${input.dateKey}T00:00:00+09:00`);

  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(input.dateKey) ||
    Number.isNaN(parsed.getTime())
  ) {
    throw new BodyError("INVALID", "날짜를 확인해주세요.");
  }

  const recordedAt = kstStartOfDay(parsed);

  if (recordedAt.getTime() > kstStartOfDay().getTime()) {
    throw new BodyError("INVALID", "아직 오지 않은 날은 적을 수 없어요.");
  }

  const weightKg = readNumber(input.weightKg, METRIC.WEIGHT);
  const bodyFatPercent = readNumber(input.bodyFatPercent, METRIC.BODY_FAT);
  const skeletalMuscleKg = readNumber(
    input.skeletalMuscleKg,
    METRIC.MUSCLE_MASS,
  );
  const waistCm = readNumber(input.waistCm, WAIST);

  if (
    weightKg === null &&
    bodyFatPercent === null &&
    skeletalMuscleKg === null &&
    waistCm === null
  ) {
    throw new BodyError("EMPTY", "적어도 하나는 채워주세요.");
  }

  const memo =
    String(input.memo ?? "")
      .trim()
      .slice(0, MAX_MEMO) || null;

  const data = { weightKg, bodyFatPercent, skeletalMuscleKg, waistCm, memo };

  const record = await prisma.bodyRecord.upsert({
    where: { userId_recordedAt: { userId, recordedAt } },
    create: { userId, recordedAt, ...data },
    update: data,
    select: RECORD_SELECT,
  });

  return toRow(record);
}

export async function deleteBodyRecord(userId: string, recordId: string) {
  const deleted = await prisma.bodyRecord.deleteMany({
    where: { id: recordId, userId },
  });

  if (deleted.count === 0) {
    throw new BodyError("NOT_FOUND", "기록을 찾을 수 없어요.");
  }
}

/** 최근 기록. 그래프와 목록이 같은 것을 본다. */
export async function listBodyRecords(userId: string, limit = 60) {
  const records = await prisma.bodyRecord.findMany({
    where: { userId },
    orderBy: { recordedAt: "desc" },
    take: limit,
    select: RECORD_SELECT,
  });

  return records.map(toRow);
}

export async function getBodyRecord(userId: string, recordId: string) {
  const record = await prisma.bodyRecord.findFirst({
    where: { id: recordId, userId },
    select: RECORD_SELECT,
  });

  if (!record) {
    throw new BodyError("NOT_FOUND", "기록을 찾을 수 없어요.");
  }

  return toRow(record);
}

export interface MetricTrend {
  type: BodyGoalType;
  label: string;
  unit: string;
  /** 가장 최근에 잰 값. 안 쟀으면 null. */
  latest: number | null;
  latestAt: Date | null;
  /** 그 전에 잰 값. 변화량을 말하려면 두 점이 있어야 한다. */
  previous: number | null;
  previousAt: Date | null;
  /** latest - previous. 둘 중 하나라도 없으면 null. */
  delta: number | null;
  /** 그래프에 찍을 점. 오래된 것이 먼저. */
  points: { at: Date; value: number }[];
}

/**
 * 지표별 최근 흐름.
 *
 * 지표마다 따로 찾는다. 체중만 매일 재고 체지방은 한 달에 한 번 재는 사람이
 * 흔한데, 최근 기록 두 줄을 통째로 비교하면 "체지방 변화 없음" 이라고 잘못
 * 말하게 된다. 비어 있는 칸은 건너뛰고 그 지표를 실제로 적은 날만 본다.
 */
export function getTrends(records: BodyRow[]): MetricTrend[] {
  return BODY_GOAL_TYPES.map((type) => {
    const meta = METRIC[type];

    const points = records
      .filter((row) => row[meta.field] !== null)
      .map((row) => ({ at: row.recordedAt, value: row[meta.field] as number }));

    const latest = points[0] ?? null;
    const previous = points[1] ?? null;

    return {
      type,
      label: meta.label,
      unit: meta.unit,
      latest: latest?.value ?? null,
      latestAt: latest?.at ?? null,
      previous: previous?.value ?? null,
      previousAt: previous?.at ?? null,
      delta:
        latest && previous
          ? Math.round((latest.value - previous.value) * 10) / 10
          : null,
      points: [...points].reverse(),
    };
  });
}

export interface GoalView {
  id: string;
  type: BodyGoalType;
  label: string;
  unit: string;
  targetValue: number;
  startValue: number | null;
  /** 저장하지 않는다. 늘 최신 기록에서 읽는다. */
  currentValue: number | null;
  targetDate: Date | null;
  startDate: Date;
  status: GoalStatus;
  /** 0~1. 시작값을 모르면 null. */
  progress: number | null;
  /** 목표까지 남은 양. 방향과 상관없이 양수. */
  remaining: number | null;
  reached: boolean;
}

/**
 * 목표에 진행률을 붙인다.
 *
 * 방향은 시작값과 목표값으로 정한다. 체중은 줄이려는 사람도 늘리려는 사람도
 * 있어서 "낮을수록 좋다" 로 못 박을 수 없다.
 */
function toGoalView(
  goal: {
    id: string;
    type: GoalType;
    targetValue: { toString(): string } | null;
    startValue: { toString(): string } | null;
    targetDate: Date | null;
    startDate: Date;
    status: GoalStatus;
  },
  currentValue: number | null,
): GoalView {
  const type = goal.type as BodyGoalType;
  const meta = METRIC[type];

  const target = Number(goal.targetValue?.toString() ?? "0");
  const start = toNumber(goal.startValue);

  let progress: number | null = null;
  let reached = false;

  if (currentValue !== null) {
    const goingUp = start === null ? currentValue < target : target > start;
    reached = goingUp ? currentValue >= target : currentValue <= target;

    if (start !== null && start !== target) {
      progress = Math.min(
        Math.max((currentValue - start) / (target - start), 0),
        1,
      );
    } else if (reached) {
      // 시작값을 모르면 진행률을 못 그리지만, 닿았다는 건 말할 수 있다.
      progress = 1;
    }
  }

  return {
    id: goal.id,
    type,
    label: meta.label,
    unit: meta.unit,
    targetValue: target,
    startValue: start,
    currentValue,
    targetDate: goal.targetDate,
    startDate: goal.startDate,
    status: goal.status,
    progress,
    remaining:
      currentValue === null
        ? null
        : Math.round(Math.abs(target - currentValue) * 10) / 10,
    reached,
  };
}

/** 진행 중인 목표들. 지금 값은 최근 기록에서 붙인다. */
export async function listGoals(
  userId: string,
  trends: MetricTrend[],
): Promise<GoalView[]> {
  const goals = await prisma.goal.findMany({
    where: {
      userId,
      status: GoalStatus.ACTIVE,
      type: { in: [...BODY_GOAL_TYPES] },
    },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      type: true,
      targetValue: true,
      startValue: true,
      targetDate: true,
      startDate: true,
      status: true,
    },
  });

  return goals.map((goal) =>
    toGoalView(
      goal,
      trends.find((trend) => trend.type === goal.type)?.latest ?? null,
    ),
  );
}

/**
 * 목표를 세운다.
 *
 * 지표당 하나만 둔다. 체중 목표가 셋이면 어느 것을 보고 있는지 알 수 없다.
 * 이미 있으면 갈아 끼우고 시작값을 지금 값으로 다시 박는다. 목표를 고쳐
 * 세운다는 건 대개 그 시점부터 다시 세겠다는 뜻이다.
 */
export async function setGoal(
  userId: string,
  input: {
    type: BodyGoalType;
    targetValue: unknown;
    targetDate?: string | null;
  },
) {
  const meta = METRIC[input.type];
  const target = readNumber(input.targetValue, meta);

  if (target === null) {
    throw new BodyError("EMPTY", "목표 값을 넣어주세요.");
  }

  let targetDate: Date | null = null;
  if (input.targetDate) {
    targetDate = new Date(`${input.targetDate}T00:00:00+09:00`);
    if (Number.isNaN(targetDate.getTime())) {
      throw new BodyError("INVALID", "목표 날짜를 확인해주세요.");
    }
  }

  const latest = await prisma.bodyRecord.findFirst({
    where: { userId, [meta.field]: { not: null } },
    orderBy: { recordedAt: "desc" },
    select: { [meta.field]: true },
  });

  const startValue = toNumber(
    (latest as Record<string, { toString(): string } | null> | null)?.[
      meta.field
    ],
  );

  return prisma.$transaction(async (tx) => {
    await tx.goal.updateMany({
      where: { userId, type: input.type, status: GoalStatus.ACTIVE },
      data: { status: GoalStatus.CANCELLED },
    });

    return tx.goal.create({
      data: {
        userId,
        type: input.type,
        title: `목표 ${meta.label}`,
        targetValue: target,
        startValue,
        unit: meta.unit,
        startDate: new Date(),
        targetDate,
      },
      select: { id: true, type: true },
    });
  });
}

export async function cancelGoal(userId: string, goalId: string) {
  const updated = await prisma.goal.updateMany({
    where: { id: goalId, userId, status: GoalStatus.ACTIVE },
    data: { status: GoalStatus.CANCELLED },
  });

  if (updated.count === 0) {
    throw new BodyError("NOT_FOUND", "목표를 찾을 수 없어요.");
  }
}

/** 체성분 화면이 한 번에 필요한 것. */
export async function getBodyOverview(userId: string) {
  const records = await listBodyRecords(userId);
  const trends = getTrends(records);
  const goals = await listGoals(userId, trends);

  return { records, trends, goals };
}
