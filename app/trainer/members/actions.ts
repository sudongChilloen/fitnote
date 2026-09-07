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
