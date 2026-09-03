"use client";

import { useActionState } from "react";

import Link from "next/link";

import { login } from "@/app/actions/auth";

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(login, undefined);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center px-6">
      <h1 className="mb-8 text-2xl font-bold">로그인</h1>

      <form action={formAction} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="email" className="text-sm font-medium">
            이메일
          </label>
          <input
            id="email"
            name="email"
            type="email"
            placeholder="fitnote@example.com"
            className="rounded-md border px-3 py-2"
          />
          {state?.errors?.email && (
            <p className="text-sm text-red-500">{state.errors.email[0]}</p>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="password" className="text-sm font-medium">
            비밀번호
          </label>
          <input
            id="password"
            name="password"
            type="password"
            className="rounded-md border px-3 py-2"
          />
          {state?.errors?.password && (
            <p className="text-sm text-red-500">{state.errors.password[0]}</p>
          )}
        </div>

        {state?.message && (
          <p className="text-sm text-red-500">{state.message}</p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="mt-2 rounded-md bg-black py-2.5 font-medium text-white disabled:opacity-50"
        >
          {pending ? "로그인 중..." : "로그인"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-gray-500">
        아직 계정이 없으신가요?{" "}
        <Link href="/signup" className="font-medium text-black underline">
          회원가입
        </Link>
      </p>
    </main>
  );
}
