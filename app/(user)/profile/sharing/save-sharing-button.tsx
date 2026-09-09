"use client";

import { useFormStatus } from "react-dom";

/**
 * 저장 버튼만 클라이언트로 뺀다.
 *
 * 폼 자체는 서버 컴포넌트가 서버 액션을 그대로 물고 그리므로 자바스크립트가
 * 없어도 동작한다. 여기서 하는 일은 누른 뒤 두 번 눌리지 않게 막는 것뿐이다.
 */
export function SaveSharingButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="mt-4 h-13 w-full rounded-xl bg-primary text-sm font-bold text-primary-foreground disabled:opacity-60"
    >
      {pending ? "저장 중..." : "저장"}
    </button>
  );
}
