"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireUser } from "@/app/lib/dal";
import { startJournal } from "@/server/journals/journal-editor.service";
import { completeSession, PTError } from "@/server/pt/pt.service";
import {
  deleteSessionWorkout,
  openSessionWorkout,
} from "@/server/pt/session-record.service";
import { TrainerError } from "@/server/trainers/trainer.service";

function messageOf(error: unknown) {
  if (error instanceof PTError || error instanceof TrainerError) {
    return error.message;
  }
  console.error("session record error:", error);
  return "처리하지 못했어요. 잠시 후 다시 시도해주세요.";
}

/**
 * 수업 기록 화면으로 들어가면서 운동 기록을 미리 열어 둔다.
 *
 * 트레이너가 이 버튼을 누르는 순간은 대개 수업 중이거나 막 끝난 직후이고,
 * 그때 하려는 일은 방금 든 무게를 적는 것이다. 들어가서 "운동 기록 적기" 를
 * 한 번 더 눌러야 하면 그 한 번이 수업 중에는 크다.
 *
 * 빈 운동 기록이 생기는 게 아깝지 않은 이유는, 세트가 하나도 없으면 회원
 * 화면에 운동 없는 PT 한 줄로만 보이고 기록을 통째로 지울 수도 있어서다.
 */
export async function enterSessionRecord(formData: FormData) {
  const user = await requireUser();
  const ptSessionId = String(formData.get("ptSessionId") ?? "");

  try {
    await openSessionWorkout(user.id, ptSessionId);
  } catch (error) {
    // 취소한 수업이면 열지 못한다. 그래도 화면은 보여 준다.
    console.warn("openSessionWorkout skipped:", messageOf(error));
  }

  redirect(`/trainer/sessions/${ptSessionId}`);
}

export async function openWorkoutAction(ptSessionId: string) {
  const user = await requireUser();

  try {
    await openSessionWorkout(user.id, ptSessionId);
  } catch (error) {
    return { error: messageOf(error) };
  }

  revalidatePath(`/trainer/sessions/${ptSessionId}`);
  return { error: null };
}

export async function removeWorkoutAction(ptSessionId: string) {
  const user = await requireUser();

  try {
    await deleteSessionWorkout(user.id, ptSessionId);
  } catch (error) {
    return { error: messageOf(error) };
  }

  revalidatePath(`/trainer/sessions/${ptSessionId}`);
  return { error: null };
}

/**
 * 수업을 완료 처리한다. 여기서 PT 횟수가 깎인다.
 *
 * 저장과 묶지 않는다. 운동 세트는 적는 즉시 저장되고 있고, 그래야 한다. 수업은
 * 한 시간이고 그동안 폰은 잠기고 뒤로도 눌린다. 마지막 버튼 하나에 한 시간치를
 * 걸 수 없다. 그래서 이 버튼은 "저장" 이 아니라 "이 수업 한 회를 썼다" 만 한다.
 *
 * 알림장으로 자동으로 넘기지도 않는다. 넘겨 버리면 안 쓰고 나갔을 때 빈 초안이
 * 남아 할 일 목록에 "쓰는 중" 으로 뜬다. 완료했다고 알려 주고 알림장은 권하기만
 * 한다.
 */
export async function completeSessionAction(formData: FormData) {
  const user = await requireUser();
  const ptSessionId = String(formData.get("ptSessionId") ?? "");

  try {
    await completeSession(user.id, ptSessionId);
  } catch (error) {
    redirect(
      `/trainer/sessions/${ptSessionId}?error=${encodeURIComponent(messageOf(error))}`,
    );
  }

  revalidatePath("/trainer");
  revalidatePath("/trainer/schedule");

  redirect(`/trainer/sessions/${ptSessionId}?completed=1`);
}

/** 이 수업의 알림장을 쓰러 간다. 없으면 여기서 초안이 생긴다. */
export async function writeJournalAction(formData: FormData) {
  const user = await requireUser();

  const ptSessionId = String(formData.get("ptSessionId") ?? "");
  const connectionId = String(formData.get("connectionId") ?? "");

  const journalId = await startJournal(user.id, connectionId, ptSessionId);

  redirect(`/trainer/journals/${journalId}`);
}
