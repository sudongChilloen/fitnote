"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireUser } from "@/app/lib/dal";
import {
  markAllNotificationsRead,
  markNotificationRead,
} from "@/server/notifications/notification.service";
import {
  PreferenceError,
  setPushPreference,
} from "@/server/notifications/notification-preference.service";
import {
  PushError,
  registerDeviceToken,
  unregisterDeviceToken,
} from "@/server/notifications/push.service";

export async function openNotificationAction(formData: FormData) {
  const user = await requireUser();
  const notificationId = String(formData.get("notificationId") ?? "").trim();

  if (!notificationId) {
    redirect("/notifications");
  }

  const href = await markNotificationRead(user.id, notificationId);

  revalidatePath("/notifications");
  revalidatePath("/home");
  revalidatePath("/trainer");
  revalidatePath("/trainer/notifications");

  redirect(href);
}

export async function markAllNotificationsReadAction() {
  const user = await requireUser();

  await markAllNotificationsRead(user.id);

  revalidatePath("/notifications");
  revalidatePath("/home");
  revalidatePath("/trainer");
  revalidatePath("/trainer/notifications");
}

export type PushActionResult = { error: string | null };

/**
 * 이 기기에서 푸시를 받겠다고 등록한다.
 *
 * 토큰은 브라우저(또는 앱)가 FCM 에서 받아 온 값이다. 서버 액션 인자는 누구나 바꿔
 * 보낼 수 있으니 형식은 서비스에서 다시 확인하고, 사용자는 세션에서 읽는다.
 */
export async function registerPushTokenAction(
  token: string,
  platform: string,
  deviceName?: string,
): Promise<PushActionResult> {
  const user = await requireUser();

  try {
    await registerDeviceToken(user.id, { token, platform, deviceName });
  } catch (error) {
    if (error instanceof PushError) return { error: error.message };
    throw error;
  }

  return { error: null };
}

export async function unregisterPushTokenAction(
  token: string,
): Promise<PushActionResult> {
  const user = await requireUser();

  await unregisterDeviceToken(user.id, token);

  return { error: null };
}

export async function setPushPreferenceAction(
  type: string,
  enabled: boolean,
): Promise<PushActionResult> {
  const user = await requireUser();

  try {
    await setPushPreference(user.id, type, enabled);
  } catch (error) {
    if (error instanceof PreferenceError) return { error: error.message };
    throw error;
  }

  return { error: null };
}
