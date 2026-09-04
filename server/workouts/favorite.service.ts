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
