import "server-only";

import {
  ConnectionStatus,
  JournalStatus,
  PTContractStatus,
  PTSessionStatus,
} from "@/generated/prisma/enums";
import { kstStartOfDay } from "@/lib/date";
import { prisma } from "@/lib/prisma";

export class TrainerError extends Error {
  constructor(
    readonly code: "NOT_TRAINER" | "NOT_MY_MEMBER" | "NOT_FOUND",
    message: string,
  ) {
    super(message);
    this.name = "TrainerError";
  }
}

/**
 * 트레이너 프로필.
 *
 * 트레이너라는 신분은 센터 소속이 아니라 프로필 자체다. 센터에 속하지 않은
 * 트레이너도 회원을 받고 알림장을 쓴다. 프로필이 없으면 아예 들어오면 안 되는
 * 화면이라 여기서 던진다.
 */
export async function requireTrainerProfile(userId: string) {
  const profile = await prisma.trainerProfile.findUnique({
    where: { userId },
    select: {
      id: true,
      userId: true,
      displayName: true,
      user: { select: { name: true } },
    },
  });

  if (!profile) {
    throw new TrainerError("NOT_TRAINER", "트레이너만 볼 수 있는 화면이에요.");
  }

  return {
    id: profile.id,
    userId: profile.userId,
    name: profile.displayName ?? profile.user.name,
  };
}

/**
 * 이 회원이 내 담당인지 확인한다.
 *
 * 트레이너 화면의 회원 식별자는 회원의 userId 가 아니라 연결의 id 다. 연결에는
 * 언제부터 봐 주기 시작했는지가 담겨 있고, 남의 기록을 읽을 때 그 시점이
 * 기준이 되기 때문이다. userId 를 주소에 쓰면 그 기준을 매번 다시 찾아야 한다.
 */
export async function requireMyMember(
  trainerProfileId: string,
  connectionId: string,
) {
  const connection = await prisma.trainerMemberConnection.findFirst({
    where: {
      id: connectionId,
      trainerProfileId,
      status: ConnectionStatus.ACTIVE,
    },
    select: {
      id: true,
      startedAt: true,
      memberUserId: true,
      memberUser: { select: { id: true, name: true, status: true } },
    },
  });

  if (!connection) {
    throw new TrainerError("NOT_MY_MEMBER", "담당 회원이 아니에요.");
  }

  return connection;
}

/**
 * 회원의 userId 로 연결을 찾는다.
 *
 * 알림장처럼 이미 회원이 정해진 기록에서 출발할 때 쓴다. 주소로 들어오는
 * 경로에는 쓰지 않는다 — 그쪽은 연결 id 로 받아야 남의 회원을 찍어 볼 수 없다.
 */
export async function requireMyMemberByUserId(
  trainerProfileId: string,
  memberUserId: string,
) {
  const connection = await prisma.trainerMemberConnection.findUnique({
    where: {
      trainerProfileId_memberUserId: { trainerProfileId, memberUserId },
    },
    select: {
      id: true,
      status: true,
      startedAt: true,
      memberUserId: true,
      memberUser: { select: { id: true, name: true, status: true } },
    },
  });

  if (!connection || connection.status !== ConnectionStatus.ACTIVE) {
    throw new TrainerError("NOT_MY_MEMBER", "담당 회원이 아니에요.");
  }

  return connection;
}

export interface TrainerMemberRow {
  /** 트레이너 화면의 회원 식별자. 연결의 id 다. */
  connectionId: string;
  userId: string;
  name: string;
  /**
   * 트레이너가 대신 만들어 둔, 아직 본인이 이어받지 않은 회원.
   *
   * 트레이너에게 이걸 알려 줘야 하는 이유는, 이 회원에게 쓴 알림장은 아무도
   * 읽지 않기 때문이다. 답이 없는 게 무시당한 게 아니라 계정이 없어서라는 걸
   * 모르면 트레이너는 엉뚱한 오해를 한다.
   */
  pending: boolean;
  /** 오늘 잡힌 PT 수업. 없으면 null. */
  todaySession: {
    id: string;
    scheduledAt: Date;
    status: string;
    /** 이 수업의 알림장. 아직 없으면 null. */
    journal: { id: string; status: JournalStatus } | null;
  } | null;
  /** 마지막 댓글이 회원 것이라 답을 기다리는 알림장. */
  awaitingReply: { journalId: string; date: Date; count: number }[];
  lastJournalAt: Date | null;
  /**
   * 지금 진행 중인 PT 계약. 없으면 null.
   *
   * 계약이 여럿이면 먼저 끝나는 것을 잡는다. 트레이너가 다음에 이야기를
   * 꺼내야 하는 건 나중에 끝나는 계약이 아니라 먼저 끝나는 계약이다.
   */
  contract: {
    id: string;
    /** 총 횟수에서 차감된 것과 잡아 둔 것을 뺀 값. */
    remaining: number;
    totalSessions: number;
    expiresAt: Date | null;
    /** 만료까지 남은 날. 만료일이 없으면 null. 오늘이면 0. */
    daysLeft: number | null;
  } | null;
}

/**
 * 회원을 계약 상태로 가른다.
 *
 * - `pt`      진행 중이고 여유가 있다
 * - `soon`    곧 끝난다. 재계약 이야기를 꺼낼 사람
 * - `none`    계약이 없다. 끝났거나 아직 안 만들었거나
 *
 * 임박 기준은 남은 횟수 3회 이하 또는 만료 14일 이내다. 두 축을 다 보는 건
 * 계약이 끝나는 방식이 둘이라서다. 횟수를 다 써서 끝나기도 하고, 횟수가
 * 남았는데 기간이 지나 끝나기도 한다.
 */
export function memberContractGroup(row: TrainerMemberRow) {
  if (!row.contract) return "none" as const;

  const byCount = row.contract.remaining <= 3;
  const byDate = row.contract.daysLeft !== null && row.contract.daysLeft <= 14;

  return byCount || byDate ? ("soon" as const) : ("pt" as const);
}

export interface TrainerHome {
  trainerProfileId: string;
  trainerName: string;
  todayCount: number;
  /** 오늘 수업이 있는데 알림장을 아직 게시하지 않은 건수. */
  pendingJournalCount: number;
  /** 답을 기다리는 댓글이 있는 회원 수. */
  awaitingReplyCount: number;
  members: TrainerMemberRow[];
}

/**
 * 트레이너 홈.
 *
 * 회원 목록을 그냥 나열하지 않고 "오늘 할 일" 이 있는 회원을 위로 올린다.
 * 트레이너가 하루에 여러 번 여는 화면이라 목록보다 할 일이 먼저다.
 */
export async function getTrainerHome(userId: string): Promise<TrainerHome> {
  const trainer = await requireTrainerProfile(userId);

  const todayStart = kstStartOfDay();
  const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);

  const [connections, todaySessions, journals, contracts] = await Promise.all([
    prisma.trainerMemberConnection.findMany({
      where: { trainerProfileId: trainer.id, status: ConnectionStatus.ACTIVE },
      orderBy: { startedAt: "asc" },
      select: {
        id: true,
        memberUserId: true,
        memberUser: { select: { id: true, name: true, status: true } },
      },
    }),

    prisma.pTSession.findMany({
      where: {
        trainerProfileId: trainer.id,
        scheduledAt: { gte: todayStart, lt: todayEnd },
      },
      orderBy: { scheduledAt: "asc" },
      select: {
        id: true,
        scheduledAt: true,
        status: true,
        memberUserId: true,
        journals: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { id: true, status: true },
        },
      },
    }),

    // 최근 두 달만 본다. 반년 전 댓글에 이제 와서 답하라고 띄울 이유가 없다.
    prisma.journal.findMany({
      where: {
        trainerProfileId: trainer.id,
        date: {
          gte: new Date(todayStart.getTime() - 60 * 24 * 60 * 60 * 1000),
        },
      },
      orderBy: { date: "desc" },
      select: {
        id: true,
        date: true,
        status: true,
        memberUserId: true,
        comments: {
          orderBy: { createdAt: "desc" },
          select: { id: true, createdAt: true, authorUserId: true },
        },
      },
    }),

    /*
      진행 중인 계약. 만료일이 지난 건 상태가 아직 ACTIVE 여도 뺀다. 만료
      처리를 돌리는 배치가 없어서, 상태만 믿으면 어제 끝난 계약이 오늘도
      진행 중으로 보인다.

      차감 여부와 예약 상태를 같이 세는 건 목록의 남은 횟수가 수업을 잡을 때의
      계산과 어긋나면 안 되기 때문이다. 목록에서 5회 남았다고 본 트레이너가
      수업을 잡으려는데 거절당하면 어느 쪽이 맞는지 알 수 없다.
    */
    prisma.pTContract.findMany({
      where: {
        trainerProfileId: trainer.id,
        status: PTContractStatus.ACTIVE,
        OR: [{ expiresAt: null }, { expiresAt: { gte: todayStart } }],
      },
      select: {
        id: true,
        memberUserId: true,
        totalSessions: true,
        expiresAt: true,
        _count: {
          select: {
            sessions: {
              where: {
                OR: [{ deducted: true }, { status: PTSessionStatus.SCHEDULED }],
              },
            },
          },
        },
      },
    }),
  ]);

  /*
    회원마다 계약 하나만 남긴다. 먼저 끝나는 것이 이긴다. 만료일이 없는 계약은
    영영 안 끝나므로 맨 뒤로 민다.
  */
  const contractByMember = new Map<string, (typeof contracts)[number]>();

  for (const contract of contracts) {
    const kept = contractByMember.get(contract.memberUserId);

    if (
      !kept ||
      (contract.expiresAt !== null &&
        (kept.expiresAt === null || contract.expiresAt < kept.expiresAt))
    ) {
      contractByMember.set(contract.memberUserId, contract);
    }
  }

  const sessionByMember = new Map(
    todaySessions.map((session) => [session.memberUserId, session]),
  );

  const rows: TrainerMemberRow[] = connections.map((connection) => {
    const session = sessionByMember.get(connection.memberUserId) ?? null;
    const mine = journals.filter(
      (j) => j.memberUserId === connection.memberUserId,
    );

    const awaitingReply = mine
      .map((journal) => {
        // 마지막 댓글이 회원 것이면 답을 기다리는 중이다. 읽음 표시를 따로 두지
        // 않은 이유는, 트레이너에게 필요한 건 "봤는가" 가 아니라 "답했는가" 라서다.
        const [latest] = journal.comments;
        if (!latest || latest.authorUserId === trainer.userId) return null;

        const count = journal.comments.filter(
          (c) => c.authorUserId !== trainer.userId,
        ).length;

        return { journalId: journal.id, date: journal.date, count };
      })
      .filter((value): value is NonNullable<typeof value> => value !== null);

    const published = mine.filter((j) => j.status === JournalStatus.PUBLISHED);

    return {
      connectionId: connection.id,
      userId: connection.memberUser.id,
      name: connection.memberUser.name,
      pending: connection.memberUser.status === "PENDING",
      todaySession: session
        ? {
            id: session.id,
            scheduledAt: session.scheduledAt,
            status: session.status,
            journal: session.journals[0] ?? null,
          }
        : null,
      awaitingReply,
      lastJournalAt: published[0]?.date ?? null,
      contract: (() => {
        const contract = contractByMember.get(connection.memberUserId);
        if (!contract) return null;

        return {
          id: contract.id,
          remaining: contract.totalSessions - contract._count.sessions,
          totalSessions: contract.totalSessions,
          expiresAt: contract.expiresAt,
          daysLeft:
            contract.expiresAt === null
              ? null
              : Math.max(
                  0,
                  Math.ceil(
                    (contract.expiresAt.getTime() - todayStart.getTime()) /
                      (24 * 60 * 60 * 1000),
                  ) - 1,
                ),
        };
      })(),
    };
  });

  const pendingJournalCount = rows.filter(
    (row) =>
      row.todaySession !== null &&
      (row.todaySession.journal === null ||
        row.todaySession.journal.status !== JournalStatus.PUBLISHED),
  ).length;

  // 할 일이 있는 회원을 위로. 오늘 수업 > 답장 대기 > 이름순.
  rows.sort((a, b) => {
    const score = (row: TrainerMemberRow) =>
      (row.todaySession ? 2 : 0) + (row.awaitingReply.length > 0 ? 1 : 0);

    const diff = score(b) - score(a);
    if (diff !== 0) return diff;

    if (a.todaySession && b.todaySession) {
      const gap =
        a.todaySession.scheduledAt.getTime() -
        b.todaySession.scheduledAt.getTime();
      if (gap !== 0) return gap;
    }

    return a.name.localeCompare(b.name, "ko");
  });

  return {
    trainerProfileId: trainer.id,
    trainerName: trainer.name,
    todayCount: todaySessions.length,
    pendingJournalCount,
    awaitingReplyCount: rows.filter((r) => r.awaitingReply.length > 0).length,
    members: rows,
  };
}

export interface TrainerMemberDetail {
  trainerProfileId: string;
  connectionId: string;
  userId: string;
  name: string;
  /** 아직 본인이 계정을 이어받지 않은 회원. */
  pending: boolean;
  /** 이 트레이너가 이 회원을 봐 주기 시작한 날. */
  startedAt: Date;
  /** 오늘 이후 잡힌 수업. */
  upcomingSessions: {
    id: string;
    scheduledAt: Date;
    sessionNumber: number;
    status: string;
    journalId: string | null;
  }[];
  /** 내가 이 회원에게 쓴 알림장. */
  journals: {
    id: string;
    date: Date;
    title: string | null;
    status: JournalStatus;
    commentCount: number;
    awaitingReply: boolean;
  }[];
}

/**
 * 담당 회원 한 명.
 *
 * 회원이 혼자 남긴 기록(식단·개인 운동·체중)은 공유 설정을 지나야만 보인다.
 * PT 수업 기록과 내가 쓴 알림장은 원래 양쪽이 보는 것이라 여기서 바로 준다.
 */
export async function getMemberDetail(
  userId: string,
  connectionId: string,
): Promise<TrainerMemberDetail> {
  const trainer = await requireTrainerProfile(userId);
  const connection = await requireMyMember(trainer.id, connectionId);

  const todayStart = kstStartOfDay();

  const [upcoming, journals] = await Promise.all([
    prisma.pTSession.findMany({
      where: {
        memberUserId: connection.memberUserId,
        trainerProfileId: trainer.id,
        status: "SCHEDULED",
        scheduledAt: { gte: todayStart },
      },
      orderBy: { scheduledAt: "asc" },
      take: 5,
      select: {
        id: true,
        scheduledAt: true,
        sessionNumber: true,
        status: true,
        journals: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { id: true },
        },
      },
    }),

    prisma.journal.findMany({
      where: {
        memberUserId: connection.memberUserId,
        trainerProfileId: trainer.id,
      },
      orderBy: { date: "desc" },
      take: 20,
      select: {
        id: true,
        date: true,
        title: true,
        status: true,
        comments: {
          orderBy: { createdAt: "desc" },
          select: { id: true, authorUserId: true },
        },
      },
    }),
  ]);

  return {
    trainerProfileId: trainer.id,
    connectionId: connection.id,
    userId: connection.memberUser.id,
    name: connection.memberUser.name,
    pending: connection.memberUser.status === "PENDING",
    startedAt: connection.startedAt,
    upcomingSessions: upcoming.map((session) => ({
      id: session.id,
      scheduledAt: session.scheduledAt,
      sessionNumber: session.sessionNumber,
      status: session.status,
      journalId: session.journals[0]?.id ?? null,
    })),
    journals: journals.map((journal) => {
      const [latest] = journal.comments;

      return {
        id: journal.id,
        date: journal.date,
        title: journal.title,
        status: journal.status,
        commentCount: journal.comments.length,
        awaitingReply:
          latest !== undefined && latest.authorUserId !== trainer.userId,
      };
    }),
  };
}
