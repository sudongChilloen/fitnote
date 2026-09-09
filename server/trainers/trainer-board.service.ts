import "server-only";

import {
  ConnectionStatus,
  JournalStatus,
  PTSessionStatus,
} from "@/generated/prisma/enums";
import { toKstDateKey } from "@/lib/date";
import { prisma } from "@/lib/prisma";

import { requireTrainerProfile } from "./trainer.service";

/**
 * 트레이너가 시간과 할 일 축으로 보는 화면들.
 *
 * 기존 `trainer.service` 는 회원을 축으로 짠다(회원 → 계약 → 회차). 그건
 * 데이터를 저장한 모양이지 트레이너가 일하는 모양이 아니다. 트레이너는
 * "지금 뭘 해야 하지" 로 움직인다 — 다음 수업이 몇 시에 누구인지, 알림장을
 * 누구 것을 안 썼는지, 누가 답을 기다리는지.
 *
 * 그래서 같은 데이터를 시간축과 할 일 축으로 다시 세워 주는 파일을 따로 둔다.
 */

/** 시간표 한 줄. 회원 카드가 아니라 수업이 단위다. */
export interface TrainerSessionRow {
  id: string;
  scheduledAt: Date;
  durationMinutes: number;
  status: PTSessionStatus;
  sessionNumber: number;
  memberName: string;
  memberUserId: string;
  /** 트레이너 화면의 회원 식별자. 연결이 끊긴 회원이면 null. */
  connectionId: string | null;
  contractId: string;
  /** 이 수업에 붙은 알림장. 아직 없으면 null. */
  journalId: string | null;
  journalStatus: JournalStatus | null;
  /** 이 수업의 운동 기록이 이미 있는가. */
  hasWorkout: boolean;
}

const sessionSelect = {
  id: true,
  scheduledAt: true,
  durationMinutes: true,
  status: true,
  sessionNumber: true,
  contractId: true,
  memberUserId: true,
  memberUser: { select: { name: true } },
  workoutSession: { select: { id: true } },
  journals: {
    orderBy: { createdAt: "desc" },
    take: 1,
    select: { id: true, status: true },
  },
} as const;

type RawSession = {
  id: string;
  scheduledAt: Date;
  durationMinutes: number;
  status: PTSessionStatus;
  sessionNumber: number;
  contractId: string;
  memberUserId: string;
  memberUser: { name: string };
  workoutSession: { id: string } | null;
  journals: { id: string; status: JournalStatus }[];
};

function toRow(
  session: RawSession,
  connectionByUser: Map<string, string>,
): TrainerSessionRow {
  const journal = session.journals[0] ?? null;

  return {
    id: session.id,
    scheduledAt: session.scheduledAt,
    durationMinutes: session.durationMinutes,
    status: session.status,
    sessionNumber: session.sessionNumber,
    memberName: session.memberUser.name,
    memberUserId: session.memberUserId,
    connectionId: connectionByUser.get(session.memberUserId) ?? null,
    contractId: session.contractId,
    journalId: journal?.id ?? null,
    journalStatus: journal?.status ?? null,
    hasWorkout: session.workoutSession !== null,
  };
}

/**
 * 연결이 끊긴 회원의 지난 수업도 화면에는 남아야 한다.
 *
 * 그래서 연결은 상태를 가리지 않고 전부 가져와 이름표처럼 붙인다. 다만
 * 끝난 연결은 회원 상세로 들어가도 막히므로 링크를 걸지 않는다(connectionId=null).
 */
async function connectionMap(trainerProfileId: string) {
  const connections = await prisma.trainerMemberConnection.findMany({
    where: { trainerProfileId, status: ConnectionStatus.ACTIVE },
    select: { id: true, memberUserId: true },
  });

  return new Map(connections.map((c) => [c.memberUserId, c.id]));
}

// ---------------------------------------------------------------------------
// 일정
// ---------------------------------------------------------------------------

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

const DAY_MS = 86_400_000;

function shiftDateKey(dateKey: string, days: number) {
  const [y, m, d] = dateKey.split("-").map(Number);
  const shifted = new Date(Date.UTC(y, m - 1, d) + days * DAY_MS);
  return shifted.toISOString().slice(0, 10);
}

/** 월요일 시작. 한국에서 주간 일정은 월요일부터 읽는다. */
function weekStartKey(dateKey: string) {
  const [y, m, d] = dateKey.split("-").map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return shiftDateKey(dateKey, -((dow + 6) % 7));
}

function kstRange(fromKey: string, days: number) {
  const start = new Date(`${fromKey}T00:00:00+09:00`);
  return { start, end: new Date(start.getTime() + days * DAY_MS) };
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
        scheduledAt: { gte: start, lt: end },
      },
      orderBy: { scheduledAt: "asc" },
      select: sessionSelect,
    }),
    connectionMap(trainer.id),
  ]);

  const rows = sessions.map((session) => toRow(session, byUser));

  const days: TrainerWeekDay[] = Array.from({ length: 7 }, (_, index) => {
    const key = shiftDateKey(startKey, index);
    return {
      dateKey: key,
      // 취소한 수업은 세지 않는다. 점이 찍혀 있는데 열어 보면 아무것도 없다.
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

export interface TrainerReplyRow {
  journalId: string;
  date: Date;
  memberName: string;
  /** 아직 답하지 않은 회원 댓글 수. */
  count: number;
  lastCommentAt: Date;
}

export interface TrainerTodos {
  /**
   * 시간이 지났는데 아직 예정으로 남아 있는 수업.
   *
   * 완료를 누르는 순간 PT 횟수가 깎이므로 자동으로 처리하지 않는다. 회원이
   * 안 왔을 수도 있고, 30분만 하고 갔을 수도 있고, 봐주기로 했을 수도 있다.
   * 대신 안 누르고 지나간 것을 여기 올려 둔다 — 안 누르면 회원의 남은 횟수가
   * 실제와 어긋나기 시작하고, 그건 돈 문제라 조용히 틀어지면 안 된다.
   */
  needComplete: TrainerSessionRow[];
  /** 수업은 끝났는데 알림장을 아직 게시하지 않은 것. 최근 것부터. */
  needJournal: TrainerSessionRow[];
  /** 마지막 댓글이 회원 것이라 답을 기다리는 알림장. */
  awaitingReply: TrainerReplyRow[];
}

/** 두 달이 넘은 일은 이제 와서 하라고 띄우지 않는다. */
const TODO_WINDOW_DAYS = 60;

export async function getTrainerTodos(userId: string): Promise<TrainerTodos> {
  const trainer = await requireTrainerProfile(userId);

  const since = new Date(Date.now() - TODO_WINDOW_DAYS * DAY_MS);

  const [sessions, overdue, journals, byUser] = await Promise.all([
    prisma.pTSession.findMany({
      where: {
        trainerProfileId: trainer.id,
        // 노쇼와 취소는 적을 내용이 없다. 완료한 수업만 알림장을 기다린다.
        status: PTSessionStatus.COMPLETED,
        scheduledAt: { gte: since },
        journals: { none: { status: JournalStatus.PUBLISHED } },
      },
      orderBy: { scheduledAt: "desc" },
      select: sessionSelect,
    }),

    /*
      끝났어야 할 시간이 지난 예정 수업.

      `scheduledAt` 만으로 거르면 지금 진행 중인 수업까지 "완료 안 함" 으로
      올라온다. 수업 길이를 더해 실제로 끝났을 시간을 넘긴 것만 센다.
    */
    prisma.pTSession.findMany({
      where: {
        trainerProfileId: trainer.id,
        status: PTSessionStatus.SCHEDULED,
        scheduledAt: { gte: since, lt: new Date() },
      },
      orderBy: { scheduledAt: "desc" },
      select: sessionSelect,
    }),

    prisma.journal.findMany({
      where: {
        trainerProfileId: trainer.id,
        status: JournalStatus.PUBLISHED,
        date: { gte: since },
      },
      orderBy: { date: "desc" },
      select: {
        id: true,
        date: true,
        memberUser: { select: { name: true } },
        comments: {
          orderBy: { createdAt: "desc" },
          select: { id: true, createdAt: true, authorUserId: true },
        },
      },
    }),

    connectionMap(trainer.id),
  ]);

  const awaitingReply: TrainerReplyRow[] = [];

  for (const journal of journals) {
    /*
      마지막 댓글이 회원 것이면 답을 기다리는 중이다. 읽음 표시를 따로 두지
      않은 이유는, 트레이너에게 필요한 건 "봤는가" 가 아니라 "답했는가" 라서다.
    */
    const [latest] = journal.comments;
    if (!latest || latest.authorUserId === trainer.userId) continue;

    // 내가 마지막으로 답한 뒤에 온 것만 센다. 대화 전체를 세면 숫자가 부푼다.
    const mine = journal.comments.find(
      (c) => c.authorUserId === trainer.userId,
    );
    const count = journal.comments.filter(
      (c) =>
        c.authorUserId !== trainer.userId &&
        (!mine || c.createdAt > mine.createdAt),
    ).length;

    awaitingReply.push({
      journalId: journal.id,
      date: journal.date,
      memberName: journal.memberUser.name,
      count,
      lastCommentAt: latest.createdAt,
    });
  }

  awaitingReply.sort(
    (a, b) => b.lastCommentAt.getTime() - a.lastCommentAt.getTime(),
  );

  const now = Date.now();

  return {
    needComplete: overdue
      .filter(
        (session) =>
          session.scheduledAt.getTime() + session.durationMinutes * 60_000 <
          now,
      )
      .map((session) => toRow(session, byUser)),
    needJournal: sessions.map((session) => toRow(session, byUser)),
    awaitingReply,
  };
}
