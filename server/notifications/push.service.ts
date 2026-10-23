import "server-only";

import { after } from "next/server";

import { DevicePlatform } from "@/generated/prisma/enums";
import { isPushConfigured, sendPush } from "@/lib/fcm";
import { prisma } from "@/lib/prisma";

import { isPushEnabledFor } from "./notification-preference.service";
import { getNotificationAudience } from "./notification-audience";
import { getNotificationHref } from "./notification-href";

/**
 * 푸시 알림.
 *
 * 앱 안 알림(Notification)이 원본이고 푸시는 그 사본을 기기로 한 번 더 보내는 것이다.
 * 푸시가 실패해도 알림은 남아 있어서 앱을 열면 보인다.
 */

export class PushError extends Error {
  constructor(
    readonly code: "INVALID",
    message: string,
  ) {
    super(message);
    this.name = "PushError";
  }
}

const MAX_TOKEN_LENGTH = 4096;
const MAX_DEVICE_NAME = 100;

const PLATFORMS = new Set<string>(Object.values(DevicePlatform));

/**
 * 이 기기의 토큰을 이 사용자 것으로 등록한다.
 *
 * 토큰은 기기 하나를 가리키므로 유일하다. 같은 기기에서 다른 계정으로 로그인하면
 * 토큰이 이미 있는데, 그대로 두면 이전 사용자의 알림이 새 사용자의 기기로 간다.
 * 그래서 이미 있는 토큰은 지금 로그인한 사용자 쪽으로 옮긴다.
 */
export async function registerDeviceToken(
  userId: string,
  input: { token: unknown; platform: unknown; deviceName?: unknown },
) {
  const token = typeof input.token === "string" ? input.token.trim() : "";

  if (token.length === 0 || token.length > MAX_TOKEN_LENGTH) {
    throw new PushError("INVALID", "기기 토큰이 올바르지 않아요.");
  }

  if (typeof input.platform !== "string" || !PLATFORMS.has(input.platform)) {
    throw new PushError("INVALID", "기기 종류가 올바르지 않아요.");
  }

  const platform = input.platform as DevicePlatform;
  const deviceName =
    typeof input.deviceName === "string" && input.deviceName.trim()
      ? input.deviceName.trim().slice(0, MAX_DEVICE_NAME)
      : null;

  return prisma.deviceToken.upsert({
    where: { token },
    create: { userId, token, platform, deviceName },
    update: { userId, platform, deviceName, isActive: true },
    select: { id: true },
  });
}

/** 내 토큰만 끈다. 남의 토큰은 건드리지 않는다. */
export async function unregisterDeviceToken(userId: string, token: unknown) {
  if (typeof token !== "string" || token.length === 0) return 0;

  const result = await prisma.deviceToken.updateMany({
    where: { userId, token, isActive: true },
    data: { isActive: false },
  });

  return result.count;
}

/**
 * 알림 하나를 그 사용자의 기기들로 보낸다.
 *
 * 절대 던지지 않는다. 설정이 없으면 조용히 아무것도 안 한다.
 */
export async function sendPushForNotification(notificationId: string) {
  const summary = { sent: 0, failed: 0, deactivated: 0 };

  try {
    if (!isPushConfigured()) return summary;

    const notification = await prisma.notification.findUnique({
      where: { id: notificationId },
      select: {
        id: true,
        userId: true,
        type: true,
        title: true,
        message: true,
        relatedType: true,
        relatedId: true,
      },
    });

    if (!notification) return summary;

    // 앱 안 알림은 이미 쌓였다. 푸시만 이 종류를 껐는지 본다.
    if (!(await isPushEnabledFor(notification.userId, notification.type))) {
      return summary;
    }

    const devices = await prisma.deviceToken.findMany({
      where: { userId: notification.userId, isActive: true },
      select: { id: true, token: true },
    });

    if (devices.length === 0) return summary;

    const href = getNotificationHref(
      notification,
      await getNotificationAudience(notification.userId),
    );

    const results = await Promise.all(
      devices.map(async (device) => ({
        device,
        result: await sendPush({
          token: device.token,
          title: notification.title,
          body: notification.message,
          href,
          data: { notificationId: notification.id },
        }),
      })),
    );

    const dead = results
      .filter(({ result }) => !result.ok && result.invalidToken)
      .map(({ device }) => device.id);
    const delivered = results
      .filter(({ result }) => result.ok)
      .map(({ device }) => device.id);

    // 지워진 기기는 끈다. 계속 시도하면 매번 실패하고 요청만 늘어난다.
    if (dead.length > 0) {
      await prisma.deviceToken.updateMany({
        where: { id: { in: dead } },
        data: { isActive: false },
      });
    }

    if (delivered.length > 0) {
      await prisma.deviceToken.updateMany({
        where: { id: { in: delivered } },
        data: { lastUsedAt: new Date() },
      });
    }

    summary.sent = delivered.length;
    summary.deactivated = dead.length;
    summary.failed = results.length - delivered.length;

    for (const { result } of results) {
      if (!result.ok && !result.invalidToken) {
        console.error(
          `push 실패 (${notification.id}): ${result.status} ${result.error}`,
        );
      }
    }
  } catch (error) {
    console.error("push 처리 중 오류:", error);
  }

  return summary;
}

/**
 * 응답이 끝난 뒤에 푸시를 보내도록 예약한다.
 *
 * after() 는 요청 안에서만 쓸 수 있다. 시드 스크립트나 테스트처럼 요청 밖에서
 * 알림이 만들어지면 던지는데, 푸시는 부가 기능이라 그때는 건너뛴다.
 */
export function queuePush(notificationId: string) {
  if (!isPushConfigured()) return;

  try {
    after(() => sendPushForNotification(notificationId));
  } catch {
    // 요청 밖. 푸시 없이 앱 안 알림만 남는다.
  }
}
