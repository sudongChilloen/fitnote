"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireUser } from "@/app/lib/dal";
import {
  createDiet,
  createDietPhotoUpload,
  deleteDiet,
  DietError,
  discardDietPhoto,
  parseDateKey,
  parseMealType,
} from "@/server/diet/diet.service";
import { StorageError } from "@/lib/storage";

/**
 * 실패를 어디에 보여줄지가 문제다.
 *
 * useActionState 로 상태를 받으면 자바스크립트가 없을 때 아무것도 안 보인다.
 * 그래서 폼을 다시 그리면서 주소에 실패 이유를 싣는다. 값은 정해진 몇 개뿐이라
 * 그대로 화면 문구로 바꾼다 — 서버 메시지를 주소로 나르면 아무 문구나 띄울 수 있다.
 */
export type DietFormError = "empty" | "storage" | "unknown";

export async function createDietRecord(formData: FormData) {
  const user = await requireUser();

  const dateKey = parseDateKey(formData.get("date"));
  const mealType = parseMealType(formData.get("mealType"));

  const back = (error: DietFormError) =>
    `/diet/new?date=${dateKey}&meal=${mealType ?? ""}&error=${error}`;

  if (!mealType) redirect(back("unknown"));

  let created;

  try {
    created = await createDiet(user.id, {
      dateKey,
      mealType,
      foodName: formData.get("foodName"),
      memo: formData.get("memo"),
      imagePath: formData.get("imagePath"),
      thumbnailPath: formData.get("thumbnailPath"),
    });
  } catch (error) {
    if (error instanceof DietError && error.code === "EMPTY") {
      redirect(back("empty"));
    }
    if (error instanceof StorageError) redirect(back("storage"));
    throw error;
  }

  revalidatePath("/diet");
  revalidatePath("/home");
  revalidatePath("/calendar");

  redirect(`/diet/${created.id}`);
}

export async function deleteDietRecord(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");

  const { dateKey } = await deleteDiet(user.id, id);

  revalidatePath("/diet");
  revalidatePath("/home");
  revalidatePath("/calendar");

  redirect(`/diet?date=${dateKey}`);
}

/** 사진 올릴 자리를 만들어 준다. 자바스크립트가 있을 때만 부른다. */
export async function requestDietPhotoUpload(mimeType: string) {
  const user = await requireUser();

  try {
    const ticket = await createDietPhotoUpload(user.id, mimeType);
    return { ok: true as const, ticket };
  } catch (error) {
    if (error instanceof DietError || error instanceof StorageError) {
      return { ok: false as const, error: error.message };
    }
    console.error("diet photo upload error:", error);
    return { ok: false as const, error: "사진을 올리지 못했어요." };
  }
}

/** 등록 전에 사진을 뺐을 때. 안 지우면 아무도 못 보는 파일에 요금이 나간다. */
export async function discardDietPhotoAction(path: string) {
  const user = await requireUser();

  try {
    await discardDietPhoto(user.id, path);
  } catch (error) {
    // 실패해도 사용자가 할 수 있는 일이 없다. 사진은 이미 화면에서 빠졌다.
    console.error("diet photo discard error:", error);
  }
}
