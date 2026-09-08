"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/app/lib/dal";
import { acknowledgeSessionChange, PTError } from "@/server/pt/pt.service";

/**
 * 회원이 일정 변경을 확인했다.
 *
 * 확인하면 예정된 수업에서는 표시만 사라지고, 취소된 수업은 목록에서 빠진다.
 * 되돌릴 방법은 안 둔다 — 잘못 눌러도 수업 자체는 그대로 있고, 예정된 수업은
 * 계속 목록에 남는다. 잃는 건 표시 하나뿐이다.
 */
export async function acknowledgeSessionAction(sessionId: string) {
  const user = await requireUser();

  try {
    await acknowledgeSessionChange(user.id, sessionId);
  } catch (error) {
    return {
      error:
        error instanceof PTError ? error.message : "잠시 후 다시 시도해주세요.",
    };
  }

  revalidatePath("/home");
  return { error: null };
}
