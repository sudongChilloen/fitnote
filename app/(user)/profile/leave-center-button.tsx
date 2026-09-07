"use client";

import { useActionState } from "react";

import { leaveMyCenter, type CenterActionState } from "./actions";

/**
 * 센터 나가기.
 *
 * 되돌리기 어려운 동작이라 한 번 더 묻는다. 담당 연결과 뿌려 둔 코드가
 * 함께 끊기기 때문이다.
 */
export function LeaveCenterButton({ centerName }: { centerName: string }) {
  const [state, formAction, pending] = useActionState<
    CenterActionState | undefined,
    FormData
  >(leaveMyCenter, undefined);

  return (
    <form
      action={formAction}
      onSubmit={(event) => {
        if (!window.confirm(`${centerName}에서 나갈까요?`)) {
          event.preventDefault();
        }
      }}
    >
      <button
        type="submit"
        disabled={pending}
        className="text-xs font-medium text-muted-foreground underline-offset-4 hover:underline disabled:opacity-50"
      >
        {pending ? "나가는 중" : "센터 나가기"}
      </button>
      {state?.error ? (
        <p className="mt-1 text-xs text-destructive">{state.error}</p>
      ) : null}
    </form>
  );
}
