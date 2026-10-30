"use client";

import { BrandMark } from "@/components/layout/brand-mark";
import { useActionState } from "react";

import Link from "next/link";

import { login } from "@/app/actions/auth";

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(login, undefined);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center px-6">
      <BrandMark />
      <h1 className="mb-6 text-2xl font-extrabold tracking-tight">로그인</h1>

      <form action={formAction} className="flex flex-col gap-4">
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
            <p className="text-sm text-destructive">{state.errors.password[0]}</p>
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
          {pending ? "로그인 중..." : "로그인"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        아직 계정이 없으신가요?{" "}
        <Link href="/signup" className="font-bold text-primary underline underline-offset-4">
          회원가입
        </Link>
      </p>
    </main>
  );
}
