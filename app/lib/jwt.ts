import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE_NAME = "session";

/** 세션 유효기간: 7일 */
export const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

const secretKey = process.env.SESSION_SECRET;

if (!secretKey) {
  throw new Error("SESSION_SECRET is not defined");
}

const encodedKey = new TextEncoder().encode(secretKey);

export type SessionPayload = {
  userId: string;
  sessionId: string;
};

export async function encrypt(payload: SessionPayload, expiresAt: Date) {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expiresAt)
    .sign(encodedKey);
}

export async function decrypt(
  session: string | undefined,
): Promise<SessionPayload | null> {
  if (!session) return null;

  try {
    const { payload } = await jwtVerify(session, encodedKey, {
      algorithms: ["HS256"],
    });

    if (
      typeof payload.userId !== "string" ||
      typeof payload.sessionId !== "string"
    ) {
      return null;
    }

    return { userId: payload.userId, sessionId: payload.sessionId };
  } catch {
    return null;
  }
}
