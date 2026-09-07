"use client";

import { useActionState } from "react";

import { joinCenter, type CenterActionState } from "./actions";

/**
 * 초대 코드 입력.
 *
 * 소속이 없으면 센터 가입, 이미 있으면 담당 트레이너 변경에 쓰인다.
 * 서버가 두 경우를 알아서 가르므로 화면은 하나면 된다.
 */
export function JoinCenterForm({ hasCenter }: { hasCenter: boolean }) {
  const [state, formAction, pending] = useActionState<
    CenterActionState | undefined,
    FormData
  >(joinCenter, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <div className="flex gap-2">
        <input
          name="code"
          // 코드에 소문자가 없으므로 자동 대문자로 둔다. 손으로 옮겨 적는
          // 물건이라 자동 수정과 맞춤법 검사가 끼면 오히려 방해가 된다.
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          maxLength={12}
          placeholder="ABCD2345"
          aria-label="초대 코드"
          className="h-12 min-w-0 flex-1 rounded-xl border border-border bg-background px-4 font-mono text-base tracking-widest uppercase placeholder:tracking-normal placeholder:normal-case"
        />
        <button
          type="submit"
          disabled={pending}
          className="h-12 shrink-0 rounded-xl bg-primary px-5 font-bold text-primary-foreground disabled:opacity-50"
        >
          {pending ? "확인 중" : hasCenter ? "연결" : "가입"}
        </button>
      </div>

      {state?.error ? (
        <p className="text-sm font-medium text-destructive">{state.error}</p>
      ) : null}
      {state?.notice ? (
        <p className="text-sm font-medium text-brand-strong">{state.notice}</p>
      ) : null}
    </form>
  );
}
