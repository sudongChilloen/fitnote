import "server-only";

import { Prisma } from "@/generated/prisma/client";
import {
  ConnectionStatus,
  PTSessionStatus,
  WorkoutEntryMode,
  WorkoutSessionStatus,
} from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { lockPTSession } from "@/server/pt/pt-session-lock";

/** 서비스 계층에서 의미 있는 실패를 구분하기 위한 에러 */
export class WorkoutError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = "WorkoutError";
  }
}

/**
 * Prisma Decimal 은 JSON 으로 나갈 때 문자열이 된다.
 * 프론트에서 숫자 연산이 문자열 결합으로 새는 것을 막기 위해 경계에서 변환한다.
 */
export function toNumber(value: Prisma.Decimal | null): number | null {
  return value === null ? null : Number(value);
}

export const setSelect = {
  id: true,
  setNumber: true,
  weight: true,
  reps: true,
  restSeconds: true,
  completed: true,
  rpe: true,
  note: true,
} satisfies Prisma.WorkoutSetSelect;

export const recordInclude = {
  exercise: {
    select: {
      id: true,
      name: true,
      bodyPart: true,
      targetMuscle: true,
      movementType: true,
      difficulty: true,
    },
  },
  sets: {
    orderBy: { setNumber: "asc" },
    select: setSelect,
  },
} satisfies Prisma.WorkoutRecordInclude;

export const sessionInclude = {
  records: {
    orderBy: { orderIndex: "asc" },
    include: recordInclude,
  },
  // PT 수업으로 한 운동인지, 누가 대신 적어 줬는지.
  // 세션 한 줄에 딸린 값이라 목록에서 함께 가져와도 비용이 없다.
  recordedBy: { select: { name: true } },
} satisfies Prisma.WorkoutSessionInclude;

type SetPayload = Prisma.WorkoutSetGetPayload<{ select: typeof setSelect }>;

type RecordPayload = Prisma.WorkoutRecordGetPayload<{
  include: typeof recordInclude;
}>;

type SessionPayload = Prisma.WorkoutSessionGetPayload<{
  include: typeof sessionInclude;
}>;

export function toSetDto(set: SetPayload) {
  return {
    id: set.id,
    setNumber: set.setNumber,
    weight: toNumber(set.weight),
    reps: set.reps,
    restSeconds: set.restSeconds,
    completed: set.completed,
    rpe: toNumber(set.rpe),
    note: set.note,
  };
}

export function toRecordDto(record: RecordPayload) {
  return {
    id: record.id,
    orderIndex: record.orderIndex,
    note: record.note,
    totalVolume: toNumber(record.totalVolume),
    exercise: record.exercise,
    sets: record.sets.map(toSetDto),
  };
}

export function toSessionDto(session: SessionPayload) {
  const records = session.records.map(toRecordDto);
  const until = session.endedAt ?? new Date();

  return {
    id: session.id,
    routineId: session.routineId,
    startedAt: session.startedAt,
    endedAt: session.endedAt,
    durationSec: session.durationSec,
    entryMode: session.entryMode,
    /**
     * PT 수업으로 한 운동인지.
     *
     * 개인 기록으로 복사하지 않고 표시만 한다. 복사하면 같은 운동이 두 번
     * 남아서 이번 주 몇 번 했는지부터 어긋난다.
     */
    isPt: session.ptSessionId !== null,
    /** PT 라면 대신 적어 준 트레이너 이름. */
    recordedByName: session.recordedBy?.name ?? null,
    // 진행중 세션의 경과 시간. 서버에서 계산해 두면 화면이 첫 렌더부터
    // 올바른 값을 그릴 수 있고, 컴포넌트가 렌더 중 Date.now() 를 부르지 않아도 된다.
    //
    // 몰아서 입력하는 세션에는 흐르는 시간이 없다. 지난 날짜를 입력하는 중이라면
    // startedAt 이 며칠 전이라 "3일 12시간 경과" 같은 값이 나온다.
    elapsedSec:
      session.entryMode === WorkoutEntryMode.MANUAL
        ? null
        : Math.max(
            0,
            Math.floor((until.getTime() - session.startedAt.getTime()) / 1000),
          ),
    status: session.status,
    memo: session.memo,
    records,
    // 세션 전체 합계. 클라이언트가 매번 합산하지 않도록 서버에서 계산한다.
    totalVolume: records.reduce(
      (sum, record) => sum + (record.totalVolume ?? 0),
      0,
    ),
    totalSets: records.reduce((sum, record) => sum + record.sets.length, 0),
  };
}

/**
 * PT/운동 기록에서 동시에 같은 세션을 수정할 때 직렬화 충돌을 재시도한다.
 *
 * PostgreSQL Serializable 트랜잭션은 동시 요청 중 하나를 P2034로 실패시킬 수 있다.
 * 사용자는 같은 버튼을 빠르게 두 번 누르거나, 모바일/데스크톱에서 같은 화면을
 * 동시에 열 수 있으므로 일시적인 serialization failure는 서비스 계층에서 재시도한다.
 */
const MAX_TRANSACTION_RETRIES = 3;

function isSerializationFailure(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2034"
  );
}

export async function serializableTransaction<T>(
  callback: (tx: Prisma.TransactionClient) => Promise<T>,
) {
  let lastError: unknown;

  for (let attempt = 0; attempt < MAX_TRANSACTION_RETRIES; attempt += 1) {
    try {
      return await prisma.$transaction(callback, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
    } catch (error) {
      lastError = error;
      if (
        !isSerializationFailure(error) ||
        attempt === MAX_TRANSACTION_RETRIES - 1
      ) {
        throw error;
      }
    }
  }

  throw lastError;
}

/**
 * 같은 세션에 대한 기록 추가/삭제/세트 변경을 한 줄로 직렬화한다.
 *
 * (sessionId, exerciseId) unique를 두지 않는 이유는 같은 운동을 한 세션에
 * 두 번 기록하는 것이 정상적인 사용 사례이기 때문이다. 대신 자동 복사/동시 입력
 * 같은 작업의 순서 계산을 WorkoutSession row lock으로 보호한다.
 */
async function lockWorkoutSession(
  tx: Prisma.TransactionClient,
  sessionId: string,
) {
  const rows = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT "id"
    FROM "WorkoutSession"
    WHERE "id" = ${sessionId}
    FOR UPDATE
  `;

  if (rows.length === 0) {
    throw new WorkoutError(
      "SESSION_NOT_FOUND",
      "운동 세션을 찾을 수 없습니다.",
    );
  }
}

/**
 * 운동 세션을 실제로 수정하기 직전에 현재 상태를 다시 확인한다.
 *
 * PT 운동이면 PTSession과 WorkoutSession이 같은 변경 순서에 들어가야 한다.
 * `pt.service.ts`도 `pt-session:${ptSessionId}` lock을 사용하므로, 여기서도
 * 같은 lock을 먼저 잡으면 수업 취소/완료/reopen과 운동 기록 저장이 서로
 * 다른 snapshot을 기준으로 쓰는 race를 막을 수 있다.
 */
export async function lockWorkoutMutation(
  tx: Prisma.TransactionClient,
  sessionId: string,
) {
  const beforeLock = await tx.workoutSession.findUnique({
    where: { id: sessionId },
    select: { ptSessionId: true },
  });

  if (!beforeLock) {
    throw new WorkoutError(
      "SESSION_NOT_FOUND",
      "운동 세션을 찾을 수 없습니다.",
    );
  }

  // PTSession lock을 먼저 잡고, 그 다음 WorkoutSession lock을 잡는다.
  // PT 서비스는 contract -> PTSession 순서를 사용하므로 여기서는 그 하위 lock만
  // 잡아 deadlock 가능성을 늘리지 않는다.
  if (beforeLock.ptSessionId) {
    await lockPTSession(tx, beforeLock.ptSessionId);
  }

  await lockWorkoutSession(tx, sessionId);

  const current = await tx.workoutSession.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      userId: true,
      status: true,
      ptSessionId: true,
    },
  });

  if (!current) {
    throw new WorkoutError(
      "SESSION_NOT_FOUND",
      "운동 세션을 찾을 수 없습니다.",
    );
  }

  assertEditable(current.status);

  if (current.ptSessionId) {
    const ptSession = await tx.pTSession.findUnique({
      where: { id: current.ptSessionId },
      select: { status: true },
    });

    if (!ptSession) {
      throw new WorkoutError(
        "PT_SESSION_NOT_FOUND",
        "PT 수업을 찾을 수 없습니다.",
      );
    }

    if (ptSession.status === PTSessionStatus.CANCELLED) {
      throw new WorkoutError(
        "PT_SESSION_CANCELLED",
        "취소한 수업에는 운동을 적을 수 없습니다.",
      );
    }
  }

  return current;
}

/**
 * 이 세션에 손댈 수 있는 사람인가. 손댈 수 있으면 기록 주인의 userId 를 준다.
 *
 * 기록의 주인은 언제나 회원이다. 트레이너가 PT 수업에서 든 무게를 대신 적어
 * 줄 때도 `WorkoutRecord.userId` 는 회원이어야 한다. 여기에 트레이너를 넣으면
 * 회원의 운동 이력에서 하필 PT 수업만 통째로 빠진다.
 *
 * 그래서 "누가 눌렀나" 와 "누구의 기록인가" 를 나누고, 손댈 자격만 여기서
 * 한 번에 판단한다. 이 판단이 흩어지면 어느 한 곳에서 빠뜨렸을 때 남의 기록이
 * 고쳐진다.
 *
 * 트레이너는 자기가 가르친 PT 수업의 기록만 만질 수 있다. 개인 운동은 공유
 * 설정을 켜도 읽기만 한다 — 회원이 혼자 한 운동을 남이 고치는 건 다른 이야기다.
 */
type WorkoutAccessContext = {
  ownerUserId: string;
  status: WorkoutSessionStatus;
  sessionId: string;
  ptSessionId: string | null;
  trainerProfileId: string | null;
  canRead: boolean;
  canWrite: boolean;
};

/**
 * 운동 세션을 읽을 수 있는지 판단한다.
 *
 * 읽기와 쓰기를 분리한다. 담당이 끝난 트레이너도 자신이 가르친 과거 PT 기록은
 * 볼 수 있지만 수정할 수는 없다. 회원 본인은 언제나 자신의 기록을 읽을 수 있고,
 * PT 기록은 트레이너가 적은 값이므로 회원이 수정하지 못한다.
 */
export async function resolveReadContext(
  actorUserId: string,
  sessionId: string,
): Promise<WorkoutAccessContext | null> {
  const session = await prisma.workoutSession.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      userId: true,
      status: true,
      ptSessionId: true,
      ptSession: {
        select: {
          trainerProfileId: true,
        },
      },
    },
  });

  if (!session) return null;

  // 회원 본인. PT 여부와 관계없이 읽을 수 있지만 PT 수정은 막는다.
  if (session.userId === actorUserId) {
    return {
      ownerUserId: session.userId,
      status: session.status,
      sessionId: session.id,
      ptSessionId: session.ptSessionId,
      trainerProfileId: session.ptSession?.trainerProfileId ?? null,
      canRead: true,
      canWrite: session.ptSessionId === null,
    };
  }

  // 개인 운동은 트레이너가 읽을 이유가 없다.
  if (!session.ptSession) return null;

  const trainer = await prisma.trainerProfile.findUnique({
    where: { userId: actorUserId },
    select: { id: true },
  });

  if (!trainer || trainer.id !== session.ptSession.trainerProfileId) {
    return null;
  }

  const connection = await prisma.trainerMemberConnection.findUnique({
    where: {
      trainerProfileId_memberUserId: {
        trainerProfileId: trainer.id,
        memberUserId: session.userId,
      },
    },
    select: { status: true },
  });

  return {
    ownerUserId: session.userId,
    status: session.status,
    sessionId: session.id,
    ptSessionId: session.ptSessionId,
    trainerProfileId: trainer.id,
    canRead: true,
    canWrite: connection?.status === ConnectionStatus.ACTIVE,
  };
}

/** 쓰기용 컨텍스트. 읽기 권한은 유지하되 담당 종료 시 쓰기는 막는다. */
export async function resolveOwner(actorUserId: string, sessionId: string) {
  return resolveReadContext(actorUserId, sessionId);
}

/** 고칠 수 있는 사람인가. 아니면 왜 안 되는지 말해 준다. */
export function assertWritable(owner: { canWrite: boolean }) {
  if (!owner.canWrite) {
    throw new WorkoutError(
      "PT_RECORD",
      "수업에서 트레이너가 적어 준 기록이라 고칠 수 없어요.",
    );
  }
}

/**
 * 기록을 고칠 수 있는 상태인가.
 *
 * "종료" 는 운동이 끝났다는 뜻이지 데이터가 굳었다는 뜻이 아니다.
 * 집에 와서 무게를 잘못 적은 걸 발견하는 일은 흔하다. 그래서 완료된
 * 세션도 고칠 수 있게 두고, 취소한 세션만 막는다.
 *
 * 이 검사는 한 곳에 모아 둔다. 예전에는 운동 추가만 막고 세트 수정은
 * 상태를 아예 보지 않아, 취소한 세션의 세트가 고쳐지고 있었다.
 */
export function assertEditable(status: WorkoutSessionStatus) {
  if (status === WorkoutSessionStatus.CANCELLED) {
    throw new WorkoutError(
      "SESSION_CANCELLED",
      "취소한 기록은 수정할 수 없습니다.",
    );
  }
}
