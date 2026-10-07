"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireUser } from "@/app/lib/dal";
import {
  markAllNotificationsRead,
  markNotificationRead,
} from "@/server/notifications/notification.service";

export async function openNotificationAction(formData: FormData) {
  const user = await requireUser();
  const notificationId = String(formData.get("notificationId") ?? "").trim();

  if (!notificationId) {
    redirect("/notifications");
  }

  const href = await markNotificationRead(user.id, notificationId);

  revalidatePath("/notifications");
  revalidatePath("/home");

  redirect(href);
}

export async function markAllNotificationsReadAction() {
  const user = await requireUser();

  await markAllNotificationsRead(user.id);

  revalidatePath("/notifications");
  revalidatePath("/home");
}
