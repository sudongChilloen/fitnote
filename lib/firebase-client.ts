"use client";

import { initializeApp, getApps } from "firebase/app";
import { deleteToken, getMessaging, getToken, isSupported } from "firebase/messaging";

// 이 값들은 브라우저로 나가는 공개 값이다. 비밀키(FCM_PRIVATE_KEY)와 다르다.
const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const VAPID_KEY = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;

const SW_URL = "/firebase-messaging-sw.js";

export function isFirebaseConfigured() {
  return Boolean(
    config.apiKey &&
      config.projectId &&
      config.messagingSenderId &&
      config.appId &&
      VAPID_KEY,
  );
}

export type PushSupport = "supported" | "unsupported" | "unconfigured";

export async function getPushSupport(): Promise<PushSupport> {
  if (!isFirebaseConfigured()) return "unconfigured";

  try {
    return (await isSupported()) ? "supported" : "unsupported";
  } catch {
    return "unsupported";
  }
}

function messaging() {
  const app = getApps()[0] ?? initializeApp(config);
  return getMessaging(app);
}

async function registration() {
  return navigator.serviceWorker.register(SW_URL);
}

/** 권한을 요청하고 FCM 토큰을 받는다. 거부하면 null. */
export async function requestPushToken(): Promise<string | null> {
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return null;

  const sw = await registration();
  await navigator.serviceWorker.ready;

  const token = await getToken(messaging(), {
    vapidKey: VAPID_KEY,
    serviceWorkerRegistration: sw,
  });

  return token || null;
}

export async function dropPushToken(): Promise<void> {
  try {
    await deleteToken(messaging());
  } catch {
    // 이미 없으면 그대로 둔다.
  }
}

/** 이 브라우저에서 이미 받은 토큰이 있으면 돌려준다. 권한이 없으면 null. */
export async function currentPushToken(): Promise<string | null> {
  if (Notification.permission !== "granted") return null;

  try {
    const sw = await registration();
    return (
      (await getToken(messaging(), {
        vapidKey: VAPID_KEY,
        serviceWorkerRegistration: sw,
      })) || null
    );
  } catch {
    return null;
  }
}
