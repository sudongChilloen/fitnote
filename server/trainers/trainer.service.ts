import "server-only";

import {
  ConnectionStatus,
  JournalStatus,
  MembershipRole,
  MembershipStatus,
  PTContractStatus,
  PTSessionStatus,
} from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { kstStartOfDay } from "@/lib/date";

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
 * 현재 로그인한 트레이너가 실제로 소속되어 있는 활성 센터 목록.
 *
 * PT 계약 생성 시 센터를 선택할 수 있게 하는 화면에서 사용한다.
 * 회원의 센터 소속이 아니라 "계약을 만드는 트레이너 본인"의 소속을 기준으로
 * 해야 하므로 trainer.service에 둔다.
 */
export async function getActiveMemberships(userId: string) {
  const memberships = await prisma.centerMembership.findMany({
    where: {
      userId,
      status: MembershipStatus.ACTIVE,
      role: {
        in: [MembershipRole.TRAINER, MembershipRole.CENTER_ADMIN],
      },
    },
    orderBy: {
      center: { name: "asc" },
    },
    select: {
      centerId: true,
      center: {
        select: {
          id: true,
          name: true,
          status: true,
        },
      },
    },
  });

  return memberships.filter(
    (membership) => membership.center.status === "ACTIVE",
  );
}

/**
 * 이 회원이 내 담당인지 확인한다.
 *
 * 트레이너 화면의 회원 식별자는 회원의 userId 가 아니라 연결의 id 다.
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
      memberUser: {
        select: {
          id: true,
          name: true,
          status: true,
        },
      },
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
 * 알림장처럼 이미 회원이 정해진 기록에서 출발할 때 쓴다.
 */
export async function requireMyMemberByUserId(
  trainerProfileId: string,
  memberUserId: string,
) {
  const connection = await prisma.trainerMemberConnection.findUnique({
    where: {
      trainerProfileId_memberUserId: {
        trainerProfileId,
        memberUserId,
      },
    },
    select: {
      id: true,
      status: true,
      startedAt: true,
      memberUserId: true,
      memberUser: {
        select: {
          id: true,
          name: true,
          status: true,
        },
      },
    },
  });

  if (!connection || connection.status !== ConnectionStatus.ACTIVE) {
    throw new TrainerError("NOT_MY_MEMBER", "담당 회원이 아니에요.");
  }

  return connection;
}

export type TrainerManagementStatus =
  | "normal"
  | "attention"
  | "urgent";

export type TrainerManagementEventType =
  | "MEMBER_PENDING"
  | "SESSION_JOURNAL"
  | "JOURNAL_REPLY"
  | "CONTRACT_EXPIRING";

export interface TrainerManagementEvent {
  type: TrainerManagementEventType;
  status: TrainerManagementStatus;
  reason: string;
  href: string;
}

export interface TrainerMemberRow {
  /** 트레이너 화면의 회원 식별자. 연결의 id 다. */
  connectionId: string;

  userId: string;

  name: string;

  /**
   * 트레이너가 대신 만들어 둔, 아직 본인이 이어받지 않은 회원.
   */
  pending: boolean;

  /** 오늘 잡힌 PT 수업. 없으면 null. */
  todaySession: {
    id: string;
    scheduledAt: Date;
    status: string;
    /** 이 수업의 알림장. 아직 없으면 null. */
    journal: {
      id: string;
      status: JournalStatus;
    } | null;
  } | null;

  /** 마지막 댓글이 회원 것이라 답을 기다리는 알림장. */
  awaitingReply: {
    journalId: string;
    date: Date;
    count: number;
  }[];

  lastJournalAt: Date | null;

  /**
   * 지금 진행 중인 PT 계약.
   */
  contract: {
    id: string;
    remaining: number;
    totalSessions: number;
    expiresAt: Date | null;
    daysLeft: number | null;
  } | null;

  /** 트레이너가 지금 확인해야 하는 관리 상태 */
  managementStatus: TrainerManagementStatus;

  /** 관리 상태의 구체적인 이유 */
  managementEvents: TrainerManagementEvent[];
}

/**
 * 회원을 계약 상태로 가른다.
 *
 * - pt   : 진행 중이고 여유가 있다
 * - soon : 곧 끝난다
 * - none : 계약이 없다
 */
export function memberContractGroup(row: TrainerMemberRow) {
  if (!row.contract) return "none" as const;

  const byCount = row.contract.remaining <= 3;

  const byDate =
    row.contract.daysLeft !== null &&
    row.contract.daysLeft <= 14;

  return byCount || byDate ? ("soon" as const) : ("pt" as const);
}

/**
 * 회원의 현재 관리 우선순위를 실제 관리 이벤트에서 계산한다.
 *
 * 건강 상태를 판단하지 않고,
 * 트레이너가 실제로 처리해야 할 업무만 대상으로 한다.
 */
function getManagementEvents(
  row: Omit<
    TrainerMemberRow,
    "managementStatus" | "managementEvents"
  >,
): TrainerManagementEvent[] {
  const events: TrainerManagementEvent[] = [];

  /**
   * 회원 가입 대기
   *
   * 아직 계정을 이어받지 않은 회원은 회원 상세에서 확인한다.
   */
  if (row.pending) {
    events.push({
      type: "MEMBER_PENDING",
      status: "attention",
      reason: "회원 가입 대기",
      href: `/trainer/members/${row.connectionId}`,
    });
  }

  /**
   * 오늘 수업 기록 필요
   *
   * 이미 알림장이 있으면 해당 알림장으로 바로 이동한다.
   * 알림장이 아직 없다면 POST 기반의 beginJournal을 사용해야 하므로
   * 회원 상세로 이동시킨다.
   */
  if (
    row.todaySession &&
    (row.todaySession.journal === null ||
      row.todaySession.journal.status !== JournalStatus.PUBLISHED)
  ) {
    events.push({
      type: "SESSION_JOURNAL",
      status: "attention",
      reason: "오늘 수업 기록 필요",
      href: row.todaySession.journal
        ? `/trainer/journals/${row.todaySession.journal.id}`
        : `/trainer/members/${row.connectionId}`,
    });
  }

  /**
   * 알림장 답변 대기
   *
   * 첫 번째 답변 대기 알림장으로 바로 이동한다.
   */
  if (row.awaitingReply.length > 0) {
    const count = row.awaitingReply.reduce(
      (total, item) => total + item.count,
      0,
    );

    const firstAwaitingReply = row.awaitingReply[0];

    events.push({
      type: "JOURNAL_REPLY",
      status: "attention",
      reason: `알림장 답변 대기 ${count}건`,
      href: `/trainer/journals/${firstAwaitingReply.journalId}`,
    });
  }

  /**
   * PT 계약 마감 임박
   *
   * 남은 횟수 3회 이하 또는 만료 14일 이하.
   */
  if (row.contract) {
    const remainingSoon = row.contract.remaining <= 3;

    const expirySoon =
      row.contract.daysLeft !== null &&
      row.contract.daysLeft <= 14;

    if (remainingSoon || expirySoon) {
      let reason = "PT 계약 마감 임박";

      if (remainingSoon && expirySoon) {
        reason = `PT ${row.contract.remaining}회 / ${row.contract.daysLeft}일 남음`;
      } else if (remainingSoon) {
        reason = `PT ${row.contract.remaining}회 남음`;
      } else if (expirySoon) {
        reason = `PT 계약 ${row.contract.daysLeft}일 남음`;
      }

      events.push({
        type: "CONTRACT_EXPIRING",
        status: "attention",
        reason,
        href: `/trainer/members/${row.connectionId}/contracts`,
      });
    }
  }

  return events;
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
 */
export async function getTrainerHome(
  userId: string,
): Promise<TrainerHome> {
  const trainer = await requireTrainerProfile(userId);

  const todayStart = kstStartOfDay();
  const todayEnd = new Date(
    todayStart.getTime() + 24 * 60 * 60 * 1000,
  );

  const [
    connections,
    todaySessions,
    journals,
    contracts,
  ] = await Promise.all([
    prisma.trainerMemberConnection.findMany({
      where: {
        trainerProfileId: trainer.id,
        status: ConnectionStatus.ACTIVE,
      },
      orderBy: {
        startedAt: "asc",
      },
      select: {
        id: true,
        memberUserId: true,
        memberUser: {
          select: {
            id: true,
            name: true,
            status: true,
          },
        },
      },
    }),

    prisma.pTSession.findMany({
      where: {
        trainerProfileId: trainer.id,
        scheduledAt: {
          gte: todayStart,
          lt: todayEnd,
        },
      },
      orderBy: {
        scheduledAt: "asc",
      },
      select: {
        id: true,
        scheduledAt: true,
        status: true,
        memberUserId: true,
        journals: {
          orderBy: {
            createdAt: "desc",
          },
          take: 1,
          select: {
            id: true,
            status: true,
          },
        },
      },
    }),

    // 최근 두 달만 본다.
    prisma.journal.findMany({
      where: {
        trainerProfileId: trainer.id,
        date: {
          gte: new Date(
            todayStart.getTime() -
              60 * 24 * 60 * 60 * 1000,
          ),
        },
      },
      orderBy: {
        date: "desc",
      },
      select: {
        id: true,
        date: true,
        status: true,
        memberUserId: true,
        comments: {
          orderBy: {
            createdAt: "desc",
          },
          select: {
            id: true,
            createdAt: true,
            authorUserId: true,
          },
        },
      },
    }),

    /*
      진행 중인 계약.
      만료일이 지난 계약은 상태가 ACTIVE여도 제외한다.
    */
    prisma.pTContract.findMany({
      where: {
        trainerProfileId: trainer.id,
        status: PTContractStatus.ACTIVE,
        OR: [
          {
            expiresAt: null,
          },
          {
            expiresAt: {
              gte: todayStart,
            },
          },
        ],
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
                OR: [
                  {
                    deducted: true,
                  },
                  {
                    status: PTSessionStatus.SCHEDULED,
                  },
                ],
              },
            },
          },
        },
      },
    }),
  ]);

  /*
    회원마다 계약 하나만 남긴다.
    먼저 끝나는 계약을 사용한다.
  */
  const contractByMember =
    new Map<string, (typeof contracts)[number]>();

  for (const contract of contracts) {
    const kept = contractByMember.get(
      contract.memberUserId,
    );

    if (
      !kept ||
      (contract.expiresAt !== null &&
        (kept.expiresAt === null ||
          contract.expiresAt < kept.expiresAt))
    ) {
      contractByMember.set(
        contract.memberUserId,
        contract,
      );
    }
  }

  const sessionByMember = new Map(
    todaySessions.map((session) => [
      session.memberUserId,
      session,
    ]),
  );

  const rows: TrainerMemberRow[] =
    connections.map((connection) => {
      const session =
        sessionByMember.get(
          connection.memberUserId,
        ) ?? null;

      const mine = journals.filter(
        (journal) =>
          journal.memberUserId ===
          connection.memberUserId,
      );

      const awaitingReply = mine
        .map((journal) => {
          const [latest] = journal.comments;

          if (
            !latest ||
            latest.authorUserId === trainer.userId
          ) {
            return null;
          }

          const count =
            journal.comments.filter(
              (comment) =>
                comment.authorUserId !==
                trainer.userId,
            ).length;

          return {
            journalId: journal.id,
            date: journal.date,
            count,
          };
        })
        .filter(
          (
            value,
          ): value is NonNullable<typeof value> =>
            value !== null,
        );

      const published = mine.filter(
        (journal) =>
          journal.status ===
          JournalStatus.PUBLISHED,
      );

      const baseRow = {
        connectionId: connection.id,
        userId: connection.memberUser.id,
        name: connection.memberUser.name,
        pending:
          connection.memberUser.status === "PENDING",

        todaySession: session
          ? {
              id: session.id,
              scheduledAt: session.scheduledAt,
              status: session.status,
              journal:
                session.journals[0] ?? null,
            }
          : null,

        awaitingReply,

        lastJournalAt:
          published[0]?.date ?? null,

        contract: (() => {
          const contract =
            contractByMember.get(
              connection.memberUserId,
            );

          if (!contract) return null;

          return {
            id: contract.id,
            remaining:
              contract.totalSessions -
              contract._count.sessions,
            totalSessions:
              contract.totalSessions,
            expiresAt:
              contract.expiresAt,

            daysLeft:
              contract.expiresAt === null
                ? null
                : Math.max(
                    0,
                    Math.ceil(
                      (contract.expiresAt.getTime() -
                        todayStart.getTime()) /
                        (24 *
                          60 *
                          60 *
                          1000),
                    ) - 1,
                  ),
          };
        })(),
      };

      const managementEvents =
        getManagementEvents(baseRow);

      const managementStatus: TrainerManagementStatus =
        managementEvents.some(
          (event) =>
            event.status === "urgent",
        )
          ? "urgent"
          : managementEvents.some(
                (event) =>
                  event.status === "attention",
              )
            ? "attention"
            : "normal";

      return {
        ...baseRow,
        managementStatus,
        managementEvents,
      };
    });

  const pendingJournalCount =
    rows.filter(
      (row) =>
        row.todaySession !== null &&
        (row.todaySession.journal === null ||
          row.todaySession.journal.status !==
            JournalStatus.PUBLISHED),
    ).length;

  // 관리가 필요한 회원을 위로.
  // 즉시 확인 > 확인 필요 > 정상.
  rows.sort((a, b) => {
    const statusScore = {
      urgent: 3,
      attention: 2,
      normal: 1,
    } as const;

    const statusDiff =
      statusScore[b.managementStatus] -
      statusScore[a.managementStatus];

    if (statusDiff !== 0) {
      return statusDiff;
    }

    const score = (
      row: TrainerMemberRow,
    ) =>
      (row.todaySession ? 2 : 0) +
      (row.awaitingReply.length > 0 ? 1 : 0);

    const diff = score(b) - score(a);

    if (diff !== 0) {
      return diff;
    }

    if (
      a.todaySession &&
      b.todaySession
    ) {
      const gap =
        a.todaySession.scheduledAt.getTime() -
        b.todaySession.scheduledAt.getTime();

      if (gap !== 0) {
        return gap;
      }
    }

    return a.name.localeCompare(
      b.name,
      "ko",
    );
  });

  return {
    trainerProfileId: trainer.id,
    trainerName: trainer.name,
    todayCount: todaySessions.length,
    pendingJournalCount,
    awaitingReplyCount:
      rows.filter(
        (row) =>
          row.awaitingReply.length > 0,
      ).length,
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
  const trainer =
    await requireTrainerProfile(userId);

  const connection =
    await requireMyMember(
      trainer.id,
      connectionId,
    );

  const todayStart =
    kstStartOfDay();

  const [
    upcoming,
    journals,
  ] = await Promise.all([
    prisma.pTSession.findMany({
      where: {
        memberUserId:
          connection.memberUserId,
        trainerProfileId:
          trainer.id,
        status: "SCHEDULED",
        scheduledAt: {
          gte: todayStart,
        },
      },
      orderBy: {
        scheduledAt: "asc",
      },
      take: 5,
      select: {
        id: true,
        scheduledAt: true,
        sessionNumber: true,
        status: true,
        journals: {
          orderBy: {
            createdAt: "desc",
          },
          take: 1,
          select: {
            id: true,
          },
        },
      },
    }),

    prisma.journal.findMany({
      where: {
        memberUserId:
          connection.memberUserId,
        trainerProfileId:
          trainer.id,
      },
      orderBy: {
        date: "desc",
      },
      take: 20,
      select: {
        id: true,
        date: true,
        title: true,
        status: true,
        comments: {
          orderBy: {
            createdAt: "desc",
          },
          select: {
            id: true,
            authorUserId: true,
          },
        },
      },
    }),
  ]);

  return {
    trainerProfileId: trainer.id,
    connectionId: connection.id,
    userId: connection.memberUser.id,
    name: connection.memberUser.name,
    pending:
      connection.memberUser.status === "PENDING",
    startedAt: connection.startedAt,

    upcomingSessions:
      upcoming.map((session) => ({
        id: session.id,
        scheduledAt:
          session.scheduledAt,
        sessionNumber:
          session.sessionNumber,
        status: session.status,
        journalId:
          session.journals[0]?.id ??
          null,
      })),

    journals:
      journals.map((journal) => {
        const [latest] =
          journal.comments;

        return {
          id: journal.id,
          date: journal.date,
          title: journal.title,
          status: journal.status,
          commentCount:
            journal.comments.length,
          awaitingReply:
            latest !== undefined &&
            latest.authorUserId !==
              trainer.userId,
        };
      }),
  };
}