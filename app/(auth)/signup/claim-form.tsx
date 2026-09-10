"use client";

import { useActionState } from "react";

import Link from "next/link";

import { claimAccount } from "@/app/actions/auth";

/**
 * 트레이너가 만들어 둔 계정을 이어받는 화면.
 *
 * 맨 위에 누구의 계정을 가져가는지 먼저 적는다. 이 확인 없이 비밀번호부터
 * 정하게 하면, 잘못 전달된 링크로 남의 기록을 가져가고도 아무도 모른다.
 *
 * 이름 칸이 없다. 이름은 트레이너가 이미 적어 뒀고 그 이름으로 수업과
 * 알림장이 쌓여 있다. 여기서 다시 물으면 트레이너의 목록에서 사람이 바뀐
 * 것처럼 보인다.
 */
export function ClaimForm({
  code,
  memberName,
  trainerName,
}: {
  code: string;
  memberName: string;
  trainerName: string;
}) {
  const [state, formAction, pending] = useActionState(claimAccount, undefined);

  return (
    <>
      <h1 className="mb-2 text-2xl font-bold">{memberName}님, 반가워요</h1>
      <p className="mb-8 text-sm text-gray-500">
        <b className="font-bold text-black">{trainerName}</b> 트레이너가 먼저
        만들어 둔 계정이에요. 이메일과 비밀번호만 정하면 그동안 쌓인 PT 기록과
        알림장을 바로 볼 수 있어요.
      </p>

      <form action={formAction} className="flex flex-col gap-4">
        <input type="hidden" name="code" value={code} />

        <div className="flex flex-col gap-1">
          <label htmlFor="email" className="text-sm font-medium">
            이메일
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
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
            autoComplete="new-password"
            className="rounded-md border px-3 py-2"
          />
          {state?.errors?.password && (
            <ul className="text-sm text-red-500">
              {state.errors.password.map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
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
          {pending ? "시작하는 중..." : "시작하기"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-gray-500">
        내가 아닌가요?{" "}
        <Link href="/signup" className="font-medium text-black underline">
          새로 가입하기
        </Link>
      </p>
    </>
  );
}
