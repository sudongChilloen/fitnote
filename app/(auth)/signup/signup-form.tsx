"use client";

import { BrandMark } from "@/components/layout/brand-mark";
import { useActionState } from "react";

import Link from "next/link";

import { signup } from "@/app/actions/auth";

export function SignupForm() {
  const [state, formAction, pending] = useActionState(signup, undefined);

  return (
    <>
      <BrandMark />
      <h1 className="mb-6 text-2xl font-extrabold tracking-tight">회원가입</h1>

      <form action={formAction} className="flex flex-col gap-4">
        <fieldset className="flex flex-col gap-1">
          <legend className="mx-1 mb-1 text-[0.8125rem] font-bold">가입 유형</legend>
          <div className="grid grid-cols-2 gap-2">
            {[
              { value: "MEMBER", label: "회원", hint: "운동을 기록해요" },
              { value: "TRAINER", label: "트레이너", hint: "회원을 관리해요" },
            ].map((option) => (
              <label key={option.value} className="cursor-pointer">
                <input
                  type="radio"
                  name="role"
                  value={option.value}
                  defaultChecked={option.value === "MEMBER"}
                  className="peer sr-only"
                />
                <span className="flex h-16 flex-col items-center justify-center rounded-2xl border-[1.5px] border-border bg-card text-sm font-bold transition-colors peer-checked:border-primary peer-checked:bg-[#f3faf6] peer-checked:text-primary peer-focus-visible:ring-2 peer-focus-visible:ring-ring">
                  {option.label}
                  <span className="mt-0.5 text-xs font-normal text-muted-foreground">
                    {option.hint}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="flex flex-col gap-1">
          <label htmlFor="name" className="mx-1 text-[0.8125rem] font-bold">
            이름
          </label>
          <input
            id="name"
            name="name"
            placeholder="홍길동"
            className="h-12 rounded-2xl border border-border bg-card px-4 outline-none focus:border-[1.5px] focus:border-primary"
          />
          {state?.errors?.name && (
            <p className="text-sm text-destructive">{state.errors.name[0]}</p>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="email" className="mx-1 text-[0.8125rem] font-bold">
            이메일
          </label>
          <input
            id="email"
            name="email"
            type="email"
            placeholder="fitnote@example.com"
            className="h-12 rounded-2xl border border-border bg-card px-4 outline-none focus:border-[1.5px] focus:border-primary"
          />
          {state?.errors?.email && (
            <p className="text-sm text-destructive">{state.errors.email[0]}</p>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="password" className="mx-1 text-[0.8125rem] font-bold">
            비밀번호
          </label>
          <input
            id="password"
            name="password"
            type="password"
            className="h-12 rounded-2xl border border-border bg-card px-4 outline-none focus:border-[1.5px] focus:border-primary"
          />
          {state?.errors?.password && (
            <ul className="text-sm text-destructive">
              {state.errors.password.map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          )}
        </div>

        {state?.message && (
          <p className="text-sm text-destructive">{state.message}</p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="mt-2 h-13 rounded-full bg-primary text-[0.9375rem] font-extrabold text-primary-foreground disabled:opacity-50"
        >
          {pending ? "가입 중..." : "가입하기"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        이미 계정이 있으신가요?{" "}
        <Link href="/login" className="font-bold text-primary underline underline-offset-4">
          로그인
        </Link>
      </p>
    </>
  );
}
