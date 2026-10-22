import "server-only";

import { JournalStatus, PTSessionStatus } from "@/generated/prisma/enums";
import { kstStartOfDay } from "@/lib/date";
import { prisma } from "@/lib/prisma";
import { requireTrainerProfile, requireMyMember } from "./trainer-shared";

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
  recentSessions: {
    id: string;
    scheduledAt: Date;
    sessionNumber: number;
    status: PTSessionStatus;
    deducted: boolean;
    workoutSessionId: string | null;
    journalId: string | null;
    journalStatus: JournalStatus | null;
    exerciseCount: number;
    setCount: number;
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

  const [upcoming, recentSessions, journals] = await Promise.all([
    /*
     * 앞으로 잡힌 수업.
     */
    prisma.pTSession.findMany({
      where: {
        memberUserId: connection.memberUserId,
        trainerProfileId: trainer.id,
        status: PTSessionStatus.SCHEDULED,
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
          select: {
            id: true,
          },
        },
      },
    }),

    /*
     * 최근 완료된 PT 수업.
     *
     * 회원 상세에서 "최근에 어떤 수업을 했는지" 빠르게 보여주기 위한 데이터다.
     * 상세한 운동 세트는 /trainer/sessions/[id] 에서 본다.
     */
    prisma.pTSession.findMany({
      where: {
        memberUserId: connection.memberUserId,
        trainerProfileId: trainer.id,
        status: PTSessionStatus.COMPLETED,
      },
      orderBy: {
        scheduledAt: "desc",
      },
      take: 5,
      select: {
        id: true,
        scheduledAt: true,
        sessionNumber: true,
        status: true,
        deducted: true,
        workoutSession: {
          select: {
            id: true,
            _count: {
              select: {
                records: true,
              },
            },
            records: {
              select: {
                _count: {
                  select: {
                    sets: true,
                  },
                },
              },
            },
          },
        },
        journals: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: {
            id: true,
            status: true,
          },
        },
      },
    }),

    /*
     * 알림장.
     */
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
    pending: connection.memberUser.status === "PENDING",
    startedAt: connection.startedAt,

    upcomingSessions: upcoming.map((session) => ({
      id: session.id,
      scheduledAt: session.scheduledAt,
      sessionNumber: session.sessionNumber,
      status: session.status,
      journalId: session.journals[0]?.id ?? null,
    })),

    recentSessions: recentSessions.map((session) => ({
      id: session.id,
      scheduledAt: session.scheduledAt,
      sessionNumber: session.sessionNumber,
      status: session.status,
      deducted: session.deducted,
      workoutSessionId: session.workoutSession?.id ?? null,
      journalId: session.journals[0]?.id ?? null,
      journalStatus: session.journals[0]?.status ?? null,
      exerciseCount: session.workoutSession?._count.records ?? 0,
      setCount:
        session.workoutSession?.records.reduce(
          (total, record) => total + record._count.sets,
          0,
        ) ?? 0,
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
