import { beforeEach, describe, expect, it, vi } from "vitest";

const count = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: { authAttempt: { count, create: vi.fn(), deleteMany: vi.fn() } },
}));
vi.mock("next/headers", () => ({ headers: vi.fn() }));

const { AUTH_LIMITS, attemptKey, isRateLimited } = await import(
  "@/app/lib/rate-limit"
);

describe("attemptKey", () => {
  it("이메일은 해시로만 남기고 원문을 넣지 않는다", () => {
    const key = attemptKey("login", "1.2.3.4", "kim@example.com");

    expect(key).not.toContain("kim");
    expect(key).toMatch(/^login:acct:1\.2\.3\.4:[0-9a-f]{32}$/);
  });

  it("같은 입력은 같은 키, 다른 이메일·IP 는 다른 키", () => {
    const a = attemptKey("login", "1.1.1.1", "a@x.com");

    expect(attemptKey("login", "1.1.1.1", "a@x.com")).toBe(a);
    expect(attemptKey("login", "1.1.1.1", "b@x.com")).not.toBe(a);
    expect(attemptKey("login", "2.2.2.2", "a@x.com")).not.toBe(a);
  });

  it("이메일이 없으면 IP 단위 키", () => {
    expect(attemptKey("signup", "9.9.9.9")).toBe("signup:ip:9.9.9.9");
  });
});

describe("isRateLimited", () => {
  beforeEach(() => count.mockReset());

  it("한도 미만이면 막지 않고, 한도에 닿으면 막는다", async () => {
    const { limit } = AUTH_LIMITS.loginAccount;

    count.mockResolvedValueOnce(limit - 1);
    expect(await isRateLimited("k", AUTH_LIMITS.loginAccount)).toBe(false);

    count.mockResolvedValueOnce(limit);
    expect(await isRateLimited("k", AUTH_LIMITS.loginAccount)).toBe(true);
  });

  it("창 안의 기록만 센다", async () => {
    count.mockResolvedValueOnce(0);
    const before = Date.now();

    await isRateLimited("k", AUTH_LIMITS.loginAccount);

    const { where } = count.mock.calls[0][0];
    const since = where.createdAt.gt.getTime();

    expect(where.key).toBe("k");
    expect(before - since).toBeGreaterThanOrEqual(
      AUTH_LIMITS.loginAccount.windowMs - 1000,
    );
  });
});
