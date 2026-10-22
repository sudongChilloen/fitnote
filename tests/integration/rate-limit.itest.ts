import { describe, expect, it } from "vitest";

import { prisma } from "@/lib/prisma";
import {
  attemptKey,
  clearAttempts,
  isRateLimited,
  recordAttempt,
} from "@/app/lib/rate-limit";

import { uniq } from "./helpers";

const limit = { limit: 3, windowMs: 60_000 };

describe("시도 횟수 제한 (실제 DB)", () => {
  it("한도까지는 허용하고 넘으면 막는다", async () => {
    const key = attemptKey("login", `ip-${uniq()}`, "a@test.com");

    for (let i = 0; i < 3; i += 1) {
      expect(await isRateLimited(key, limit)).toBe(false);
      await recordAttempt(key);
    }

    expect(await isRateLimited(key, limit)).toBe(true);
  });

  it("다른 키는 영향을 받지 않는다", async () => {
    const blocked = attemptKey("login", `ip-${uniq()}`, "a@test.com");
    const other = attemptKey("login", `ip-${uniq()}`, "a@test.com");

    for (let i = 0; i < 3; i += 1) await recordAttempt(blocked);

    expect(await isRateLimited(blocked, limit)).toBe(true);
    expect(await isRateLimited(other, limit)).toBe(false);
  });

  it("창 밖의 오래된 기록은 세지 않는다", async () => {
    const key = attemptKey("login", `ip-${uniq()}`);

    await prisma.authAttempt.createMany({
      data: Array.from({ length: 5 }, () => ({
        key,
        createdAt: new Date(Date.now() - 120_000),
      })),
    });

    expect(await isRateLimited(key, limit)).toBe(false);
  });

  it("성공하면 기록을 비운다", async () => {
    const key = attemptKey("login", `ip-${uniq()}`, "a@test.com");

    for (let i = 0; i < 3; i += 1) await recordAttempt(key);
    await clearAttempts(key);

    expect(await isRateLimited(key, limit)).toBe(false);
  });
});
