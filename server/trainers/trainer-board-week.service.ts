import "server-only";

import { PTSessionStatus } from "@/generated/prisma/enums";
import { toKstDateKey } from "@/lib/date";
import { prisma } from "@/lib/prisma";
import { requireTrainerProfile } from "./trainer.service";
import {
  TrainerSessionRow,
  sessionSelect,
  toRow,
  connectionMap,
  shiftDateKey,
  kstRange,
} from "./trainer-board-shared";

export interface TrainerWeekDay {
  dateKey: string;

  /** 취소를 뺀 수업 수. 스트립의 점 개수다. */
  count: number;

  isToday: boolean;
  isSelected: boolean;
}

export interface TrainerWeek {
  dateKey: string;

  /** 월요일부터 일요일까지 7칸. */
  days: TrainerWeekDay[];

  /** 고른 날의 수업. 시간순. */
  sessions: TrainerSessionRow[];

  prevWeekDateKey: string;
  nextWeekDateKey: string;
  todayDateKey: string;
}

function weekStartKey(dateKey: string) {
  const [y, m, d] = dateKey.split("-").map(Number);

  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();

  return shiftDateKey(dateKey, -((dow + 6) % 7));
}

/**
 * 한 주를 한 번에 가져와 스트립과 그 날 목록을 함께 만든다.
 *
 * 시간축 그리드를 그리지 않는 이유는 화면 크기 때문이다. PT 일정은 아침과
 * 저녁에 몰려서 7열 × 14시간 그리드는 대부분이 빈칸이고, 폰에서는 글자가
 * 읽히지 않는다. 트레이너가 수업 사이에 꺼내 보는 화면이라 "다음이 몇 시에
 * 누구" 가 즉답되어야 한다. 그래서 요일 스트립 + 그 날 목록으로 간다.
 */
export async function getTrainerWeek(
  userId: string,
  dateKey?: string,
): Promise<TrainerWeek> {
  const trainer = await requireTrainerProfile(userId);

  const todayDateKey = toKstDateKey(new Date());

  const selected =
    dateKey && /^\d{4}-\d{2}-\d{2}$/.test(dateKey) ? dateKey : todayDateKey;

  const startKey = weekStartKey(selected);
  const { start, end } = kstRange(startKey, 7);

  const [sessions, byUser] = await Promise.all([
    prisma.pTSession.findMany({
      where: {
        trainerProfileId: trainer.id,
        scheduledAt: {
          gte: start,
          lt: end,
        },
      },
      orderBy: {
        scheduledAt: "asc",
      },
      select: sessionSelect,
    }),
    connectionMap(trainer.id),
  ]);

  const rows = sessions.map((session) => toRow(session, byUser, todayDateKey));

  const days: TrainerWeekDay[] = Array.from({ length: 7 }, (_, index) => {
    const key = shiftDateKey(startKey, index);

    return {
      dateKey: key,

      // 취소한 수업은 세지 않는다.
      // 점이 찍혀 있는데 열어 보면 아무것도 없는 상황을 막는다.
      count: rows.filter(
        (row) =>
          toKstDateKey(row.scheduledAt) === key &&
          row.status !== PTSessionStatus.CANCELLED,
      ).length,

      isToday: key === todayDateKey,
      isSelected: key === selected,
    };
  });

  return {
    dateKey: selected,
    days,

    sessions: rows.filter((row) => toKstDateKey(row.scheduledAt) === selected),

    prevWeekDateKey: shiftDateKey(startKey, -7),

    nextWeekDateKey: shiftDateKey(startKey, 7),

    todayDateKey,
  };
}

/**
 * 오늘 수업 전부. 시간순.
 *
 * 기존 홈은 오늘 수업을 회원별 Map 으로 접어 회원 카드에 한 줄씩 붙였는데,
 * 그러면 하루에 같은 회원을 두 번 보는 경우 한 건이 사라진다. 요약의 "오늘
 * 수업 3" 과 카드에 보이는 수가 어긋나는 것도 같은 이유였다.
 */
export async function getTrainerToday(
  userId: string,
): Promise<TrainerSessionRow[]> {
  const week = await getTrainerWeek(userId);

  return week.sessions;
}

// ---------------------------------------------------------------------------
// 할 일
// ---------------------------------------------------------------------------
