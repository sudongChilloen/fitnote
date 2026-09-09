"use client";

import { useActionState } from "react";

import { UserPlus } from "lucide-react";

import { becomeTrainer, type CenterActionState } from "./actions";

export function BecomeTrainerButton() {
  const [state, formAction, pending] = useActionState<
    CenterActionState | undefined
  >(becomeTrainer, undefined);

  return (
    <form action={formAction}>
      <button
        type="submit"
        disabled={pending}
        className="inline-flex h-11 items-center gap-1.5 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground disabled:opacity-50"
      >
        <UserPlus className="size-4" aria-hidden />
        {pending ? "시작하는 중" : "트레이너로 시작하기"}
      </button>
      {state?.error ? (
        <p className="mt-1 text-xs text-destructive">{state.error}</p>
      ) : null}
    </form>
  );
}
