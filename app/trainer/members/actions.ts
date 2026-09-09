"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireUser } from "@/app/lib/dal";
import {
  addDietFeedback,
  deleteDietFeedback,
} from "@/server/diet/diet-trainer.service";
import { DietError } from "@/server/diet/diet.service";
import { SharingError } from "@/server/sharing/sharing.service";
import {
  ConnectionError,
  createPendingMember,
} from "@/server/trainers/connection.service";
import { TrainerError } from "@/server/trainers/trainer.service";

/**
 * 식단 피드백 쓰기.
 *
 * 자바스크립트가 없어도 되도록 상태를 돌려주지 않고 주소에 실패 이유를 싣는다.
 * 값은 정해진 몇 개뿐이고 화면에서 문구로 바꾼다 — 서버 메시지를 주소로 나르면
 * 링크 하나로 아무 문구나 띄울 수 있다.
 */
export type FeedbackError = "empty" | "not_shared" | "unknown";

export async function writeDietFeedback(formData: FormData) {
  const user = await requireUser();

  const memberId = String(formData.get("memberMembershipId") ?? "");
  const dietId = String(formData.get("dietId") ?? "");
  const base = `/trainer/members/${memberId}/diet/${dietId}`;

  const fail = (error: FeedbackError) => redirect(`${base}?error=${error}`);

  try {
    await addDietFeedback(user.id, memberId, dietId, formData.get("content"));
  } catch (error) {
    if (error instanceof DietError) {
      fail(error.code === "INVALID" ? "empty" : "unknown");
    }
    if (error instanceof SharingError) fail("not_shared");
    if (error instanceof TrainerError) fail("unknown");
    throw error;
  }

  revalidatePath(base);
  revalidatePath(`/trainer/members/${memberId}`);

  redirect(base);
}

export async function removeDietFeedback(formData: FormData) {
  const user = await requireUser();

  const memberId = String(formData.get("memberMembershipId") ?? "");
  const dietId = String(formData.get("dietId") ?? "");
  const feedbackId = String(formData.get("feedbackId") ?? "");

  await deleteDietFeedback(user.id, memberId, feedbackId);

  revalidatePath(`/trainer/members/${memberId}/diet/${dietId}`);
  redirect(`/trainer/members/${memberId}/diet/${dietId}`);
}

/**
 * 트레이너가 회원을 직접 만든다.
 *
 * 만든 뒤 그 회원의 상세로 보낸다. 트레이너가 회원을 만드는 건 이름을 적어
 * 두려는 게 아니라 계약을 걸거나 수업을 잡으려는 것이고, 그건 전부 상세에
 * 있다. 목록으로 돌려보내면 방금 만든 사람을 다시 찾아 눌러야 한다.
 */
export async function createMemberAction(formData: FormData) {
  const user = await requireUser();

  const name = String(formData.get("name") ?? "").trim();

  if (!name) {
    return { error: "이름을 적어 주세요.", connectionId: null };
  }

  let created: { connectionId: string };

  try {
    created = await createPendingMember(user.id, {
      name,
      phone: String(formData.get("phone") ?? ""),
    });
  } catch (error) {
    if (error instanceof ConnectionError) {
      return { error: error.message, connectionId: null };
    }

    console.error("create member error:", error);
    return { error: "잠시 후 다시 시도해주세요.", connectionId: null };
  }

  revalidatePath("/trainer/members");
  revalidatePath("/trainer");

  return { error: null, connectionId: created.connectionId };
}
