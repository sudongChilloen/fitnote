"use client";

import { useActionState } from "react";

import { postComment, type CommentState } from "../actions";

interface CommentFormProps {
  journalId: string;
  placeholder?: string;
  submitLabel?: string;
}

export function CommentForm({
  journalId,
  placeholder = "궁금한 점을 남겨보세요",
  submitLabel = "등록",
}: CommentFormProps) {
  const [state, formAction, pending] = useActionState<
    CommentState | undefined,
    FormData
  >(postComment, undefined);

  return (
    <form action={formAction} className="mt-3 flex flex-col gap-2">
      <input type="hidden" name="journalId" value={journalId} />

      <div className="flex h-12 items-center gap-2 rounded-full border border-border pr-1.5 pl-4 focus-within:ring-2 focus-within:ring-ring/40">
        <input
          key={state?.token ?? "empty"}
          name="content"
          maxLength={1000}
          placeholder={placeholder}
          aria-label={placeholder}
          className="h-full min-w-0 flex-1 bg-transparent text-sm outline-none"
        />

        <button
          type="submit"
          disabled={pending}
          className="h-9 shrink-0 rounded-full bg-primary px-3.5 text-[0.8125rem] font-bold text-primary-foreground disabled:opacity-50"
        >
          {pending ? "..." : submitLabel}
        </button>
      </div>

      {state?.error ? (
        <p className="text-sm font-medium text-destructive">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}