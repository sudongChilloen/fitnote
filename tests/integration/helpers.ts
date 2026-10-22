import { randomUUID } from "node:crypto";

import { prisma } from "@/lib/prisma";
import {
  createMemberClaimCode,
  createPendingMember,
  startTrainerProfile,
} from "@/server/trainers/connection.service";

/** 테스트마다 겹치지 않는 값. 같은 DB 를 쓰므로 데이터를 비우는 대신 서로 안 겹치게 만든다. */
export const uniq = () => randomUUID().slice(0, 8);

export async function makeTrainer() {
  const user = await prisma.user.create({
    data: {
      name: `트레이너${uniq()}`,
      email: `trainer-${uniq()}@test.com`,
      passwordHash: "x",
    },
    select: { id: true },
  });

  const profile = await startTrainerProfile(user.id, {});

  return { userId: user.id, profileId: profile.id };
}

/** 트레이너가 이름만으로 만든 미가입 회원. */
export async function makePendingMember(trainerUserId: string) {
  return createPendingMember(trainerUserId, { name: `회원${uniq()}` });
}

export async function makeClaimCode(
  trainerUserId: string,
  connectionId: string,
) {
  const { code } = await createMemberClaimCode(trainerUserId, connectionId);
  return code;
}

/** 트레이너, 담당 회원, 계약 하나. */
export async function makeContract(
  total: number,
  create: (typeof import("@/server/pt/pt.service"))["createContract"],
) {
  const trainer = await makeTrainer();
  const member = await makePendingMember(trainer.userId);

  const contract = await create(trainer.userId, {
    connectionId: member.connectionId,
    totalSessions: total,
    startedAt: new Date(),
  });

  return { trainer, member, contractId: contract.id };
}
