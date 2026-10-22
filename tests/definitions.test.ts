import { describe, expect, it } from "vitest";

import {
  ClaimFormSchema,
  LoginFormSchema,
  SignupFormSchema,
} from "@/app/lib/definitions";

const valid = { name: "김핏노", password: "abcd1234" };

describe("이메일 정규화", () => {
  it("앞뒤 공백과 대소문자를 정리한 뒤 돌려준다", () => {
    const result = SignupFormSchema.parse({
      ...valid,
      email: "  Kim@Example.COM ",
    });

    expect(result.email).toBe("kim@example.com");
  });

  it("가입·이어받기·로그인이 같은 결과를 낸다", () => {
    const raw = "  Kim@Example.COM ";

    const signup = SignupFormSchema.parse({ ...valid, email: raw }).email;
    const claim = ClaimFormSchema.parse({ ...valid, email: raw }).email;
    const login = LoginFormSchema.parse({ password: "x", email: raw }).email;

    expect(new Set([signup, claim, login]).size).toBe(1);
  });

  it("형식이 틀리면 안내 문구를 돌려준다", () => {
    const result = LoginFormSchema.safeParse({ email: "nope", password: "x" });

    expect(result.success).toBe(false);
    expect(result.error?.flatten().fieldErrors.email).toEqual([
      "올바른 이메일 형식이 아닙니다.",
    ]);
  });
});

describe("비밀번호", () => {
  it.each([
    ["짧음", "ab1"],
    ["숫자 없음", "abcdefgh"],
    ["영문 없음", "12345678"],
  ])("%s 은 가입에서 거절한다", (_label, password) => {
    const result = SignupFormSchema.safeParse({
      ...valid,
      email: "a@b.com",
      password,
    });

    expect(result.success).toBe(false);
  });
});
