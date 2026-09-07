"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireUser } from "@/app/lib/dal";
import {
  attachPhoto,
  createPhotoUpload,
  deleteJournalDraft,
  JournalEditError,
  removePhoto,
  saveJournal,
  startJournal,
  type UploadTicket,
} from "@/server/journals/journal-editor.service";
import { TrainerError } from "@/server/trainers/trainer.service";

export type SaveState = {
  error: string | null;
  savedAt: string | null;
};

function messageOf(error: unknown) {
  if (error instanceof JournalEditError || error instanceof TrainerError) {
    return error.message;
  }
  console.error("journal editor error:", error);
  return "저장하지 못했어요. 잠시 후 다시 시도해주세요.";
}

/** 회원 상세에서 "알림장 쓰기" 를 누르면 초안을 만들고 편집 화면으로 보낸다. */
export async function beginJournal(formData: FormData) {
  const user = await requireUser();

  const memberMembershipId = String(formData.get("memberMembershipId") ?? "");
  const rawSession = String(formData.get("ptSessionId") ?? "");

  const journalId = await startJournal(
    user.id,
    memberMembershipId,
    rawSession === "" ? undefined : rawSession,
  );

  redirect(`/trainer/journals/${journalId}`);
}

export async function saveJournalAction(
  _prev: SaveState | undefined,
  formData: FormData,
): Promise<SaveState> {
  const user = await requireUser();

  const journalId = String(formData.get("journalId") ?? "");
  const publish = formData.get("publish") === "1";
  const rawSession = formData.get("ptSessionId");

  try {
    await saveJournal(user.id, journalId, {
      title: String(formData.get("title") ?? ""),
      content: String(formData.get("content") ?? ""),
      workoutSummary: String(formData.get("workoutSummary") ?? ""),
      dietGuidance: String(formData.get("dietGuidance") ?? ""),
      caution: String(formData.get("caution") ?? ""),
      nextGoal: String(formData.get("nextGoal") ?? ""),
      ptSessionId: rawSession === null ? undefined : String(rawSession) || null,
      publish,
    });
  } catch (error) {
    return { error: messageOf(error), savedAt: null };
  }

  revalidatePath(`/trainer/journals/${journalId}`);
  revalidatePath("/trainer");
  revalidatePath(`/journal/${journalId}`);
  revalidatePath("/journal");

  if (publish) {
    redirect(`/trainer/journals/${journalId}?published=1`);
  }

  return { error: null, savedAt: new Date().toISOString() };
}

export async function deleteDraftAction(formData: FormData) {
  const user = await requireUser();

  const journalId = String(formData.get("journalId") ?? "");
  const memberMembershipId = String(formData.get("memberMembershipId") ?? "");

  await deleteJournalDraft(user.id, journalId);

  revalidatePath("/trainer");
  redirect(`/trainer/members/${memberMembershipId}`);
}

export type UploadTicketResult =
  { ok: true; ticket: UploadTicket } | { ok: false; error: string };

/** 브라우저가 사진을 직접 올릴 자리를 받아 간다. */
export async function requestPhotoUpload(
  journalId: string,
  mimeType: string,
): Promise<UploadTicketResult> {
  const user = await requireUser();

  try {
    const ticket = await createPhotoUpload(user.id, journalId, mimeType);
    return { ok: true, ticket };
  } catch (error) {
    return { ok: false, error: messageOf(error) };
  }
}

export type AttachResult = { ok: true } | { ok: false; error: string };

/** 다 올린 사진을 알림장에 붙인다. */
export async function attachPhotoAction(
  journalId: string,
  storagePath: string,
  thumbnailPath: string | null,
): Promise<AttachResult> {
  const user = await requireUser();

  try {
    await attachPhoto(user.id, journalId, storagePath, thumbnailPath);
  } catch (error) {
    return { ok: false, error: messageOf(error) };
  }

  revalidatePath(`/trainer/journals/${journalId}`);
  revalidatePath(`/journal/${journalId}`);
  return { ok: true };
}

export async function removePhotoAction(formData: FormData) {
  const user = await requireUser();

  const journalId = String(formData.get("journalId") ?? "");
  const photoId = String(formData.get("photoId") ?? "");

  await removePhoto(user.id, journalId, photoId);

  revalidatePath(`/trainer/journals/${journalId}`);
  revalidatePath(`/journal/${journalId}`);
}
