"use client";

import { useActionState } from "react";

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

function IssueButton() {
  const [state, formAction, pending] = useActionState<
    CenterActionState | undefined
  >(issueTrainerCode, undefined);

  return (
    <form action={formAction}>
      <button
        type="submit"
        disabled={pending}
        className="h-11 w-full rounded-xl border border-border font-semibold disabled:opacity-50"
      >
        {pending ? "만드는 중" : "회원 연결 코드 만들기"}
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

/**
 * 회원 연결 코드 발급과 목록.
 *
 * 코드 하나를 여러 회원이 쓴다. 남은 자리를 함께 보여줘야 회원이 "코드가 안
 * 먹힌다" 고 연락해 오기 전에 트레이너가 먼저 안다.
 */
export function InvitePanel({ invitations }: { invitations: Invitation[] }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <h2 className="text-sm font-bold">회원 연결 코드</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        회원에게 이 코드를 주면 내 담당 회원으로 연결돼요.
      </p>

      <div className="mt-3">
        <IssueButton />
      </div>

      {invitations.length === 0 ? (
        <p className="mt-3 text-center text-xs text-muted-foreground">
          아직 살아 있는 코드가 없어요
        </p>
      ) : (
        <ul className="mt-3 flex flex-col gap-2">
          {invitations.map((invitation) => (
            <li
              key={invitation.id}
              className="flex items-center justify-between gap-3 rounded-xl bg-secondary px-3 py-2.5"
            >
              <div className="min-w-0">
                <p className="font-mono text-base font-bold tracking-widest">
                  {invitation.code}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">
                  {invitation.maxUses - invitation.usedCount}자리 남음 ·{" "}
                  {formatKstDateLabel(invitation.expiresAt)}까지
                </p>
              </div>
              <RevokeButton invitationId={invitation.id} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
