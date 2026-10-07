import "server-only";

import { prisma } from "@/lib/prisma";

export async function getUserRole(userId: string) {
  const trainerProfile = await prisma.trainerProfile.findUnique({
    where: { userId },
    select: { userId: true },
  });

  return trainerProfile ? "TRAINER" : "MEMBER";
}