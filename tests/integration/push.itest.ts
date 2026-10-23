import { generateKeyPairSync } from "node:crypto";

import { decodeJwt } from "jose";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { prisma } from "@/lib/prisma";
import { resetFcmTokenCache } from "@/lib/fcm";
import { createNotification } from "@/server/notifications/notification.service";
import {
  PushError,
  registerDeviceToken,
  sendPushForNotification,
  unregisterDeviceToken,
} from "@/server/notifications/push.service";

import { makeTrainer, uniq } from "./helpers";

/**
 * FCM 은 실제로 부르지 않는다. fetch 를 가짜로 바꿔 어떤 요청이 나가는지 본다.
 * 서명은 진짜 RSA 키로 한다 — jose 가 키를 못 읽으면 여기서 드러난다.
 */
const { privateKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
  publicKeyEncoding: { type: "spki", format: "pem" },
});

type Sent = { token: string; body: Record<string, unknown>; bearer: string };
let sent: Sent[] = [];
let tokenRequests: { assertion: string }[] = [];
/** 토큰별로 FCM 이 돌려줄 응답. 없으면 성공. */
let responses = new Map<string, { status: number; body?: unknown }>();

const fetchStub = vi.fn(
  async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);

    if (url === "https://oauth2.googleapis.com/token") {
      const params = new URLSearchParams(String(init?.body));
      tokenRequests.push({ assertion: params.get("assertion") ?? "" });
      return Response.json({ access_token: "access-1", expires_in: 3600 });
    }

    const payload = JSON.parse(String(init?.body)) as {
      message: { token: string } & Record<string, unknown>;
    };
    const token = payload.message.token;
    sent.push({
      token,
      body: payload.message,
      bearer: String((init?.headers as Record<string, string>).authorization),
    });

    const planned = responses.get(token);
    return planned
      ? Response.json(planned.body ?? {}, { status: planned.status })
      : Response.json({ name: "projects/p/messages/1" });
  },
);

beforeAll(() => {
  process.env.FCM_PROJECT_ID = "test-project";
  process.env.FCM_CLIENT_EMAIL = "svc@test-project.iam.gserviceaccount.com";
  // .env 에 한 줄로 넣은 모양 그대로 — 개행이 \n 두 글자다.
  process.env.FCM_PRIVATE_KEY = privateKey.replace(/\n/g, "\\n");
  process.env.APP_URL = "https://fitnote.test";
  vi.stubGlobal("fetch", fetchStub);
});

afterAll(() => {
  vi.unstubAllGlobals();
  for (const key of [
    "FCM_PROJECT_ID",
    "FCM_CLIENT_EMAIL",
    "FCM_PRIVATE_KEY",
    "APP_URL",
  ]) {
    delete process.env[key];
  }
});

beforeEach(() => {
  sent = [];
  tokenRequests = [];
  responses = new Map();
  fetchStub.mockClear();
  resetFcmTokenCache();
});

/** 회원 계정. 트레이너 프로필이 없으면 회원 경로로 알림이 간다. */
async function makeUser() {
  const user = await prisma.user.create({
    data: {
      name: `회원${uniq()}`,
      email: `push-${uniq()}@test.com`,
      passwordHash: "x",
    },
    select: { id: true },
  });

  return user.id;
}

const tokenOf = () => `tok-${uniq()}-${uniq()}`;

async function notify(userId: string, relatedType = "JOURNAL") {
  const { id } = await prisma.$transaction((tx) =>
    createNotification(tx, {
      userId,
      type: "GENERAL",
      title: "새 알림장이 도착했어요",
      message: "트레이너가 알림장을 남겼어요.",
      relatedType,
      relatedId: "journal-1",
    }),
  );
  return id;
}

describe("기기 토큰 등록", () => {
  it("등록하고, 같은 토큰을 다시 등록해도 한 줄이다", async () => {
    const userId = await makeUser();
    const token = tokenOf();

    await registerDeviceToken(userId, {
      token,
      platform: "WEB",
      deviceName: "  내 노트북 ",
    });
    await registerDeviceToken(userId, { token, platform: "WEB" });

    const rows = await prisma.deviceToken.findMany({ where: { token } });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ userId, platform: "WEB", isActive: true });
  });

  it("빈 토큰, 너무 긴 토큰, 모르는 기기 종류는 거절한다", async () => {
    const userId = await makeUser();

    for (const input of [
      { token: "", platform: "WEB" },
      { token: "   ", platform: "WEB" },
      { token: "x".repeat(4097), platform: "WEB" },
      { token: tokenOf(), platform: "DESKTOP" },
      { token: tokenOf(), platform: undefined },
      { token: 123, platform: "WEB" },
    ]) {
      await expect(registerDeviceToken(userId, input)).rejects.toBeInstanceOf(
        PushError,
      );
    }
  });

  it("다른 계정으로 로그인한 같은 기기는 새 사용자 것이 되어 이전 사용자 알림을 받지 않는다", async () => {
    const first = await makeUser();
    const second = await makeUser();
    const token = tokenOf();

    await registerDeviceToken(first, { token, platform: "WEB" });
    await registerDeviceToken(second, { token, platform: "WEB" });

    expect(await prisma.deviceToken.count({ where: { token } })).toBe(1);

    await sendPushForNotification(await notify(first));
    expect(sent).toHaveLength(0);

    await sendPushForNotification(await notify(second));
    expect(sent.map((s) => s.token)).toEqual([token]);
  });

  it("해제는 내 토큰만 끄고, 다시 등록하면 켜진다", async () => {
    const owner = await makeUser();
    const other = await makeUser();
    const token = tokenOf();
    await registerDeviceToken(owner, { token, platform: "ANDROID" });

    expect(await unregisterDeviceToken(other, token)).toBe(0);
    expect(
      (await prisma.deviceToken.findUniqueOrThrow({ where: { token } }))
        .isActive,
    ).toBe(true);

    expect(await unregisterDeviceToken(owner, token)).toBe(1);
    expect(
      (await prisma.deviceToken.findUniqueOrThrow({ where: { token } }))
        .isActive,
    ).toBe(false);

    await registerDeviceToken(owner, { token, platform: "ANDROID" });
    expect(
      (await prisma.deviceToken.findUniqueOrThrow({ where: { token } }))
        .isActive,
    ).toBe(true);
  });
});

describe("푸시 발송", () => {
  it("트레이너에게는 트레이너 화면 경로를 싣는다", async () => {
    const trainer = await makeTrainer();
    await registerDeviceToken(trainer.userId, { token: tokenOf(), platform: "WEB" });

    const id = await notify(trainer.userId, "JOURNAL_COMMENT");
    await sendPushForNotification(id);

    const message = sent[0].body as { data: Record<string, string> };
    expect(message.data.href).toBe("/trainer/journals/journal-1");
  });

  it("켜 둔 기기마다 보내고, 제목·내용·이동 경로를 싣는다", async () => {
    const userId = await makeUser();
    const [a, b] = [tokenOf(), tokenOf()];
    await registerDeviceToken(userId, { token: a, platform: "WEB" });
    await registerDeviceToken(userId, { token: b, platform: "IOS" });

    const id = await notify(userId);
    const summary = await sendPushForNotification(id);

    expect(summary).toEqual({ sent: 2, failed: 0, deactivated: 0 });
    expect(sent.map((s) => s.token).sort()).toEqual([a, b].sort());

    const message = sent[0].body as {
      notification: { title: string; body: string };
      data: Record<string, string>;
      webpush: { fcm_options?: { link: string } };
    };
    expect(message.notification).toEqual({
      title: "새 알림장이 도착했어요",
      body: "트레이너가 알림장을 남겼어요.",
    });
    expect(message.data).toEqual({
      notificationId: id,
      href: "/journal/journal-1",
    });
    expect(message.webpush.fcm_options?.link).toBe(
      "https://fitnote.test/journal/journal-1",
    );
    expect(sent[0].bearer).toBe("Bearer access-1");
  });

  it("서비스 계정 JWT 를 RS256 으로 서명해 인증 서버에 보낸다", async () => {
    const userId = await makeUser();
    await registerDeviceToken(userId, { token: tokenOf(), platform: "WEB" });

    await sendPushForNotification(await notify(userId));

    expect(tokenRequests).toHaveLength(1);
    const claims = decodeJwt(tokenRequests[0].assertion);
    expect(claims).toMatchObject({
      iss: "svc@test-project.iam.gserviceaccount.com",
      aud: "https://oauth2.googleapis.com/token",
      scope: "https://www.googleapis.com/auth/firebase.messaging",
    });
    expect(claims.exp! - claims.iat!).toBe(3600);
  });

  it("인증 토큰은 캐시해서 알림마다 새로 받지 않는다", async () => {
    const userId = await makeUser();
    await registerDeviceToken(userId, { token: tokenOf(), platform: "WEB" });

    await sendPushForNotification(await notify(userId));
    await sendPushForNotification(await notify(userId));

    expect(tokenRequests).toHaveLength(1);
    expect(sent).toHaveLength(2);
  });

  it("끈 기기와 다른 사용자의 기기에는 보내지 않는다", async () => {
    const userId = await makeUser();
    const other = await makeUser();
    const [on, off, theirs] = [tokenOf(), tokenOf(), tokenOf()];
    await registerDeviceToken(userId, { token: on, platform: "WEB" });
    await registerDeviceToken(userId, { token: off, platform: "WEB" });
    await registerDeviceToken(other, { token: theirs, platform: "WEB" });
    await unregisterDeviceToken(userId, off);

    await sendPushForNotification(await notify(userId));

    expect(sent.map((s) => s.token)).toEqual([on]);
  });

  it("지워진 기기(404)는 끄고, 일시적 오류(500)는 그대로 둔다", async () => {
    const userId = await makeUser();
    const [gone, flaky, fine] = [tokenOf(), tokenOf(), tokenOf()];
    for (const token of [gone, flaky, fine]) {
      await registerDeviceToken(userId, { token, platform: "ANDROID" });
    }
    responses.set(gone, {
      status: 404,
      body: { error: { status: "NOT_FOUND" } },
    });
    responses.set(flaky, {
      status: 500,
      body: { error: { status: "INTERNAL" } },
    });

    const summary = await sendPushForNotification(await notify(userId));

    expect(summary).toEqual({ sent: 1, failed: 2, deactivated: 1 });

    const active = async (token: string) =>
      (await prisma.deviceToken.findUniqueOrThrow({ where: { token } }))
        .isActive;
    expect(await active(gone)).toBe(false);
    expect(await active(flaky)).toBe(true);
    expect(await active(fine)).toBe(true);

    expect(
      (await prisma.deviceToken.findUniqueOrThrow({ where: { token: fine } }))
        .lastUsedAt,
    ).not.toBeNull();
    expect(
      (await prisma.deviceToken.findUniqueOrThrow({ where: { token: flaky } }))
        .lastUsedAt,
    ).toBeNull();
  });

  it("400 은 토큰을 가리킬 때만 토큰 탓으로 본다", async () => {
    const userId = await makeUser();
    const [badToken, badMessage] = [tokenOf(), tokenOf()];
    await registerDeviceToken(userId, { token: badToken, platform: "WEB" });
    await registerDeviceToken(userId, { token: badMessage, platform: "WEB" });

    responses.set(badToken, {
      status: 400,
      body: {
        error: {
          status: "INVALID_ARGUMENT",
          details: [
            {
              fieldViolations: [
                {
                  description:
                    "The registration token is not a valid FCM registration token",
                },
              ],
            },
          ],
        },
      },
    });
    responses.set(badMessage, {
      status: 400,
      body: {
        error: { status: "INVALID_ARGUMENT", message: "Invalid JSON payload" },
      },
    });

    await sendPushForNotification(await notify(userId));

    const active = async (token: string) =>
      (await prisma.deviceToken.findUniqueOrThrow({ where: { token } }))
        .isActive;
    expect(await active(badToken)).toBe(false);
    expect(await active(badMessage)).toBe(true);
  });

  it("없는 알림이나 기기가 없는 사용자는 아무 일도 하지 않는다", async () => {
    const userId = await makeUser();

    expect(await sendPushForNotification("does-not-exist")).toEqual({
      sent: 0,
      failed: 0,
      deactivated: 0,
    });
    expect(await sendPushForNotification(await notify(userId))).toEqual({
      sent: 0,
      failed: 0,
      deactivated: 0,
    });
    expect(fetchStub).not.toHaveBeenCalled();
  });

  it("인증 서버가 실패해도 던지지 않고 실패로 센다", async () => {
    const userId = await makeUser();
    await registerDeviceToken(userId, { token: tokenOf(), platform: "WEB" });
    fetchStub.mockImplementationOnce(
      async () => new Response("nope", { status: 401 }),
    );
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});

    const summary = await sendPushForNotification(await notify(userId));

    expect(summary).toMatchObject({ sent: 0, failed: 1 });
    errors.mockRestore();
  });
});

describe("설정이 없을 때", () => {
  it("아무것도 보내지 않고, 알림 생성은 그대로 된다", async () => {
    const saved = { ...process.env };
    delete process.env.FCM_PROJECT_ID;

    try {
      const userId = await makeUser();
      await registerDeviceToken(userId, { token: tokenOf(), platform: "WEB" });

      const id = await notify(userId);

      expect(await prisma.notification.count({ where: { id } })).toBe(1);
      expect(await sendPushForNotification(id)).toEqual({
        sent: 0,
        failed: 0,
        deactivated: 0,
      });
      expect(fetchStub).not.toHaveBeenCalled();
    } finally {
      process.env.FCM_PROJECT_ID = saved.FCM_PROJECT_ID;
    }
  });
});

describe("알림 생성과 푸시 예약", () => {
  it("요청 밖에서 알림을 만들어도 던지지 않는다 (after 는 요청 안에서만 쓸 수 있다)", async () => {
    const userId = await makeUser();
    await registerDeviceToken(userId, { token: tokenOf(), platform: "WEB" });

    await expect(notify(userId)).resolves.toBeTruthy();
    // 요청 밖이라 예약은 건너뛰고, 푸시는 나가지 않는다.
    expect(sent).toHaveLength(0);
  });

  it("트랜잭션이 되돌려지면 알림도 푸시 대상도 남지 않는다", async () => {
    const userId = await makeUser();
    await registerDeviceToken(userId, { token: tokenOf(), platform: "WEB" });
    let createdId = "";

    await expect(
      prisma.$transaction(async (tx) => {
        createdId = (
          await createNotification(tx, {
            userId,
            type: "GENERAL",
            title: "t",
            message: "m",
          })
        ).id;
        throw new Error("rollback");
      }),
    ).rejects.toThrow("rollback");

    expect(await sendPushForNotification(createdId)).toEqual({
      sent: 0,
      failed: 0,
      deactivated: 0,
    });
    expect(sent).toHaveLength(0);
  });
});
