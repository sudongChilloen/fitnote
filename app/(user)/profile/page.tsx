import Link from "next/link";

import { ArrowLeftRight, ShieldCheck, Sparkles } from "lucide-react";

import { requireUser } from "@/app/lib/dal";
import { formatKstDateLabel } from "@/lib/date";
import { prisma } from "@/lib/prisma";
import {
  getMyTrainers,
  listActiveTrainerInvitations,
} from "@/server/trainers/connection.service";

import { BecomeTrainerButton } from "./become-trainer-button";
import { DisconnectTrainerButton } from "./disconnect-trainer-button";
import { InvitePanel } from "./invite-panel";
import { JoinCenterForm } from "./join-center-form";

export const metadata = { title: "내 정보 | FitNote" };

/**
 * 내 정보.
 *
 * 센터는 여기서 다루지 않는다. 지금 FitNote 가 해 주는 일은 트레이너와 회원
 * 사이에서 벌어지고, 센터에 등록해도 회원이 얻는 것이 아직 없다. 없는 값어치를
 * 화면에 두면 "이걸 왜 하지" 를 먼저 겪는다. 표와 코드는 그대로 두었으므로
 * 센터 기능이 생기면 이 화면에 다시 붙이면 된다.
 */
export default async function ProfilePage() {
  const user = await requireUser();

  const trainerProfile = await prisma.trainerProfile.findUnique({
    where: { userId: user.id },
    select: { id: true },
  });

  const [trainers, invitations] = await Promise.all([
    getMyTrainers(user.id),
    trainerProfile ? listActiveTrainerInvitations(user.id) : [],
  ]);

  return (
    <main className="mx-auto w-full max-w-md px-5 pt-6 pb-28">
      <h1 className="text-xl font-bold">내 정보</h1>

      <section className="mt-4 rounded-2xl border border-border bg-card p-5">
        <p className="text-lg font-bold">{user.name}</p>
        <p className="mt-0.5 text-sm text-muted-foreground">{user.email}</p>
      </section>

      <section className="mt-4 rounded-2xl border border-border bg-card p-5">
        <h2 className="text-sm font-bold">담당 트레이너</h2>

        {trainers.length === 0 ? (
          <p className="mt-1 mb-3 text-xs text-muted-foreground">
            트레이너에게 받은 코드를 넣으면 연결돼요.
          </p>
        ) : (
          <ul className="mt-3 mb-4 flex flex-col gap-2">
            {trainers.map((trainer) => (
              <li
                key={trainer.connectionId}
                className="flex items-center justify-between gap-3 rounded-xl bg-secondary px-3 py-2.5"
              >
                <div className="min-w-0">
                  <p className="truncate font-bold">{trainer.name} 트레이너</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {trainer.specialty ? `${trainer.specialty} · ` : ""}
                    {formatKstDateLabel(trainer.startedAt)}부터
                  </p>
                </div>
                <DisconnectTrainerButton
                  connectionId={trainer.connectionId}
                  trainerName={trainer.name}
                />
              </li>
            ))}
          </ul>
        )}

        <JoinCenterForm />

        <div className="mt-4 border-t border-border pt-4">
          <p className="text-sm font-bold">트레이너와 공유</p>
          <p className="mt-1 mb-2 text-xs text-muted-foreground">
            식단과 개인 운동 기록 중 무엇을 보여줄지 직접 고를 수 있어요.
          </p>
          <Link
            href="/profile/sharing"
            className="inline-flex h-11 items-center gap-1.5 rounded-xl border border-border px-4 text-sm font-bold"
          >
            <ShieldCheck className="size-4" aria-hidden />
            공유 설정
          </Link>
        </div>
      </section>

      <section className="mt-4 rounded-2xl border border-border bg-card p-5">
        <h2 className="text-sm font-bold">트레이너 화면</h2>

        {trainerProfile ? (
          <>
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
          </>
        ) : (
          <>
            <p className="mt-1 mb-2 text-xs text-muted-foreground">
              회원을 가르치고 있다면 트레이너로 시작할 수 있어요. 센터에 속해
              있지 않아도 괜찮아요.
            </p>
            <BecomeTrainerButton />
          </>
        )}
      </section>

      {trainerProfile ? (
        <div className="mt-4">
          <InvitePanel invitations={invitations} />
        </div>
      ) : null}

      <p className="mt-6 flex items-center justify-center gap-1 text-xs text-muted-foreground">
        <Sparkles className="size-3" aria-hidden />
        FitNote
      </p>
    </main>
  );
}
