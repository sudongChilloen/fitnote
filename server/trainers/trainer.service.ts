import "server-only";

import {
  JournalStatus,
  MembershipRole,
  MembershipStatus,
} from "@/generated/prisma/enums";
import { kstStartOfDay } from "@/lib/date";
import { prisma } from "@/lib/prisma";
import {
  canActAsTrainer,
  getCurrentMembership,
} from "@/server/centers/center.service";

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
 * 트레이너로 활동 중인 소속.
 *
 * 회원 화면과 달리 트레이너 화면은 "소속이 없으면 빈 화면" 이 아니라 아예 들어오면
 * 안 되는 곳이다. 남의 기록을 보는 화면이라 애매하게 열어 두면 안 된다.
 */
export async function requireTrainerMembership(userId: string) {
  const membership = await getCurrentMembership(userId);

  if (!membership || !canActAsTrainer(membership)) {
    throw new TrainerError("NOT_TRAINER", "트레이너만 볼 수 있는 화면이에요.");
  }

  return membership;
}

/**
 * 이 회원이 내 담당인지 확인한다.
 *
 * 같은 센터라는 것만으로는 부족하다. 센터에 트레이너가 다섯이면 남의 회원 기록까지
 * 다 열리기 때문이다. 관리자도 예외를 두지 않았다 — 관리자가 회원의 체중과 식단
 * 사진을 볼 이유는 없고, 필요하면 담당으로 배정하면 된다.
 */
export async function requireMyMember(
  trainerMembershipId: string,
  memberMembershipId: string,
) {
  const member = await prisma.centerMembership.findFirst({
    where: {
      id: memberMembershipId,
      assignedTrainerMembershipId: trainerMembershipId,
      status: MembershipStatus.ACTIVE,
    },
    select: {
      id: true,
      joinedAt: true,
      user: { select: { id: true, name: true } },
    },
  });

  if (!member) {
    throw new TrainerError("NOT_MY_MEMBER", "담당 회원이 아니에요.");
  }

  return member;
}

export interface TrainerMemberRow {
  membershipId: string;
  userId: string;
  name: string;
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
  /** 게시했지만 회원이 아직 안 읽은 알림장 수. */
  unreadByMember: number;
  lastJournalAt: Date | null;
}

export interface TrainerHome {
  membershipId: string;
  centerName: string;
  role: MembershipRole;
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
  const trainer = await requireTrainerMembership(userId);

  const todayStart = kstStartOfDay();
  const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);

  const [members, todaySessions, journals] = await Promise.all([
    prisma.centerMembership.findMany({
      where: {
        assignedTrainerMembershipId: trainer.id,
        status: MembershipStatus.ACTIVE,
      },
      orderBy: { joinedAt: "asc" },
      select: {
        id: true,
        user: { select: { id: true, name: true } },
      },
    }),

    prisma.pTSession.findMany({
      where: {
        trainerMembershipId: trainer.id,
        scheduledAt: { gte: todayStart, lt: todayEnd },
      },
      orderBy: { scheduledAt: "asc" },
      select: {
        id: true,
        scheduledAt: true,
        status: true,
        memberMembershipId: true,
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
        trainerMembershipId: trainer.id,
        date: {
          gte: new Date(todayStart.getTime() - 60 * 24 * 60 * 60 * 1000),
        },
      },
      orderBy: { date: "desc" },
      select: {
        id: true,
        date: true,
        status: true,
        memberMembershipId: true,
        memberReadAt: true,
        comments: {
          orderBy: { createdAt: "desc" },
          select: { id: true, createdAt: true, authorMembershipId: true },
        },
      },
    }),
  ]);

  const sessionByMember = new Map(
    todaySessions.map((session) => [session.memberMembershipId, session]),
  );

  const rows: TrainerMemberRow[] = members.map((member) => {
    const session = sessionByMember.get(member.id) ?? null;
    const mine = journals.filter((j) => j.memberMembershipId === member.id);

    const awaitingReply = mine
      .map((journal) => {
        // 마지막 댓글이 회원 것이면 답을 기다리는 중이다. 읽음 표시를 따로 두지
        // 않은 이유는, 트레이너에게 필요한 건 "봤는가" 가 아니라 "답했는가" 라서다.
        const [latest] = journal.comments;
        if (!latest || latest.authorMembershipId === trainer.id) return null;

        const count = journal.comments.filter(
          (c) => c.authorMembershipId !== trainer.id,
        ).length;

        return { journalId: journal.id, date: journal.date, count };
      })
      .filter((value): value is NonNullable<typeof value> => value !== null);

    const published = mine.filter((j) => j.status === JournalStatus.PUBLISHED);

    return {
      membershipId: member.id,
      userId: member.user.id,
      name: member.user.name,
      todaySession: session
        ? {
            id: session.id,
            scheduledAt: session.scheduledAt,
            status: session.status,
            journal: session.journals[0] ?? null,
          }
        : null,
      awaitingReply,
      unreadByMember: published.filter((j) => j.memberReadAt === null).length,
      lastJournalAt: published[0]?.date ?? null,
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
    membershipId: trainer.id,
    centerName: trainer.center.name,
    role: trainer.role,
    todayCount: todaySessions.length,
    pendingJournalCount,
    awaitingReplyCount: rows.filter((r) => r.awaitingReply.length > 0).length,
    members: rows,
  };
}

export interface TrainerMemberDetail {
  trainerMembershipId: string;
  membershipId: string;
  name: string;
  joinedAt: Date;
  /** 진행 중인 PT 계약. 여러 개일 수 있어 목록으로 둔다. */
  contracts: {
    id: string;
    productName: string;
    totalSessions: number;
    usedSessions: number;
    expiresAt: Date | null;
  }[];
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
    readByMember: boolean;
    commentCount: number;
    awaitingReply: boolean;
  }[];
}

/**
 * 담당 회원 한 명.
 *
 * 여기서 회원의 개인 운동기록과 식단은 아직 보여주지 않는다. 공유 설정을 만들기
 * 전까지는 회원이 동의한 적이 없기 때문이다. PT 수업 기록과 내가 쓴 알림장은
 * 원래 양쪽이 보는 것이라 지금도 보여준다.
 */
export async function getMemberDetail(
  userId: string,
  memberMembershipId: string,
): Promise<TrainerMemberDetail> {
  const trainer = await requireTrainerMembership(userId);
  const member = await requireMyMember(trainer.id, memberMembershipId);

  const todayStart = kstStartOfDay();

  const [contracts, upcoming, journals] = await Promise.all([
    prisma.pTContract.findMany({
      where: {
        memberMembershipId: member.id,
        trainerMembershipId: trainer.id,
        status: "ACTIVE",
      },
      orderBy: { startedAt: "desc" },
      select: {
        id: true,
        productNameSnapshot: true,
        totalSessions: true,
        usedSessions: true,
        expiresAt: true,
      },
    }),

    prisma.pTSession.findMany({
      where: {
        memberMembershipId: member.id,
        trainerMembershipId: trainer.id,
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
        memberMembershipId: member.id,
        trainerMembershipId: trainer.id,
      },
      orderBy: { date: "desc" },
      take: 20,
      select: {
        id: true,
        date: true,
        title: true,
        status: true,
        memberReadAt: true,
        comments: {
          orderBy: { createdAt: "desc" },
          select: { id: true, authorMembershipId: true },
        },
      },
    }),
  ]);

  return {
    trainerMembershipId: trainer.id,
    membershipId: member.id,
    name: member.user.name,
    joinedAt: member.joinedAt,
    contracts: contracts.map((contract) => ({
      id: contract.id,
      productName: contract.productNameSnapshot,
      totalSessions: contract.totalSessions,
      usedSessions: contract.usedSessions,
      expiresAt: contract.expiresAt,
    })),
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
        readByMember: journal.memberReadAt !== null,
        commentCount: journal.comments.length,
        awaitingReply:
          latest !== undefined && latest.authorMembershipId !== trainer.id,
      };
    }),
  };
}
