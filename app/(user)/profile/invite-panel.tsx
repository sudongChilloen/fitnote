"use client";

import { useActionState, useState } from "react";

import { formatKstDateLabel } from "@/lib/date";

import {
  issueTrainerCode,
  revokeCode,
  type CenterActionState,
} from "./actions";

type Invitation = {
  id: string;
  code: string;
  maxUses: number;
  usedCount: number;
  expiresAt: Date;
};

function IssueButton({ subtle = false }: { subtle?: boolean }) {
  const [state, formAction, pending] = useActionState<
    CenterActionState | undefined
  >(issueTrainerCode, undefined);

  return (
    <form action={formAction}>
      <button
        type="submit"
        disabled={pending}
        className={
          subtle
            ? "px-0.5 py-1 text-xs text-muted-foreground disabled:opacity-50"
            : "h-11 w-full rounded-full bg-ink text-sm font-bold text-white disabled:opacity-50"
        }
      >
        {pending ? "만드는 중" : subtle ? "새 코드 만들기" : "회원 초대 코드 만들기"}
      </button>
      {state?.error ? (
        <p className="mt-1 text-xs text-destructive">{state.error}</p>
      ) : null}
    </form>
  );
}

function RevokeButton({ invitationId }: { invitationId: string }) {
  const [state, formAction, pending] = useActionState<
    CenterActionState | undefined,
    FormData
  >(revokeCode, undefined);

  return (
    <form action={formAction}>
      <input type="hidden" name="invitationId" value={invitationId} />
      <button
        type="submit"
        disabled={pending}
        className="text-xs font-medium text-muted-foreground underline-offset-4 hover:underline disabled:opacity-50"
      >
        {pending ? "끄는 중" : "끄기"}
      </button>
      {state?.error ? (
        <p className="text-xs text-destructive">{state.error}</p>
      ) : null}
    </form>
  );
}

function CopyButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(code);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          setCopied(false);
        }
      }}
      className="h-12 shrink-0 rounded-full border border-border bg-card px-4 text-[0.8125rem] font-bold"
    >
      {copied ? "복사됨" : "복사"}
    </button>
  );
}

/**
 * 회원 초대 코드 (v3).
 *
 * 코드 하나를 여러 회원이 쓴다. 남은 자리를 함께 보여줘야 회원이 "코드가 안
 * 먹힌다" 고 연락해 오기 전에 트레이너가 먼저 안다.
 */
export function InvitePanel({ invitations }: { invitations: Invitation[] }) {
  return (
    <section className="rounded-[1.375rem] border border-border p-4 text-ink">
      <h2 className="text-[0.9375rem] font-bold">회원 초대 코드</h2>
      <p className="mt-0.5 text-xs text-muted-foreground">
        회원이 앱 내 정보에서 이 코드를 입력하면 담당 회원으로 연결돼요
      </p>

      {invitations.length === 0 ? (
        <div className="mt-3">
          <IssueButton />
        </div>
      ) : (
        <ul className="mt-3 flex flex-col gap-2.5">
          {invitations.map((invitation) => (
            <li key={invitation.id}>
              <div className="flex items-center gap-2">
                <p className="flex h-12 min-w-0 flex-1 items-center justify-center truncate rounded-[0.875rem] bg-brand-muted font-mono text-xl font-bold tracking-[0.3em] text-primary">
                  {invitation.code}
                </p>
                <CopyButton code={invitation.code} />
              </div>
              <div className="mt-1.5 flex items-center justify-between gap-2 px-0.5">
                <p className="min-w-0 truncate text-[0.6875rem] text-faint tabular-nums">
                  {invitation.maxUses - invitation.usedCount}자리 남음 ·{" "}
                  {formatKstDateLabel(invitation.expiresAt)}까지
                </p>
                <RevokeButton invitationId={invitation.id} />
              </div>
            </li>
          ))}
          <li>
            <IssueButton subtle />
          </li>
        </ul>
      )}
    </section>
  );
}
