import "server-only";

import {
  JournalStatus,
  PTContractStatus,
  PTSessionActor,
  PTSessionStatus,
} from "@/generated/prisma/enums";
import { kstStartOfDay } from "@/lib/date";
import { prisma } from "@/lib/prisma";
import { PTError, isExpired } from "./pt-shared";

/**
 * 회원이 보는 다가오는 수업.
 *
 * 예정된 수업만 보여주면 조용히 사라지는 것이 생긴다. 트레이너가 취소하면
 * 목록에서 빠질 뿐이라, 회원은 그 사실을 알 방법이 없다. 그래서 아직 확인하지
 * 못한 취소는 "취소됨" 인 채로 남겨 둔다 — 사라지는 것보다 남아 있는 쪽이
 * 확실히 눈에 띈다. 회원이 확인을 누르면 그때 목록에서 빠진다.
 *
 * 지나간 것은 확인 여부와 상관없이 뺀다. 어제 취소된 어제 수업을 오늘 띄우면
 * 그때부터는 안내가 아니라 잔소리다.
 */
/**
 * 회원이 보는 내 다음 수업.
 *
 * 트레이너만 일정을 아는 상태가 제일 이상하다. 회원은 자기가 언제 가는지
 * 카톡을 뒤져서 확인하고 있다.
 *
 * 지난 세 시간까지 함께 보여 준다. 오후 7시 수업이 7시 1분에 목록에서
 * 사라지면, 수업 직전에 확인하려던 사람이 못 본다.
 */
export async function getMyUpcomingSessions(userId: string, limit = 5) {
  const since = new Date(Date.now() - 3 * 3_600_000);

  const sessions = await prisma.pTSession.findMany({
    where: {
      memberUserId: userId,
      scheduledAt: { gte: since },
      OR: [
        { status: PTSessionStatus.SCHEDULED },
        {
          status: PTSessionStatus.CANCELLED,
          memberAlertAt: { not: null },
        },
      ],
    },
    orderBy: { scheduledAt: "asc" },
    take: limit,
    select: {
      id: true,
      scheduledAt: true,
      sessionNumber: true,
      durationMinutes: true,
      status: true,
      cancelReason: true,
      memberAlertAt: true,
      contract: { select: { title: true, totalSessions: true } },
      trainerProfile: {
        select: { displayName: true, user: { select: { name: true } } },
      },
    },
  });

  return sessions.map((session) => ({
    id: session.id,
    scheduledAt: session.scheduledAt,
    sessionNumber: session.sessionNumber,
    durationMinutes: session.durationMinutes,
    totalSessions: session.contract.totalSessions,
    status: session.status,
    cancelReason: session.cancelReason,
    /** 아직 확인하지 않은 변경이 있다. */
    changed: session.memberAlertAt !== null,
    trainerName:
      session.trainerProfile.displayName ?? session.trainerProfile.user.name,
  }));
}

/**
 * 회원이 일정 변경을 확인했다.
 *
 * 확인한 뒤에도 예정된 수업은 목록에 그대로 남고 표시만 사라진다. 취소된
 * 수업은 그때 목록에서 빠진다.
 *
 * 트레이너는 이걸 볼 수 없다. 회원이 확인했는지를 트레이너 화면에 띄우면
 * 다시 읽음 추적이 되고, 그건 이미 안 하기로 한 것이다. 이 표시는 회원이
 * 자기 화면을 정리하는 용도다.
 */
export async function acknowledgeSessionChange(
  userId: string,
  sessionId: string,
) {
  const result = await prisma.pTSession.updateMany({
    where: { id: sessionId, memberUserId: userId },
    data: { memberAlertAt: null },
  });

  if (result.count === 0) {
    throw new PTError("NOT_FOUND", "수업을 찾을 수 없어요.");
  }

  return { id: sessionId };
}

export interface MyPtSessionRow {
  id: string;
  sessionNumber: number;
  scheduledAt: Date;
  durationMinutes: number;
  status: PTSessionStatus;
  /** 이 회차가 횟수에서 빠졌는가. 상태에서 유추하지 않고 기록된 값을 쓴다. */
  deducted: boolean;
  cancelReason: string | null;
  /** 취소·변경을 누가 했는가. 회원이 따질 수 있어야 하는 정보다. */
  cancelledBy: PTSessionActor | null;
  /** 미룬 이력. 최근 것이 먼저. */
  reschedules: { fromScheduledAt: Date; toScheduledAt: Date }[];
  /** 이 수업에서 남은 운동 기록. 없으면 null. */
  workoutSessionId: string | null;
  /** 이 수업의 알림장. 게시된 것만. */
  journalId: string | null;
}

export interface MyPtContract {
  id: string;
  title: string;
  totalSessions: number;
  /** 아직 안 받은 횟수. 예약해 둔 것도 아직 안 받은 것이다. */
  remaining: number;
  /** 그중 날짜가 잡혀 있는 횟수. */
  scheduledCount: number;
  /** 실제로 받은 횟수(완료). */
  completedCount: number;
  /** 안 가서 빠진 횟수. */
  noShowCount: number;
  startedAt: Date;
  expiresAt: Date | null;
  /** 만료까지 남은 날. 만료일이 없으면 null. 오늘이면 0. */
  daysLeft: number | null;
  status: PTContractStatus;
  expired: boolean;
  trainerName: string;
  sessions: MyPtSessionRow[];
}

/**
 * 회원이 보는 내 PT.
 *
 * "몇 회 남았어요?" 는 트레이너가 가장 많이 받는 질문인데, 지금까지 그 답은
 * 트레이너 화면에만 있었다. 회원은 자기 계약이 몇 회짜리인지도 다음 수업 줄에
 * 붙은 "3/20회차" 로 역산해야 알 수 있었다.
 *
 * 남은 횟수와 예약된 횟수를 따로 준다. 한 숫자로 합치면 "12회 남았다" 가
 * 아직 안 받은 12회인지 지금 더 잡을 수 있는 12회인지 알 수 없다. 둘은 다르고,
 * 회원이 궁금한 건 앞쪽, 트레이너가 일정을 잡을 때 보는 건 뒤쪽이다.
 *
 * 지난 회차도 전부 준다. 노쇼로 한 회가 빠졌는데 회원 화면에 그 회차가 아예
 * 없으면, 회원은 숫자가 왜 줄었는지 확인할 방법이 없다. 차감은 돈이라 근거가
 * 보여야 한다.
 *
 * 끝난 계약도 함께 준다. 재등록할 때 지난번에 몇 회를 실제로 받았는지가
 * 회원에게도 판단 근거다.
 */
export async function getMyPt(userId: string): Promise<MyPtContract[]> {
  const contracts = await prisma.pTContract.findMany({
    where: { memberUserId: userId },
    orderBy: [{ status: "asc" }, { startedAt: "desc" }],
    select: {
      id: true,
      title: true,
      totalSessions: true,
      startedAt: true,
      expiresAt: true,
      status: true,
      trainerProfile: {
        select: { displayName: true, user: { select: { name: true } } },
      },
      sessions: {
        orderBy: { scheduledAt: "asc" },
        select: {
          id: true,
          sessionNumber: true,
          scheduledAt: true,
          durationMinutes: true,
          status: true,
          deducted: true,
          cancelReason: true,
          cancelledBy: true,
          reschedules: {
            orderBy: { createdAt: "desc" },
            select: { fromScheduledAt: true, toScheduledAt: true },
          },
          workoutSession: { select: { id: true } },
          /*
            게시된 알림장만 건다. 트레이너가 쓰다 만 초안이 회원에게 열리면
            안 되고, 링크만 걸어 두고 열면 막는 것도 이상하다.
          */
          journals: {
            where: { status: JournalStatus.PUBLISHED },
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { id: true },
          },
        },
      },
    },
  });

  const todayStart = kstStartOfDay();

  return contracts.map((contract) => {
    const sessions = contract.sessions;

    /*
      남은 횟수는 저장된 usedSessions 를 안 쓰고 회차에서 직접 센다. 화면에
      회차가 줄줄이 보이는데 위의 숫자가 그 줄들과 안 맞으면 어느 쪽이 맞는지
      회원이 알 수 없다. 보이는 것에서 세는 편이 안전하다.
    */
    const deducted = sessions.filter((session) => session.deducted).length;

    return {
      id: contract.id,
      title: contract.title,
      totalSessions: contract.totalSessions,
      remaining: Math.max(contract.totalSessions - deducted, 0),
      scheduledCount: sessions.filter(
        (session) => session.status === PTSessionStatus.SCHEDULED,
      ).length,
      completedCount: sessions.filter(
        (session) => session.status === PTSessionStatus.COMPLETED,
      ).length,
      noShowCount: sessions.filter(
        (session) => session.status === PTSessionStatus.NO_SHOW,
      ).length,
      startedAt: contract.startedAt,
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
      status: contract.status,
      expired: isExpired(contract),
      trainerName:
        contract.trainerProfile.displayName ??
        contract.trainerProfile.user.name,
      sessions: sessions.map((session) => ({
        id: session.id,
        sessionNumber: session.sessionNumber,
        scheduledAt: session.scheduledAt,
        durationMinutes: session.durationMinutes,
        status: session.status,
        deducted: session.deducted,
        cancelReason: session.cancelReason,
        cancelledBy: session.cancelledBy,
        reschedules: session.reschedules,
        workoutSessionId: session.workoutSession?.id ?? null,
        journalId: session.journals[0]?.id ?? null,
      })),
    };
  });
}
