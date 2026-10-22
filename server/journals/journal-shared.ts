import "server-only";

import { prisma } from "@/lib/prisma";
import { ConnectionStatus, NoticeScope } from "@/generated/prisma/enums";

export class JournalError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "JournalError";
  }
}

/**
 * 회원이 볼 수 있는 공지의 조건.
 *
 * 대상을 회원 목록으로 펼쳐 저장하지 않고 여기서 계산한다. 미리 펼치면 회원이
 * 들어오고 나갈 때마다 지난 공지의 대상까지 손봐야 한다.
 */
export function noticeVisibility(
  membership: { id: string; centerId: string },
  trainerUserIds: string[],
) {
  const scopes: object[] = [{ scope: NoticeScope.CENTER }];

  // 담당 트레이너가 쓴 공지. 담당 관계는 이제 센터 소속이 아니라 연결에 있어서
  // 작성자의 소속 id 대신 작성자가 누구인지로 찾는다. 한 사람이 센터를 옮겨도
  // 같은 사람이면 계속 걸린다.
  if (trainerUserIds.length > 0) {
    scopes.push({
      scope: NoticeScope.TRAINER_MEMBERS,
      authorMembership: { userId: { in: trainerUserIds } },
    });
  }

  return {
    centerId: membership.centerId,
    publishedAt: { not: null },
    OR: scopes,
  };
}

/** 나를 지금 봐 주고 있는 트레이너들의 userId. */
export async function activeTrainerUserIds(memberUserId: string) {
  const rows = await prisma.trainerMemberConnection.findMany({
    where: { memberUserId, status: ConnectionStatus.ACTIVE },
    select: { trainerProfile: { select: { userId: true } } },
  });

  return rows.map((row) => row.trainerProfile.userId);
}
