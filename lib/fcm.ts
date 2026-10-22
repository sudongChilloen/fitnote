import "server-only";

import { importPKCS8, SignJWT } from "jose";

/**
 * Firebase Cloud Messaging (HTTP v1).
 *
 * firebase-admin 을 넣지 않고 REST 로 직접 부른다. 하는 일이 "서비스 계정으로 토큰을
 * 받아 메시지 하나 보내기" 뿐이라 SDK 를 서버 번들에 들일 이유가 없다. 이미 있는
 * jose 로 서명한다.
 *
 * 환경변수가 없으면 아무것도 보내지 않는다. 푸시는 앱 안 알림을 *보완*하는 것이라,
 * 설정이 없다고 알림 자체가 막히면 안 된다.
 */

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SCOPE = "https://www.googleapis.com/auth/firebase.messaging";

type Credentials = {
  projectId: string;
  clientEmail: string;
  privateKey: string;
};

/** 환경변수는 호출할 때 읽는다. 모듈 로드 시점에 읽으면 설정이 없는 빌드가 깨진다. */
function credentials(): Credentials | null {
  const projectId = process.env.FCM_PROJECT_ID;
  const clientEmail = process.env.FCM_CLIENT_EMAIL;
  // .env 에 한 줄로 넣으면 개행이 `\n` 두 글자로 들어온다.
  const privateKey = process.env.FCM_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) return null;

  return { projectId, clientEmail, privateKey };
}

export function isPushConfigured() {
  return credentials() !== null;
}

let cached: { token: string; expiresAt: number } | null = null;

/** 테스트에서 토큰 캐시를 비운다. */
export function resetFcmTokenCache() {
  cached = null;
}

async function accessToken(creds: Credentials) {
  // 만료 1분 전부터는 새로 받는다.
  if (cached && cached.expiresAt - 60_000 > Date.now()) return cached.token;

  const now = Math.floor(Date.now() / 1000);
  const key = await importPKCS8(creds.privateKey, "RS256");

  const assertion = await new SignJWT({ scope: SCOPE })
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setIssuer(creds.clientEmail)
    .setSubject(creds.clientEmail)
    .setAudience(TOKEN_URL)
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(key);

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`FCM 인증에 실패했어요 (${res.status})`);
  }

  const json = (await res.json()) as {
    access_token?: string;
    expires_in?: number;
  };

  if (!json.access_token) throw new Error("FCM 인증 응답에 토큰이 없어요");

  cached = {
    token: json.access_token,
    expiresAt: Date.now() + (json.expires_in ?? 3600) * 1000,
  };

  return cached.token;
}

export type PushMessage = {
  token: string;
  title: string;
  body: string;
  /** 눌렀을 때 열 앱 안 경로. `/journal/abc` 처럼 상대 경로. */
  href?: string | null;
  data?: Record<string, string>;
};

export type PushResult =
  | { ok: true }
  /** invalidToken 이면 그 기기는 더 이상 받을 수 없다. 지워야 한다. */
  | { ok: false; invalidToken: boolean; status: number; error: string };

/**
 * 만료·해지된 토큰인가.
 *
 * FCM 은 지워진 토큰에 404 UNREGISTERED 를, 형식이 틀린 토큰에 400 INVALID_ARGUMENT 를
 * 돌려준다. 그 외(401, 429, 5xx)는 토큰 잘못이 아니라 일시적 문제이므로 지우면 안 된다.
 */
function isInvalidToken(status: number, body: unknown) {
  if (status === 404) return true;
  if (status !== 400) return false;

  const error = (body as { error?: { status?: string; details?: unknown[] } })
    ?.error;

  if (error?.status !== "INVALID_ARGUMENT") return false;

  // 400 은 메시지 모양 문제일 수도 있다. 토큰을 가리킬 때만 토큰 탓으로 본다.
  return JSON.stringify(error.details ?? []).includes("registration token");
}

/** 절대 던지지 않는다. 푸시 실패가 알림 흐름을 깨면 안 된다. */
export async function sendPush(message: PushMessage): Promise<PushResult> {
  const creds = credentials();

  if (!creds) {
    return {
      ok: false,
      invalidToken: false,
      status: 0,
      error: "NOT_CONFIGURED",
    };
  }

  try {
    const bearer = await accessToken(creds);
    const appUrl = process.env.APP_URL?.replace(/\/$/, "");

    const res = await fetch(
      `https://fcm.googleapis.com/v1/projects/${creds.projectId}/messages:send`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${bearer}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          message: {
            token: message.token,
            notification: { title: message.title, body: message.body },
            // 서비스 워커가 눌렀을 때 열 곳을 알 수 있게 상대 경로도 데이터로 보낸다.
            data: {
              ...(message.data ?? {}),
              ...(message.href ? { href: message.href } : {}),
            },
            webpush: {
              // fcm_options.link 는 https 절대 주소만 받는다.
              ...(appUrl && message.href
                ? { fcm_options: { link: `${appUrl}${message.href}` } }
                : {}),
            },
          },
        }),
        cache: "no-store",
      },
    );

    if (res.ok) return { ok: true };

    const body = await res.json().catch(() => null);

    return {
      ok: false,
      invalidToken: isInvalidToken(res.status, body),
      status: res.status,
      error: JSON.stringify(body)?.slice(0, 300) ?? "",
    };
  } catch (error) {
    return {
      ok: false,
      invalidToken: false,
      status: 0,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
