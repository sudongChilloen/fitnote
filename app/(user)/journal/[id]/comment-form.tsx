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

      <div className="flex gap-2">
        <input
          key={state?.token ?? "empty"}
          name="content"
          maxLength={1000}
          placeholder={placeholder}
          aria-label={placeholder}
          className="h-12 min-w-0 flex-1 rounded-xl border border-border bg-background px-4 text-sm outline-none focus:ring-2 focus:ring-ring/40"
        />

        <button
          type="submit"
          disabled={pending}
          className="h-12 shrink-0 rounded-xl bg-primary px-5 font-bold text-primary-foreground disabled:opacity-50"
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