import "server-only";

import { PTSessionStatus } from "@/generated/prisma/enums";
import { toKstDateKey } from "@/lib/date";
import { prisma } from "@/lib/prisma";
import { requireTrainerProfile } from "./trainer.service";
import { shiftDateKey, kstRange } from "./trainer-board-shared";

export interface TrainerMonthDay {
  dateKey: string;
  count: number;
  isToday: boolean;
  isSelected: boolean;
}

export interface TrainerMonth {
  dateKey: string;
  monthStartDateKey: string;
  days: TrainerMonthDay[];
  prevMonthDateKey: string;
  nextMonthDateKey: string;
  todayDateKey: string;
}

export async function getTrainerMonth(
  userId: string,
  dateKey?: string,
): Promise<TrainerMonth> {
  const trainer = await requireTrainerProfile(userId);
  const todayDateKey = toKstDateKey(new Date());

  const selected =
    dateKey && /^\d{4}-\d{2}-\d{2}$/.test(dateKey) ? dateKey : todayDateKey;

  const [year, month] = selected.split("-").map(Number);
  const monthStartDateKey = `${year}-${String(month).padStart(2, "0")}-01`;

  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();

  const { start, end } = kstRange(monthStartDateKey, daysInMonth);

  const sessions = await prisma.pTSession.findMany({
    where: {
      trainerProfileId: trainer.id,
      scheduledAt: {
        gte: start,
        lt: end,
      },
    },
    select: {
      scheduledAt: true,
      status: true,
    },
  });

  const counts = new Map<string, number>();

  for (const session of sessions) {
    if (session.status === PTSessionStatus.CANCELLED) {
      continue;
    }

    const key = toKstDateKey(session.scheduledAt);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const days: TrainerMonthDay[] = Array.from(
    { length: daysInMonth },
    (_, index) => {
      const key = shiftDateKey(monthStartDateKey, index);

      return {
        dateKey: key,
        count: counts.get(key) ?? 0,
        isToday: key === todayDateKey,
        isSelected: key === selected,
      };
    },
  );

  const previousMonth = new Date(Date.UTC(year, month - 2, 1));
  const nextMonth = new Date(Date.UTC(year, month, 1));

  const toDateKey = (date: Date) =>
    `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(
      2,
      "0",
    )}-01`;

  return {
    dateKey: selected,
    monthStartDateKey,
    days,
    prevMonthDateKey: toDateKey(previousMonth),
    nextMonthDateKey: toDateKey(nextMonth),
    todayDateKey,
  };
}
