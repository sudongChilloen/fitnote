"use client";

import { Loader2 } from "lucide-react";
import { useState, useTransition } from "react";

import { acknowledgeSessionAction } from "./actions";

/**
 * "확인했어요".
 *
 * 취소된 수업이 목록에서 조용히 사라지지 않게 붙잡아 두는 대신, 회원이
 * 직접 내리게 한다. 본 사람만 내릴 수 있으니 못 보고 지나갈 일이 없다.
 */
export function AcknowledgeButton({ sessionId }: { sessionId: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <span className="flex flex-col items-end">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const result = await acknowledgeSessionAction(sessionId);
            if (result.error) setError(result.error);
          });
        }}
        className="flex shrink-0 items-center gap-1 rounded-full border border-border px-2.5 py-1 text-xs font-semibold text-muted-foreground"
      >
        {pending ? <Loader2 className="size-3 animate-spin" /> : null}
        확인
      </button>

      {error ? (
        <span className="mt-1 text-[0.6875rem] text-destructive">{error}</span>
      ) : null}
    </span>
  );
}
