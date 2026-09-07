import { requireUser } from "@/app/lib/dal";
import { MembershipRole } from "@/generated/prisma/enums";
import Link from "next/link";

import { ArrowLeftRight } from "lucide-react";

import {
  canActAsTrainer,
  getCurrentMembership,
  listActiveInvitations,
} from "@/server/centers/center.service";

import { InvitePanel } from "./invite-panel";
import { JoinCenterForm } from "./join-center-form";
import { LeaveCenterButton } from "./leave-center-button";

export const metadata = { title: "내 정보 | FitNote" };

const ROLE_LABEL: Record<MembershipRole, string> = {
  CENTER_ADMIN: "센터 관리자",
  TRAINER: "트레이너",
  MEMBER: "회원",
};

export default async function ProfilePage() {
  const user = await requireUser();
  const membership = await getCurrentMembership(user.id);
  const asTrainer = membership ? canActAsTrainer(membership) : false;
  const invitations =
    membership && asTrainer
      ? await listActiveInvitations(user.id, membership.id)
      : [];

  return (
    <main className="mx-auto w-full max-w-md px-5 pt-6 pb-28">
      <h1 className="text-xl font-bold">내 정보</h1>

      <section className="mt-4 rounded-2xl border border-border bg-card p-5">
        <p className="text-lg font-bold">{user.name}</p>
        <p className="mt-0.5 text-sm text-muted-foreground">{user.email}</p>
      </section>

      {membership ? (
        <section className="mt-4 rounded-2xl border border-border bg-card p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-lg font-bold">{membership.center.name}</p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {ROLE_LABEL[membership.role]}
                {membership.assignedTrainerMembership
                  ? ` · 담당 ${membership.assignedTrainerMembership.user.name} 트레이너`
                  : ""}
              </p>
            </div>
            <LeaveCenterButton centerName={membership.center.name} />
          </div>

          {membership.role === MembershipRole.MEMBER ? (
            <div className="mt-4 border-t border-border pt-4">
              <p className="text-sm font-bold">담당 트레이너 연결</p>
              <p className="mt-1 mb-2 text-xs text-muted-foreground">
                {membership.assignedTrainerMembership
                  ? "다른 트레이너의 코드를 넣으면 담당이 바뀌어요."
                  : "트레이너에게 받은 코드를 넣어주세요."}
              </p>
              <JoinCenterForm hasCenter />
            </div>
          ) : null}

          {asTrainer ? (
            <div className="mt-4 border-t border-border pt-4">
              <p className="text-sm font-bold">트레이너 화면</p>
              <p className="mt-1 mb-2 text-xs text-muted-foreground">
                담당 회원과 오늘 수업, 알림장을 여기서 관리해요.
              </p>
              <Link
                href="/trainer"
                className="inline-flex h-11 items-center gap-1.5 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground"
              >
                <ArrowLeftRight className="size-4" aria-hidden />
                트레이너 화면으로
              </Link>
            </div>
          ) : null}
        </section>
      ) : (
        <section className="mt-4 rounded-2xl border border-border bg-card p-5">
          <p className="text-sm font-bold">센터 연결</p>
          <p className="mt-1 mb-3 text-xs text-muted-foreground">
            헬스장이나 트레이너에게 받은 8자리 코드를 넣어주세요.
          </p>
          <JoinCenterForm hasCenter={false} />
        </section>
      )}

      {membership && asTrainer ? (
        <div className="mt-4">
          <InvitePanel
            canInviteTrainer={membership.role === MembershipRole.CENTER_ADMIN}
            invitations={invitations}
          />
        </div>
      ) : null}
    </main>
  );
}
