import "server-only";

import {
  ConnectionStatus,
  JournalStatus,
  PTSessionStatus,
} from "@/generated/prisma/enums";
import { toKstDateKey } from "@/lib/date";
import { prisma } from "@/lib/prisma";
import { type TrainerManagementEvent } from "./trainer.service";

/**
 * 시간표 한 줄.
 *
 * 회원 카드가 아니라 수업이 단위다.
 *
 * managementEvents는 이 수업과 직접 연결되는 관리 이벤트만 담는다.
 * 회원 전체에 걸린 계약 만료나 가입 대기 같은 이벤트는 여기에 넣지 않는다.
 */
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

  /**
   * 이 수업에서 트레이너가 확인해야 하는 관리 이벤트.
   *
   * 현재는 SESSION_JOURNAL처럼 수업 자체에 귀속되는 이벤트만 들어간다.
   */
  managementEvents: TrainerManagementEvent[];
}

export const sessionSelect = {
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

/**
 * 수업에 직접 연결되는 관리 이벤트를 만든다.
 *
 * 회원의 전체 관리 상태를 여기서 다시 계산하지 않는다.
 * 일정에서 필요한 것은 "이 수업과 관련해서 지금 해야 할 일이 있는가"다.
 *
 * 현재 SESSION_JOURNAL 이벤트의 기준은 기존 trainer.service와 맞춘다.
 *
 * - 오늘 수업인데 알림장이 아직 없거나 게시되지 않음
 *   → 오늘 수업 기록 필요
 *
 * 회원 가입 대기 / 알림장 답변 / 계약 만료는 회원 단위 이벤트이므로
 * SessionRow에 반복해서 붙이지 않는다.
 */
function getSessionManagementEvents(
  session: RawSession,
  journal: RawSession["journals"][number] | null,
  connectionId: string | null,
  todayDateKey: string,
): TrainerManagementEvent[] {
  if (!connectionId) {
    return [];
  }

  if (session.status === PTSessionStatus.CANCELLED) {
    return [];
  }

  const isToday = toKstDateKey(session.scheduledAt) === todayDateKey;

  if (!isToday) {
    return [];
  }

  /*
    아직 예정된 수업은 지금 알림장을 써야 하는 수업이 아니다.
    수업이 끝난 뒤 완료 처리되고 알림장이 없을 때 관리 업무가 생긴다.
  */
  if (session.status !== PTSessionStatus.COMPLETED) {
    return [];
  }

  if (journal?.status === JournalStatus.PUBLISHED) {
    return [];
  }

  return [
    {
      type: "SESSION_JOURNAL",
      status: "attention",
      reason: "오늘 수업 기록 필요",
      href: journal
        ? `/trainer/journals/${journal.id}`
        : `/trainer/members/${connectionId}`,
    },
  ];
}

export function toRow(
  session: RawSession,
  connectionByUser: Map<string, string>,
  todayDateKey: string,
): TrainerSessionRow {
  const journal = session.journals[0] ?? null;
  const connectionId = connectionByUser.get(session.memberUserId) ?? null;

  return {
    id: session.id,
    scheduledAt: session.scheduledAt,
    durationMinutes: session.durationMinutes,
    status: session.status,
    sessionNumber: session.sessionNumber,
    memberName: session.memberUser.name,
    memberUserId: session.memberUserId,
    connectionId,
    contractId: session.contractId,
    journalId: journal?.id ?? null,
    journalStatus: journal?.status ?? null,
    hasWorkout: session.workoutSession !== null,
    managementEvents: getSessionManagementEvents(
      session,
      journal,
      connectionId,
      todayDateKey,
    ),
  };
}

/**
 * 연결이 끊긴 회원의 지난 수업도 화면에는 남아야 한다.
 *
 * 그래서 연결은 상태를 가리지 않고 전부 가져와 이름표처럼 붙인다. 다만
 * 끝난 연결은 회원 상세로 들어가도 막히므로 링크를 걸지 않는다(connectionId=null).
 */
export async function connectionMap(trainerProfileId: string) {
  const connections = await prisma.trainerMemberConnection.findMany({
    where: {
      trainerProfileId,
      status: ConnectionStatus.ACTIVE,
    },
    select: {
      id: true,
      memberUserId: true,
    },
  });

  return new Map(
    connections.map((connection) => [connection.memberUserId, connection.id]),
  );
}

// ---------------------------------------------------------------------------
// 일정
// ---------------------------------------------------------------------------

export const DAY_MS = 86_400_000;

export function shiftDateKey(dateKey: string, days: number) {
  const [y, m, d] = dateKey.split("-").map(Number);

  const shifted = new Date(Date.UTC(y, m - 1, d) + days * DAY_MS);

  return shifted.toISOString().slice(0, 10);
}

export function kstRange(fromKey: string, days: number) {
  const start = new Date(`${fromKey}T00:00:00+09:00`);

  return {
    start,
    end: new Date(start.getTime() + days * DAY_MS),
  };
}
