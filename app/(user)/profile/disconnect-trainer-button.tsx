"use client";

import { useActionState, useState } from "react";

import { disconnectTrainer, type CenterActionState } from "./actions";

/**
 * 연결 끊기.
 *
 * 한 번 더 묻는다. 끊으면 트레이너가 내 식단과 개인 운동을 더는 못 보게 되고,
 * 되돌리려면 코드를 다시 받아야 한다. 목록에서 잘못 눌러 벌어질 일이 아니다.
 */
export function DisconnectTrainerButton({
  connectionId,
  trainerName,
}: {
  connectionId: string;
  trainerName: string;
}) {
  const [asking, setAsking] = useState(false);
  const [state, formAction, pending] = useActionState<
    CenterActionState | undefined,
    FormData
  >(disconnectTrainer, undefined);

  if (!asking) {
    return (
      <button
        type="button"
        onClick={() => setAsking(true)}
        className="shrink-0 text-xs font-medium text-muted-foreground underline-offset-4 hover:underline"
      >
        연결 끊기
      </button>
    );
  }

  return (
    <form action={formAction} className="shrink-0 text-right">
      <input type="hidden" name="connectionId" value={connectionId} />
      <p className="text-xs text-muted-foreground">
        {trainerName} 트레이너와 끊을까요?
      </p>
      <div className="mt-1 flex justify-end gap-2">
        <button
          type="button"
          onClick={() => setAsking(false)}
          className="text-xs font-medium text-muted-foreground"
        >
          취소
        </button>
        <button
          type="submit"
          disabled={pending}
          className="text-xs font-bold text-destructive disabled:opacity-50"
        >
          {pending ? "끊는 중" : "끊기"}
        </button>
      </div>
      {state?.error ? (
        <p className="mt-1 text-xs text-destructive">{state.error}</p>
      ) : null}
    </form>
  );
}
