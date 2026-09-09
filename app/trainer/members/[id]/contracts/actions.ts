"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireUser } from "@/app/lib/dal";
import { PTSessionActor } from "@/generated/prisma/enums";
import { kstDateTimeToUtc, kstDateToUtc } from "@/lib/date";
import {
  cancelContract,
  cancelSession,
  completeSession,
  createContract,
  extendContract,
  markNoShow,
  PTError,
  reopenSession,
  rescheduleSession,
  scheduleSession,
} from "@/server/pt/pt.service";
import { TrainerError } from "@/server/trainers/trainer.service";

import { type PTFail } from "./messages";

function toFail(error: unknown): PTFail {
  if (error instanceof PTError) {
    return error.code.toLowerCase() as PTFail;
  }
  if (error instanceof TrainerError) {
    return "not_found";
  }

  console.error("pt action error:", error);
  return "unknown";
}

function refresh(memberId: string, contractId?: string) {
  revalidatePath(`/trainer/members/${memberId}`);
  revalidatePath("/trainer");
  revalidatePath("/home");
  if (contractId) {
    revalidatePath(`/trainer/members/${memberId}/contracts/${contractId}`);
  }
}

function text(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();
  return value.length > 0 ? value : null;
}

export async function createContractAction(formData: FormData) {
  const user = await requireUser();
  const memberId = String(formData.get("connectionId") ?? "");
  const base = `/trainer/members/${memberId}`;

  const startedAtRaw = text(formData, "startedAt");
  const expiresAtRaw = text(formData, "expiresAt");

  const startedAt = startedAtRaw ? kstDateToUtc(startedAtRaw) : null;
  const expiresAt = expiresAtRaw ? kstDateToUtc(expiresAtRaw) : null;

  if (!startedAt || (expiresAtRaw && !expiresAt)) {
    redirect(`${base}/contracts/new?error=invalid`);
  }

  try {
    await createContract(user.id, {
      connectionId: memberId,
      totalSessions: Number(formData.get("totalSessions")),
      startedAt,
      expiresAt,
      title: text(formData, "title"),
    });
  } catch (error) {
    redirect(`${base}/contracts/new?error=${toFail(error)}`);
  }

  refresh(memberId);
  redirect(base);
}

export async function extendContractAction(formData: FormData) {
  const user = await requireUser();
  const memberId = String(formData.get("connectionId") ?? "");
  const contractId = String(formData.get("contractId") ?? "");
  const to = `/trainer/members/${memberId}/contracts/${contractId}`;

  const expiresAtRaw = text(formData, "expiresAt");
  const expiresAt = expiresAtRaw ? kstDateToUtc(expiresAtRaw) : null;

  if (expiresAtRaw && !expiresAt) {
    redirect(`${to}?error=invalid`);
  }

  try {
    await extendContract(user.id, contractId, expiresAt);
  } catch (error) {
    redirect(`${to}?error=${toFail(error)}`);
  }

  refresh(memberId, contractId);
  redirect(to);
}

export async function cancelContractAction(formData: FormData) {
  const user = await requireUser();
  const memberId = String(formData.get("connectionId") ?? "");
  const contractId = String(formData.get("contractId") ?? "");

  try {
    await cancelContract(user.id, contractId);
  } catch (error) {
    redirect(
      `/trainer/members/${memberId}/contracts/${contractId}?error=${toFail(error)}`,
    );
  }

  refresh(memberId, contractId);
  redirect(`/trainer/members/${memberId}`);
}

export async function scheduleSessionAction(formData: FormData) {
  const user = await requireUser();
  const memberId = String(formData.get("connectionId") ?? "");
  const contractId = String(formData.get("contractId") ?? "");
  const to = `/trainer/members/${memberId}/contracts/${contractId}`;

  const date = text(formData, "date");
  const time = text(formData, "time");
  const scheduledAt = date && time ? kstDateTimeToUtc(date, time) : null;

  if (!scheduledAt) {
    redirect(`${to}?error=invalid`);
  }

  try {
    await scheduleSession(user.id, {
      contractId,
      scheduledAt,
      durationMinutes: Number(formData.get("durationMinutes")) || 60,
      memo: text(formData, "memo"),
    });
  } catch (error) {
    redirect(`${to}?error=${toFail(error)}`);
  }

  refresh(memberId, contractId);
  redirect(to);
}

export async function rescheduleSessionAction(formData: FormData) {
  const user = await requireUser();
  const memberId = String(formData.get("connectionId") ?? "");
  const contractId = String(formData.get("contractId") ?? "");
  const to = `/trainer/members/${memberId}/contracts/${contractId}`;

  const date = text(formData, "date");
  const time = text(formData, "time");
  const scheduledAt = date && time ? kstDateTimeToUtc(date, time) : null;

  if (!scheduledAt) {
    redirect(`${to}?error=invalid`);
  }

  try {
    await rescheduleSession(user.id, {
      sessionId: String(formData.get("sessionId") ?? ""),
      scheduledAt,
      movedBy:
        formData.get("movedBy") === "TRAINER"
          ? PTSessionActor.TRAINER
          : PTSessionActor.MEMBER,
      reason: text(formData, "reason"),
    });
  } catch (error) {
    redirect(`${to}?error=${toFail(error)}`);
  }

  refresh(memberId, contractId);
  redirect(to);
}

/**
 * 회차 상태를 바꾼다.
 *
 * 완료 · 노쇼 · 취소 · 되돌리기를 한 액션으로 받는다. 버튼마다 액션을 따로
 * 두면 네 곳에 같은 권한 확인과 같은 실패 처리가 복사된다.
 */
export async function updateSessionAction(formData: FormData) {
  const user = await requireUser();
  const memberId = String(formData.get("connectionId") ?? "");
  const contractId = String(formData.get("contractId") ?? "");
  const sessionId = String(formData.get("sessionId") ?? "");
  const intent = String(formData.get("intent") ?? "");
  const deduct = formData.get("deduct") === "on";
  const to = `/trainer/members/${memberId}/contracts/${contractId}`;

  try {
    if (intent === "complete") {
      await completeSession(user.id, sessionId);
    } else if (intent === "no_show") {
      await markNoShow(user.id, sessionId, {
        deduct,
        reason: text(formData, "reason"),
      });
    } else if (intent === "cancel") {
      await cancelSession(user.id, sessionId, {
        cancelledBy:
          formData.get("cancelledBy") === "TRAINER"
            ? PTSessionActor.TRAINER
            : PTSessionActor.MEMBER,
        deduct,
        reason: text(formData, "reason"),
      });
    } else if (intent === "reopen") {
      await reopenSession(user.id, sessionId);
    } else {
      redirect(`${to}?error=invalid`);
    }
  } catch (error) {
    redirect(`${to}?error=${toFail(error)}`);
  }

  refresh(memberId, contractId);
  redirect(to);
}
