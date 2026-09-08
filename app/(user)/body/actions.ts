"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireUser } from "@/app/lib/dal";
import {
  BodyError,
  cancelGoal,
  deleteBodyRecord,
  parseGoalType,
  saveBodyRecord,
  setGoal,
} from "@/server/body/body.service";

function fail(error: unknown) {
  if (error instanceof BodyError) return error.code.toLowerCase();

  console.error("body action error:", error);
  return "unknown";
}

function refresh() {
  revalidatePath("/body");
  revalidatePath("/home");
}

export async function saveBodyRecordAction(formData: FormData) {
  const user = await requireUser();

  try {
    await saveBodyRecord(user.id, {
      dateKey: String(formData.get("dateKey") ?? ""),
      weightKg: formData.get("weightKg"),
      bodyFatPercent: formData.get("bodyFatPercent"),
      skeletalMuscleKg: formData.get("skeletalMuscleKg"),
      waistCm: formData.get("waistCm"),
      memo: formData.get("memo"),
    });
  } catch (error) {
    redirect(`/body/new?error=${fail(error)}`);
  }

  refresh();
  redirect("/body");
}

export async function deleteBodyRecordAction(formData: FormData) {
  const user = await requireUser();

  try {
    await deleteBodyRecord(user.id, String(formData.get("recordId") ?? ""));
  } catch (error) {
    redirect(`/body?error=${fail(error)}`);
  }

  refresh();
  redirect("/body");
}

export async function setGoalAction(formData: FormData) {
  const user = await requireUser();

  const type = parseGoalType(formData.get("type"));
  if (!type) redirect("/body/goal?error=invalid");

  const targetDate = String(formData.get("targetDate") ?? "").trim();

  try {
    await setGoal(user.id, {
      type,
      targetValue: formData.get("targetValue"),
      targetDate: targetDate || null,
    });
  } catch (error) {
    redirect(`/body/goal?error=${fail(error)}&type=${type}`);
  }

  refresh();
  redirect("/body");
}

export async function cancelGoalAction(formData: FormData) {
  const user = await requireUser();

  try {
    await cancelGoal(user.id, String(formData.get("goalId") ?? ""));
  } catch (error) {
    redirect(`/body?error=${fail(error)}`);
  }

  refresh();
  redirect("/body");
}
