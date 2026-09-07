"use client";

import { useActionState } from "react";

import { postComment, type CommentState } from "../actions";

/**
 * 댓글 입력.
 *
 * 보내고 나면 입력칸을 비운다. 서버가 다시 그려 준 목록에 방금 쓴 글이 있는데
 * 입력칸에도 그대로 남아 있으면 안 보내진 줄 알고 또 누른다. 성공할 때마다
 * 바뀌는 token 을 key 로 걸어 입력칸을 새로 만드는 방식이다.
 *
 * 서버 액션을 화살표 함수로 감싸 폼을 초기화하면 더 간단하지만, 그러면 서버 액션
 * 참조가 아니게 되어 자바스크립트 없이는 폼이 동작하지 않는다.
 */
export function CommentForm({ journalId }: { journalId: string }) {
  const [state, formAction, pending] = useActionState<
    CommentState | undefined,
    FormData
  >(postComment, undefined);

  return (
    <form action={formAction} className="mt-3 flex flex-col gap-2">
      <input type="hidden" name="journalId" value={journalId} />

      <div className="flex gap-2">
        <input
          key={state?.token ?? "empty"}
          name="content"
          maxLength={1000}
          placeholder="궁금한 점을 남겨보세요"
          aria-label="댓글 내용"
          className="h-12 min-w-0 flex-1 rounded-xl border border-border bg-background px-4"
        />
        <button
          type="submit"
          disabled={pending}
          className="h-12 shrink-0 rounded-xl bg-primary px-5 font-bold text-primary-foreground disabled:opacity-50"
        >
          {pending ? "..." : "등록"}
        </button>
      </div>

      {state?.error ? (
        <p className="text-sm font-medium text-destructive">{state.error}</p>
      ) : null}
    </form>
  );
}
