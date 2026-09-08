"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireUser } from "@/app/lib/dal";
import { startJournal } from "@/server/journals/journal-editor.service";
import { PTSessionActor } from "@/generated/prisma/enums";
import {
  cancelSession,
  completeSession,
  markNoShow,
  PTError,
  reopenSession,
} from "@/server/pt/pt.service";
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
 * 수업을 마무리한다. 여기서 PT 횟수가 깎인다.
 *
 * 저장과 묶지 않는다. 운동 세트는 적는 즉시 저장되고 있고, 그래야 한다. 수업은
 * 한 시간이고 그동안 폰은 잠기고 뒤로도 눌린다. 마지막 버튼 하나에 한 시간치를
 * 걸 수 없다. 그래서 이 버튼은 "저장" 이 아니라 "이 수업을 어떻게 끝냈는가" 만
 * 정한다.
 *
 * 갈래를 넷 다 여기 둔 이유는, 수업이 끝나는 방식이 원래 넷이기 때문이다 —
 * 했거나, 안 왔거나(차감하거나 봐주거나), 미루기로 했거나. 완료만 여기 두고
 * 나머지를 계약 상세에 묻어 두면 회원이 안 온 날 회원 → 계약 → 회차를 뒤져야
 * 한다. 그 세 단계가 귀찮아서 그냥 완료를 눌러 버리면 횟수가 틀어진다.
 *
 * 되돌릴 수도 있다(`reopen`). 되돌릴 수 있으니 누르기 전에 겁줄 필요는 없고,
 * 대신 무엇이 깎이는지만 정확히 적어 둔다.
 */
export async function finishSessionAction(formData: FormData) {
  const user = await requireUser();

  const ptSessionId = String(formData.get("ptSessionId") ?? "");
  const intent = String(formData.get("intent") ?? "");
  const deduct = formData.get("deduct") === "on";
  const raw = String(formData.get("reason") ?? "").trim();
  const reason = raw === "" ? null : raw;

  try {
    if (intent === "complete") {
      await completeSession(user.id, ptSessionId);
    } else if (intent === "no_show") {
      await markNoShow(user.id, ptSessionId, { deduct, reason });
    } else if (intent === "cancel") {
      await cancelSession(user.id, ptSessionId, {
        cancelledBy:
          formData.get("cancelledBy") === "TRAINER"
            ? PTSessionActor.TRAINER
            : PTSessionActor.MEMBER,
        deduct,
        reason,
      });
    } else if (intent === "reopen") {
      await reopenSession(user.id, ptSessionId);
    } else {
      redirect(
        `/trainer/sessions/${ptSessionId}?error=${encodeURIComponent("무엇을 할지 골라 주세요.")}`,
      );
    }
  } catch (error) {
    redirect(
      `/trainer/sessions/${ptSessionId}?error=${encodeURIComponent(messageOf(error))}`,
    );
  }

  revalidatePath("/trainer");
  revalidatePath("/trainer/schedule");
  revalidatePath("/trainer/journals");

  redirect(`/trainer/sessions/${ptSessionId}?done=${intent}`);
}

/** 이 수업의 알림장을 쓰러 간다. 없으면 여기서 초안이 생긴다. */
export async function writeJournalAction(formData: FormData) {
  const user = await requireUser();

  const ptSessionId = String(formData.get("ptSessionId") ?? "");
  const connectionId = String(formData.get("connectionId") ?? "");

  const journalId = await startJournal(user.id, connectionId, ptSessionId);

  redirect(`/trainer/journals/${journalId}`);
}
