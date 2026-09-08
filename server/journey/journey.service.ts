import "server-only";

import {
  GoalStatus,
  PTContractStatus,
  PTSessionStatus,
} from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { BODY_GOAL_TYPES, METRIC } from "@/server/body/body.service";
import { getSharingForTrainer } from "@/server/sharing/sharing.service";
import {
  requireMyMember,
  requireTrainerProfile,
} from "@/server/trainers/trainer.service";

/**
 * 회원의 운동 여정.
 *
 * 재등록 상담에서 펼쳐 놓고 "이만큼 오셨어요" 를 말하기 위한 화면이다.
 *
 * 그래서 있었던 일을 시간순으로 다 늘어놓지 않는다. PT 30회 · 개인 운동 40건 ·
 * 체성분 60건이면 150줄인데, 상담 자리에서 그걸 스크롤하는 사람은 없다. 한 줄
 * 요약과 마디만 남기고 자세한 것은 각자의 화면으로 들어가게 한다.
 *
 * 마디는 저장하지 않고 그때그때 만든다. "10회차 달성" 같은 것을 표에 넣어 두면
 * 나중에 회차를 되돌리거나 계약을 지운 뒤에도 그 줄이 거짓으로 남는다.
 */

/** 몇 회차마다 마디를 찍을지. 10회 계약이 흔해서 10 단위로 둔다. */
const SESSION_MILESTONE_STEP = 10;

/** 체중이 이만큼 움직이면 마디로 본다. 0.5kg 마다 찍으면 마디가 아니라 목록이 된다. */
const WEIGHT_MILESTONE_STEP = 3;

export type JourneyKind =
  | "CONNECTED"
  | "CONTRACT_STARTED"
  | "CONTRACT_CLOSED"
  | "FIRST_SESSION"
  | "SESSION_MILESTONE"
  | "BODY_MILESTONE"
  | "GOAL_REACHED";

export interface JourneyEvent {
  id: string;
  kind: JourneyKind;
  at: Date;
  title: string;
  detail: string | null;
  /** 눌러서 들어갈 곳. 없으면 안 눌린다. */
  href: string | null;
}

export interface JourneySummary {
  memberName: string;
  startedAt: Date;
  /** 함께한 날 수. */
  days: number;
  /** 계약 수. 두 건 이상이면 재등록한 것이다. */
  contractCount: number;
  renewals: number;
  completedSessions: number;
  noShowSessions: number;
  cancelledSessions: number;
  /** 아직 안 한, 잡아 둔 수업. */
  scheduledSessions: number;
  journalCount: number;
  /** 공유가 켜져 있고 잰 기록이 둘 이상일 때만. */
  weight: {
    first: number;
    latest: number;
    delta: number;
  } | null;
}

export interface MemberJourney {
  summary: JourneySummary;
  events: JourneyEvent[];
  /** 체성분을 못 보고 있다는 것을 화면이 말해 줘야 한다. 빈 여정과 구분된다. */
  sharedBody: boolean;
}

function daysBetween(from: Date, to: Date) {
  return Math.max(Math.floor((to.getTime() - from.getTime()) / 86_400_000), 0);
}

function toNumber(value: { toString(): string } | null) {
  return value === null ? null : Number(value.toString());
}

const CLOSED_LABEL: Partial<Record<PTContractStatus, string>> = {
  COMPLETED: "다 채웠어요",
  EXPIRED: "기간이 끝났어요",
  CANCELLED: "중단했어요",
};

/**
 * 회원 한 명의 여정.
 *
 * 개인 기록(체성분)은 공유 설정을 지나야 들어간다. PT 회차와 알림장은 원래
 * 양쪽이 보는 것이라 바로 센다.
 */
export async function getMemberJourney(
  trainerUserId: string,
  connectionId: string,
): Promise<MemberJourney> {
  const trainer = await requireTrainerProfile(trainerUserId);
  const connection = await requireMyMember(trainer.id, connectionId);
  const sharing = await getSharingForTrainer(trainerUserId, connectionId);

  const memberUserId = connection.memberUserId;
  const since = connection.startedAt;

  const [contracts, sessions, journalCount, bodyRows, goals] =
    await Promise.all([
      prisma.pTContract.findMany({
        where: { memberUserId, trainerProfileId: trainer.id },
        orderBy: { startedAt: "asc" },
        select: {
          id: true,
          title: true,
          totalSessions: true,
          usedSessions: true,
          startedAt: true,
          status: true,
          updatedAt: true,
        },
      }),

      // 마디를 세려면 완료한 회차를 시간순으로 다 훑어야 한다. 한 회원의 회차는
      // 많아야 수백 건이라 이 정도는 가져와도 된다.
      prisma.pTSession.findMany({
        where: { memberUserId, trainerProfileId: trainer.id },
        orderBy: { scheduledAt: "asc" },
        select: {
          id: true,
          status: true,
          scheduledAt: true,
          completedAt: true,
          contractId: true,
          journals: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { id: true },
          },
        },
      }),

      prisma.journal.count({
        where: { memberUserId, trainerProfileId: trainer.id },
      }),

      sharing.shareBody
        ? prisma.bodyRecord.findMany({
            where: { userId: memberUserId, recordedAt: { gte: since } },
            orderBy: { recordedAt: "asc" },
            select: {
              id: true,
              recordedAt: true,
              weightKg: true,
              bodyFatPercent: true,
              skeletalMuscleKg: true,
            },
          })
        : [],

      sharing.shareBody
        ? prisma.goal.findMany({
            where: {
              userId: memberUserId,
              status: { not: GoalStatus.CANCELLED },
              type: { in: [...BODY_GOAL_TYPES] },
            },
            select: {
              id: true,
              type: true,
              startValue: true,
              targetValue: true,
              startDate: true,
            },
          })
        : [],
    ]);

  const completed = sessions.filter(
    (session) => session.status === PTSessionStatus.COMPLETED,
  );

  const summary: JourneySummary = {
    memberName: connection.memberUser.name,
    startedAt: since,
    days: daysBetween(since, new Date()),
    contractCount: contracts.length,
    renewals: Math.max(contracts.length - 1, 0),
    completedSessions: completed.length,
    noShowSessions: sessions.filter(
      (session) => session.status === PTSessionStatus.NO_SHOW,
    ).length,
    cancelledSessions: sessions.filter(
      (session) => session.status === PTSessionStatus.CANCELLED,
    ).length,
    scheduledSessions: sessions.filter(
      (session) => session.status === PTSessionStatus.SCHEDULED,
    ).length,
    journalCount,
    weight: null,
  };

  const events: JourneyEvent[] = [];

  events.push({
    id: `connected-${connection.id}`,
    kind: "CONNECTED",
    at: since,
    title: "함께 시작했어요",
    detail: null,
    href: null,
  });

  for (const [index, contract] of contracts.entries()) {
    events.push({
      id: `contract-start-${contract.id}`,
      kind: "CONTRACT_STARTED",
      at: contract.startedAt,
      title:
        index === 0 ? `${contract.title} 시작` : `${contract.title} 재등록`,
      detail: `${contract.totalSessions}회`,
      href: `/trainer/members/${connectionId}/contracts/${contract.id}`,
    });

    // 끝난 계약만 마디로 찍는다. 끝난 시각을 따로 적어 두지 않아서 마지막으로
    // 손댄 때를 쓴다. 상담에서 필요한 건 "언제쯤 끝났나" 라 이 정도면 된다.
    if (contract.status !== PTContractStatus.ACTIVE) {
      events.push({
        id: `contract-close-${contract.id}`,
        kind: "CONTRACT_CLOSED",
        at: contract.updatedAt,
        title: `${contract.title} ${CLOSED_LABEL[contract.status] ?? "끝났어요"}`,
        detail: `${contract.usedSessions} / ${contract.totalSessions}회`,
        href: `/trainer/members/${connectionId}/contracts/${contract.id}`,
      });
    }
  }

  /*
    회차 마디.

    첫 수업과 10회마다 하나씩. 회차 번호가 아니라 실제로 완료한 순서로 센다.
    번호는 잡은 순서라서 미루고 취소하다 보면 "7회차" 가 열 번째로 한 수업일 수
    있는데, 상담에서 말하는 "열 번째 수업" 은 실제로 만난 횟수다. 계약이 여러
    건이어도 이어서 센다. 재등록한 회원에게 "45번째 수업" 이 맞는 말이다.
  */
  completed.forEach((session, index) => {
    const nth = index + 1;
    const at = session.completedAt ?? session.scheduledAt;
    /*
      알림장이 있으면 그리로, 없으면 그 회차가 든 계약 화면으로 보낸다.
      10·20회차에 알림장이 붙어 있을 확률은 높지 않은데, 마디를 눌렀을 때
      아무 일도 안 일어나면 화면이 고장 난 것처럼 보인다.
    */
    const journalId = session.journals[0]?.id ?? null;
    const href = journalId
      ? `/trainer/journals/${journalId}`
      : `/trainer/members/${connectionId}/contracts/${session.contractId}`;

    if (nth === 1) {
      events.push({
        id: `first-session-${session.id}`,
        kind: "FIRST_SESSION",
        at,
        title: "첫 수업",
        detail: null,
        href,
      });
      return;
    }

    if (nth % SESSION_MILESTONE_STEP === 0) {
      events.push({
        id: `session-${session.id}`,
        kind: "SESSION_MILESTONE",
        at,
        title: `${nth}번째 수업`,
        detail: null,
        href,
      });
    }
  });

  /*
    체중 마디.

    처음 잰 값에서 3kg 단위로 멀어질 때마다 하나씩. 매번 찍으면 마디가 아니라
    체중 목록이 되고, 오르내리는 사이 같은 칸이 두 번 찍히지 않도록 이미 지난
    칸은 기억해 둔다.
  */
  const weightPoints = bodyRows
    .filter((row) => row.weightKg !== null)
    .map((row) => ({
      id: row.id,
      at: row.recordedAt,
      value: Number(row.weightKg!.toString()),
    }));

  if (weightPoints.length > 1) {
    const first = weightPoints[0];
    const latest = weightPoints[weightPoints.length - 1];

    summary.weight = {
      first: first.value,
      latest: latest.value,
      delta: Math.round((latest.value - first.value) * 10) / 10,
    };

    const seen = new Set<number>();

    for (const point of weightPoints) {
      const step = Math.trunc(
        (point.value - first.value) / WEIGHT_MILESTONE_STEP,
      );

      if (step === 0 || seen.has(step)) continue;
      seen.add(step);

      const moved = Math.abs(step) * WEIGHT_MILESTONE_STEP;

      events.push({
        id: `body-${point.id}`,
        kind: "BODY_MILESTONE",
        at: point.at,
        title: `체중 ${step < 0 ? "-" : "+"}${moved}kg`,
        detail: `${first.value}kg → ${point.value}kg`,
        href: null,
      });
    }
  }

  /*
    목표 달성 마디.

    Goal.status 로는 알 수 없다. COMPLETED 를 박는 코드가 없고, 달성 여부는
    최신 기록에서 파생하기 때문이다. 그래서 목표를 세운 뒤의 기록을 훑어
    처음으로 목표를 넘어선 날을 찾는다. "9월 15일에 도달하셨어요" 라고
    말하려면 달성 여부가 아니라 달성한 날이 필요하다.

    방향은 startValue 와 targetValue 로 정한다. 체중은 줄이는 사람도 늘리는
    사람도 있어서 부등호를 하나로 고정할 수 없다.
  */
  for (const goal of goals) {
    const meta = METRIC[goal.type as keyof typeof METRIC];
    const target = toNumber(goal.targetValue);
    const start = toNumber(goal.startValue);
    if (!meta || target === null || start === null || start === target) {
      continue;
    }

    const goingDown = target < start;

    const reached = bodyRows.find((row) => {
      if (row.recordedAt < goal.startDate) return false;
      const value = toNumber(row[meta.field]);
      if (value === null) return false;
      return goingDown ? value <= target : value >= target;
    });

    if (!reached) continue;

    events.push({
      id: `goal-${goal.id}`,
      kind: "GOAL_REACHED",
      at: reached.recordedAt,
      title: `${meta.label} 목표 달성`,
      detail: `${start}${meta.unit} → ${target}${meta.unit}`,
      href: null,
    });
  }

  // 최근 것이 위로. 상담에서 먼저 꺼내는 건 늘 최근 이야기다.
  events.sort((a, b) => b.at.getTime() - a.at.getTime());

  return { summary, events, sharedBody: sharing.shareBody };
}
