"use client";

import { useActionState } from "react";

import { redeemCode, type CenterActionState } from "./actions";

/**
 * 코드 입력.
 *
 * 트레이너에게 받은 연결 코드를 넣는 칸.
 */
export function TrainerCodeForm() {
  const [state, formAction, pending] = useActionState<
    CenterActionState | undefined,
    FormData
  >(redeemCode, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <div className="flex gap-1.5">
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
          className="h-11.5 min-w-0 flex-1 rounded-full border border-border bg-card px-4 font-mono text-sm tracking-widest uppercase placeholder:tracking-normal placeholder:normal-case"
        />
        <button
          type="submit"
          disabled={pending}
          className="h-11.5 shrink-0 rounded-full bg-ink px-4.5 text-sm font-bold text-white disabled:opacity-50"
        >
          {pending ? "확인 중" : "연결"}
        </button>
      </div>

      {state?.error ? (
        <p className="text-sm font-medium text-destructive">{state.error}</p>
      ) : null}
      {state?.notice ? (
        <p className="text-sm font-medium text-primary">{state.notice}</p>
      ) : null}
    </form>
  );
}
