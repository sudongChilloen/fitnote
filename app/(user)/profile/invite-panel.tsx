"use client";

import { useActionState } from "react";

import { MembershipRole } from "@/generated/prisma/enums";
import { formatKstDateLabel } from "@/lib/date";

import { issueInvitation, revokeCode, type CenterActionState } from "./actions";

type Invitation = {
  id: string;
  code: string;
  role: MembershipRole;
  maxUses: number;
  usedCount: number;
  expiresAt: Date;
};

function IssueButton({ role, label }: { role: MembershipRole; label: string }) {
  const [state, formAction, pending] = useActionState<
    CenterActionState | undefined,
    FormData
  >(issueInvitation, undefined);

  return (
    <form action={formAction} className="flex-1">
      <input type="hidden" name="role" value={role} />
      <button
        type="submit"
        disabled={pending}
        className="h-11 w-full rounded-xl border border-border font-semibold disabled:opacity-50"
      >
        {pending ? "만드는 중" : label}
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
 * 초대 코드 발급과 목록.
 *
 * 트레이너 코드는 한 명만 쓸 수 있고, 회원 코드는 여러 명이 쓴다.
 * 남은 자리를 함께 보여줘야 "왜 안 되지" 를 겪지 않는다.
 */
export function InvitePanel({
  canInviteTrainer,
  invitations,
}: {
  canInviteTrainer: boolean;
  invitations: Invitation[];
}) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <h2 className="text-sm font-bold">초대 코드</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        {canInviteTrainer
          ? "트레이너 코드는 한 명만, 회원 코드는 여러 명이 쓸 수 있어요."
          : "회원에게 코드를 주면 내 담당 회원으로 연결돼요."}
      </p>

      <div className="mt-3 flex gap-2">
        {canInviteTrainer ? (
          <IssueButton role={MembershipRole.TRAINER} label="트레이너 코드" />
        ) : null}
        <IssueButton role={MembershipRole.MEMBER} label="회원 코드" />
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
                  {invitation.role === MembershipRole.TRAINER
                    ? "트레이너"
                    : "회원"}{" "}
                  · {invitation.maxUses - invitation.usedCount}자리 남음 ·{" "}
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
