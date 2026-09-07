import "server-only";

import { randomUUID } from "node:crypto";

import { DietMealType } from "@/generated/prisma/enums";
import { toKstDateKey } from "@/lib/date";
import { prisma } from "@/lib/prisma";
import {
  createSignedReadUrls,
  createSignedUpload,
  removeObjects,
} from "@/lib/storage";

/**
 * 회원이 올리는 식단.
 *
 * 칼로리 · 탄단지는 받지 않는다. 끼니마다 숫자 넷을 손으로 적게 하면 사흘 만에 안
 * 올리게 된다. 식단을 올리는 목적이 대개 "트레이너에게 보여주고 피드백 받기" 라
 * 사진 한 장과 한 줄이면 충분하다. 칼럼은 남겨 두고 나중에 채운다.
 */

export const MEAL_LABEL: Record<DietMealType, string> = {
  BREAKFAST: "아침",
  LUNCH: "점심",
  DINNER: "저녁",
  SNACK: "간식",
  OTHER: "기타",
};

/** 화면에 늘어놓는 순서. enum 선언 순서에 기대면 스키마를 고칠 때 같이 흔들린다. */
export const MEAL_ORDER: DietMealType[] = [
  DietMealType.BREAKFAST,
  DietMealType.LUNCH,
  DietMealType.DINNER,
  DietMealType.SNACK,
  DietMealType.OTHER,
];

const MAX_FOOD_NAME = 100;
const MAX_MEMO = 500;
export const MAX_FEEDBACK = 1000;

const ALLOWED_MIME = ["image/webp", "image/jpeg", "image/png"];

export class DietError extends Error {
  constructor(
    readonly code: "NOT_FOUND" | "INVALID" | "EMPTY",
    message: string,
  ) {
    super(message);
    this.name = "DietError";
  }
}

export function parseMealType(value: unknown): DietMealType | null {
  return typeof value === "string" && value in MEAL_LABEL
    ? (value as DietMealType)
    : null;
}

/** YYYY-MM-DD 인지 보고, 아니면 오늘. 주소로 아무 값이나 들어올 수 있다. */
export function parseDateKey(value: unknown): string {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const parsed = new Date(`${value}T00:00:00+09:00`);
    if (!Number.isNaN(parsed.getTime())) return toKstDateKey(parsed);
  }
  return toKstDateKey(new Date());
}

/**
 * 지금 시각으로 끼니를 짐작한다.
 *
 * 등록 화면을 열었을 때 미리 골라 두는 값일 뿐이다. 대충 맞으면 한 번 덜 누르고,
 * 틀려도 바꾸면 그만이라 경계를 정교하게 나눌 이유가 없다.
 */
export function guessMealType(now: Date = new Date()): DietMealType {
  const hour = Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Seoul",
      hour: "2-digit",
      hour12: false,
    }).format(now),
  );

  if (hour < 10) return DietMealType.BREAKFAST;
  if (hour < 15) return DietMealType.LUNCH;
  if (hour < 21) return DietMealType.DINNER;
  return DietMealType.SNACK;
}

const recordSelect = {
  id: true,
  date: true,
  mealType: true,
  foodName: true,
  memo: true,
  imagePath: true,
  thumbnailPath: true,
  createdAt: true,
  _count: { select: { feedbacks: true } },
} as const;

export interface DietRecordDto {
  id: string;
  date: Date;
  mealType: DietMealType;
  foodName: string | null;
  memo: string | null;
  /** 서명 주소. 사진이 없거나 주소를 못 만들면 null. */
  imageUrl: string | null;
  thumbnailUrl: string | null;
  hasPhoto: boolean;
  feedbackCount: number;
  createdAt: Date;
}

interface RawRecord {
  id: string;
  date: Date;
  mealType: DietMealType;
  foodName: string | null;
  memo: string | null;
  imagePath: string | null;
  thumbnailPath: string | null;
  createdAt: Date;
  _count: { feedbacks: number };
}

/**
 * 사진 주소를 한 번에 만들어 붙인다.
 *
 * 기록마다 따로 부르면 하루치 네 끼를 여는 데 저장소 요청이 여덟 번 나간다.
 *
 * withPhoto 가 false 면 주소를 아예 만들지 않는다. 트레이너가 사진은 공유받지
 * 못한 경우인데, 이때 주소를 만들어 두고 화면에서만 감추면 응답 어딘가에 주소가
 * 남는다.
 */
async function attachUrls(
  rows: RawRecord[],
  withPhoto = true,
): Promise<DietRecordDto[]> {
  const paths = withPhoto
    ? rows.flatMap((row) =>
        [row.imagePath, row.thumbnailPath].filter(
          (path): path is string => path !== null,
        ),
      )
    : [];

  const urls =
    paths.length > 0
      ? await createSignedReadUrls(paths)
      : new Map<string, string>();

  return rows.map((row) => ({
    id: row.id,
    date: row.date,
    mealType: row.mealType,
    foodName: row.foodName,
    memo: row.memo,
    imageUrl:
      withPhoto && row.imagePath ? (urls.get(row.imagePath) ?? null) : null,
    thumbnailUrl:
      withPhoto && row.thumbnailPath
        ? (urls.get(row.thumbnailPath) ?? null)
        : null,
    hasPhoto: row.imagePath !== null,
    feedbackCount: row._count.feedbacks,
    createdAt: row.createdAt,
  }));
}

function dayRange(dateKey: string) {
  const start = new Date(`${dateKey}T00:00:00+09:00`);
  return { start, end: new Date(start.getTime() + 24 * 60 * 60 * 1000) };
}

function byMeal(a: DietRecordDto, b: DietRecordDto) {
  const order = MEAL_ORDER.indexOf(a.mealType) - MEAL_ORDER.indexOf(b.mealType);
  return order !== 0 ? order : a.createdAt.getTime() - b.createdAt.getTime();
}

/** 하루치 식단. 끼니 순서로 정렬하고, 같은 끼니는 올린 순서대로. */
export async function getDietByDate(userId: string, dateKey: string) {
  const { start, end } = dayRange(dateKey);

  const rows = await prisma.dietRecord.findMany({
    where: { userId, date: { gte: start, lt: end } },
    orderBy: { createdAt: "asc" },
    select: recordSelect,
  });

  return (await attachUrls(rows)).sort(byMeal);
}

/**
 * 최근 식단을 날짜별로 묶어 돌려준다. 목록 화면에 쓴다.
 *
 * 날짜가 아니라 끼니 수로 자른다. 하루에 몇 끼를 올리는지가 사람마다 달라
 * "최근 며칠" 로 자르면 어떤 사람은 여섯 줄, 어떤 사람은 예순 줄이 된다.
 */
export async function getRecentDiet(userId: string, limit = 30) {
  const rows = await prisma.dietRecord.findMany({
    where: { userId },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    take: limit,
    select: recordSelect,
  });

  const withUrls = await attachUrls(rows);
  const byDate = new Map<string, DietRecordDto[]>();

  for (const row of withUrls) {
    const key = toKstDateKey(row.date);
    const list = byDate.get(key);
    if (list) list.push(row);
    else byDate.set(key, [row]);
  }

  return [...byDate.entries()].map(([dateKey, records]) => ({
    dateKey,
    records: records.sort(byMeal),
  }));
}

/** 오늘 몇 끼를 올렸는지. 홈 카드에 쓴다. 사진 주소를 만들지 않아 가볍다. */
export async function countDietOnDate(userId: string, dateKey: string) {
  const { start, end } = dayRange(dateKey);

  return prisma.dietRecord.count({
    where: { userId, date: { gte: start, lt: end } },
  });
}

export interface DietDetail extends DietRecordDto {
  feedbacks: {
    id: string;
    content: string;
    trainerName: string;
    createdAt: Date;
  }[];
}

async function loadDetail(
  where: { id: string; userId?: string },
  withPhoto: boolean,
): Promise<DietDetail> {
  const row = await prisma.dietRecord.findFirst({
    where,
    select: {
      ...recordSelect,
      feedbacks: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          content: true,
          createdAt: true,
          trainerMembership: { select: { user: { select: { name: true } } } },
        },
      },
    },
  });

  if (!row) {
    throw new DietError("NOT_FOUND", "식단 기록을 찾을 수 없어요.");
  }

  const [dto] = await attachUrls([row], withPhoto);

  return {
    ...dto,
    feedbacks: row.feedbacks.map((feedback) => ({
      id: feedback.id,
      content: feedback.content,
      trainerName: feedback.trainerMembership.user.name,
      createdAt: feedback.createdAt,
    })),
  };
}

/** 내 식단 하나. 남의 기록은 없는 것으로 다룬다. */
export async function getMyDietDetail(userId: string, id: string) {
  return loadDetail({ id, userId }, true);
}

/** 트레이너가 보는 식단 하나. 공유 확인은 부르는 쪽이 이미 끝냈다고 본다. */
export async function getDietDetailForTrainer(
  memberUserId: string,
  id: string,
  withPhoto: boolean,
) {
  return loadDetail({ id, userId: memberUserId }, withPhoto);
}

function trim(value: unknown, max: number) {
  if (typeof value !== "string") return null;
  const text = value.trim().slice(0, max);
  return text.length > 0 ? text : null;
}

/** 저장소 경로가 이 사용자의 폴더인지 본다. 아니면 없는 것으로 친다. */
function photoPathOf(userId: string, value: unknown) {
  if (typeof value !== "string" || value.length === 0) return null;
  return value.startsWith(`diets/${userId}/`) ? value : null;
}

export interface CreateDietInput {
  dateKey: string;
  mealType: DietMealType;
  foodName?: unknown;
  memo?: unknown;
  imagePath?: unknown;
  thumbnailPath?: unknown;
}

/**
 * 식단을 남긴다.
 *
 * 사진 경로는 등록하기 전에 이미 저장소에 올라가 있다. 사진을 붙이려면 기록이 먼저
 * 있어야 하는 구조로 만들면 사진을 고르려고 빈 기록부터 만들어야 하고, 도중에 나간
 * 사람의 빈 기록이 쌓인다. 그래서 경로를 사용자 폴더로 먼저 끊어 두고 등록할 때
 * 함께 받는다.
 */
export async function createDiet(userId: string, input: CreateDietInput) {
  const foodName = trim(input.foodName, MAX_FOOD_NAME);
  const memo = trim(input.memo, MAX_MEMO);
  const imagePath = photoPathOf(userId, input.imagePath);
  const thumbnailPath = imagePath
    ? photoPathOf(userId, input.thumbnailPath)
    : null;

  // 사진도 글도 없으면 남길 게 없다. 끼니만 저장된 빈 줄이 쌓이면 무엇을 먹었는지
  // 아무도 알 수 없고, 트레이너에게는 알림만 가고 볼 것이 없다.
  if (!foodName && !memo && !imagePath) {
    throw new DietError("EMPTY", "사진을 올리거나 무엇을 먹었는지 적어주세요.");
  }

  return prisma.dietRecord.create({
    data: {
      userId,
      date: new Date(`${input.dateKey}T00:00:00+09:00`),
      mealType: input.mealType,
      foodName,
      memo,
      imagePath,
      thumbnailPath,
    },
    select: { id: true },
  });
}

export async function deleteDiet(userId: string, id: string) {
  const row = await prisma.dietRecord.findFirst({
    where: { id, userId },
    select: { id: true, date: true, imagePath: true, thumbnailPath: true },
  });

  if (!row) {
    throw new DietError("NOT_FOUND", "식단 기록을 찾을 수 없어요.");
  }

  await prisma.dietRecord.delete({ where: { id: row.id } });

  // 저장소에서도 지운다. DB 만 지우면 아무도 못 보는 파일에 요금이 계속 나간다.
  await removeObjects(
    [row.imagePath, row.thumbnailPath].filter(
      (path): path is string => path !== null,
    ),
  );

  return { dateKey: toKstDateKey(row.date) };
}

export interface DietUploadTicket {
  uploadUrl: string;
  path: string;
  thumbnailUploadUrl: string;
  thumbnailPath: string;
}

/**
 * 사진 한 장을 올릴 자리를 만든다.
 *
 * 경로를 서버가 정한다. 브라우저가 정하게 하면 남의 폴더에 올릴 수 있다. 아직
 * 기록이 없으므로 기록이 아니라 사용자로 폴더를 끊는다.
 *
 * 사진만 올리고 등록하지 않으면 주인 없는 파일이 남는다. 한 장에 300KB 안팎이라
 * 당장은 두고, 나중에 붙지 않은 파일을 걷어내는 일감을 만든다.
 */
export async function createDietPhotoUpload(
  userId: string,
  mimeType: string,
): Promise<DietUploadTicket> {
  if (!ALLOWED_MIME.includes(mimeType)) {
    throw new DietError("INVALID", "사진만 올릴 수 있어요.");
  }

  const key = randomUUID();

  const [full, thumb] = await Promise.all([
    createSignedUpload(`diets/${userId}/${key}.webp`),
    createSignedUpload(`diets/${userId}/${key}-thumb.webp`),
  ]);

  return {
    uploadUrl: full.uploadUrl,
    path: full.path,
    thumbnailUploadUrl: thumb.uploadUrl,
    thumbnailPath: thumb.path,
  };
}

/** 올렸지만 등록으로 이어지지 않은 사진을 지운다. 폼에서 사진을 뺐을 때 부른다. */
export async function discardDietPhoto(userId: string, path: unknown) {
  const target = photoPathOf(userId, path);
  if (!target) return;

  await removeObjects([target, target.replace(/\.webp$/, "-thumb.webp")]);
}

export { trim as trimDietText };
