import "server-only";

import { prisma } from "@/lib/prisma";

export class ConnectionError extends Error {
  constructor(
    readonly code:
      | "NOT_TRAINER"
      | "INVALID_CODE"
      | "EXPIRED"
      | "EXHAUSTED"
      | "SELF"
      | "ALREADY_CONNECTED"
      | "NOT_FOUND",
    message: string,
  ) {
    super(message);
    this.name = "ConnectionError";
  }
}

export function displayName(profile: {
  displayName: string | null;
  user: { name: string };
}) {
  return profile.displayName ?? profile.user.name;
}

export async function requireProfileId(userId: string) {
  const profile = await prisma.trainerProfile.findUnique({
    where: { userId },
    select: { id: true },
  });

  if (!profile) {
    throw new ConnectionError("NOT_TRAINER", "트레이너만 할 수 있어요.");
  }

  return profile.id;
}
