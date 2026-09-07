"use client";

import { useFormStatus } from "react-dom";

/** 두 번 눌려 같은 피드백이 두 줄 달리는 것만 막는다. 폼 자체는 서버가 그린다. */
export function SubmitFeedbackButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="mt-2 h-12 w-full rounded-xl bg-primary text-sm font-bold text-primary-foreground disabled:opacity-60"
    >
      {pending ? "남기는 중..." : "피드백 남기기"}
    </button>
  );
}
