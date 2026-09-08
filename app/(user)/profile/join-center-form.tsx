"use client";

import { useActionState } from "react";

import { redeemCode, type CenterActionState } from "./actions";

/**
 * 코드 입력.
 *
 * 트레이너 코드든 센터 코드든 이 한 칸으로 받는다. 어느 쪽인지는 코드가 알고
 * 있어서 서버가 가른다. 회원에게 칸을 두 개 보여 주면 절반은 틀린 칸에 넣는다.
 */
export function JoinCenterForm() {
  const [state, formAction, pending] = useActionState<
    CenterActionState | undefined,
    FormData
  >(redeemCode, undefined);

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
          placeholder="TR-ABCD2345"
          aria-label="초대 코드"
          className="h-12 min-w-0 flex-1 rounded-xl border border-border bg-background px-4 font-mono text-base tracking-widest uppercase placeholder:tracking-normal placeholder:normal-case"
        />
        <button
          type="submit"
          disabled={pending}
          className="h-12 shrink-0 rounded-xl bg-primary px-5 font-bold text-primary-foreground disabled:opacity-50"
        >
          {pending ? "확인 중" : "연결"}
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
