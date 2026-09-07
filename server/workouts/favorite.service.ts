import "server-only";

import { prisma } from "@/lib/prisma";

/**
 * 자주 하는 운동 즐겨찾기.
 *
 * 운동 목록은 부위별로 나눠도 여전히 길다. 매번 같은 5~6개를 하는 사람이
 * 대부분이라, 그 사람들에게는 "즐겨찾기" 가 사실상의 첫 화면이 된다.
 */
export async function getFavoriteExerciseIds(userId: string) {
  const rows = await prisma.workoutFavorite.findMany({
    where: { userId },
    select: { exerciseId: true },
  });

  return rows.map((row) => row.exerciseId);
}

/** 즐겨찾기를 켜고 끈다. 켜진 뒤 상태를 돌려준다. */
export async function toggleFavorite(userId: string, exerciseId: string) {
  const existing = await prisma.workoutFavorite.findUnique({
    where: { userId_exerciseId: { userId, exerciseId } },
    select: { id: true },
  });

  if (existing) {
    await prisma.workoutFavorite.delete({ where: { id: existing.id } });
    return false;
  }

  // 없는 운동을 즐겨찾기에 넣지 않는다.
  const exercise = await prisma.exercise.findFirst({
    where: { id: exerciseId, isActive: true },
    select: { id: true },
  });

  if (!exercise) return null;

  await prisma.workoutFavorite.create({ data: { userId, exerciseId } });
  return true;
}

export async function isFavorite(userId: string, exerciseId: string) {
  const row = await prisma.workoutFavorite.findUnique({
    where: { userId_exerciseId: { userId, exerciseId } },
    select: { id: true },
  });

  return row !== null;
}

/**
 * 원하는 상태로 맞춘다.
 *
 * toggleFavorite 은 드로어처럼 화면이 현재 상태를 들고 있는 곳에 맞다. 반면
 * 새로고침으로 되돌아오는 폼에서는 "뒤집어라" 가 위험하다. 두 번 눌리거나 화면이
 * 두 개 열려 있으면 누른 횟수에 따라 결과가 달라진다. 그래서 "이렇게 만들어라" 를
 * 받는 쪽도 둔다.
 */
export async function setFavorite(
  userId: string,
  exerciseId: string,
  on: boolean,
) {
  if (!on) {
    await prisma.workoutFavorite.deleteMany({ where: { userId, exerciseId } });
    return false;
  }

  // 없는 운동을 즐겨찾기에 넣지 않는다.
  const exercise = await prisma.exercise.findFirst({
    where: { id: exerciseId, isActive: true },
    select: { id: true },
  });

  if (!exercise) return null;

  await prisma.workoutFavorite.upsert({
    where: { userId_exerciseId: { userId, exerciseId } },
    create: { userId, exerciseId },
    update: {},
  });

  return true;
}
