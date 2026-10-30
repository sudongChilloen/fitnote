import Link from "next/link";

import { ChevronRight, LogOut, ShieldCheck, TrendingUp } from "lucide-react";

import { logout } from "@/app/actions/auth";
import { requireUser } from "@/app/lib/dal";
import { formatKstDateLabel } from "@/lib/date";
import { getMyPt } from "@/server/pt/pt.service";
import { getMySharing } from "@/server/sharing/sharing.service";
import { getMyTrainers } from "@/server/trainers/connection.service";

import { DisconnectTrainerButton } from "./disconnect-trainer-button";
import { TrainerCodeForm } from "./trainer-code-form";

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

  const [trainers, contracts, sharing] = await Promise.all([
    getMyTrainers(user.id),
    getMyPt(user.id),
    getMySharing(user.id),
  ]);
  const active = contracts.find((contract) => !contract.expired && contract.status === "ACTIVE") ?? null;
  const sharingText = sharing
    ? `식단 ${sharing.setting.shareDiet ? "켜짐" : "꺼짐"} · 개인 운동 ${
        sharing.setting.sharePersonalWorkout ? "켜짐" : "꺼짐"
      }`
    : "식단 · 개인 운동 공개 범위";

  return (
    <main className="mx-auto w-full max-w-md pb-28">
      <header className="flex items-center gap-3 px-5 pt-5.5 pb-2.5">
        <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-brand-muted text-xl font-extrabold text-primary">
          {user.name.slice(0, 1)}
        </span>
        <span className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-extrabold">{user.name}</h1>
          <p className="truncate text-xs text-muted-foreground">{user.email}</p>
        </span>
      </header>

      <div className="flex flex-col gap-3 px-4 pt-1.5">
        {/*
          내 PT. 홈의 "다음 PT" 카드는 다음 수업이 있을 때만 남은 횟수로 가는 문이 된다.
          계약은 있는데 일정이 안 잡힌 회원에게는 그 문이 없어서 여기에도 낸다.
        */}
        <Link
          href="/sessions"
          className="flex items-center gap-3 rounded-[1.375rem] bg-primary py-4 pr-4 pl-4.5 text-white"
        >
          <span className="min-w-0 flex-1">
            <span className="block text-xs text-white/75">내 PT</span>
            <b className="block truncate text-xl tabular-nums">
              {active ? (
                <>
                  남은 {active.remaining}회{" "}
                  <span className="text-[0.8125rem] font-semibold text-white/75">
                    / {active.totalSessions}회
                  </span>
                </>
              ) : (
                "남은 횟수 · 회차 보기"
              )}
            </b>
            <span className="block truncate text-xs text-white/75">회차 · 미참석 기록 보기</span>
          </span>
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand text-ink">
            <ChevronRight className="size-4.5" strokeWidth={2.4} aria-hidden />
          </span>
        </Link>

        <div className="flex flex-col overflow-hidden rounded-[1.25rem] border border-border">
          {[
            { href: "/body", title: "내 몸", sub: "체중 · 체지방률 · 골격근량 · 목표", Icon: TrendingUp },
            { href: "/profile/sharing", title: "트레이너와 공유", sub: sharingText, Icon: ShieldCheck },
          ].map(({ href, title, sub, Icon }, index) => (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 p-3.5 ${index > 0 ? "border-t border-line" : ""}`}
            >
              <span className="flex size-9.5 shrink-0 items-center justify-center rounded-xl bg-brand-muted text-primary">
                <Icon className="size-4.75" strokeWidth={1.9} aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <b className="block text-sm">{title}</b>
                <span className="block truncate text-xs text-muted-foreground">{sub}</span>
              </span>
              <ChevronRight className="size-4 shrink-0 text-faint" aria-hidden />
            </Link>
          ))}
        </div>

        <section className="rounded-[1.25rem] border border-border p-3.5">
          <b className="block text-[0.9375rem]">담당 트레이너</b>

          {trainers.length > 0 ? (
            <ul className="mt-2.5 flex flex-col gap-1.5">
              {trainers.map((trainer) => (
                <li
                  key={trainer.connectionId}
                  className="flex items-center gap-3 rounded-[0.875rem] bg-[#f7f8f7] px-3 py-2.5"
                >
                  <span className="flex size-9.5 shrink-0 items-center justify-center rounded-full bg-ink text-sm font-extrabold text-brand">
                    {trainer.name.slice(0, 1)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold">{trainer.name} 트레이너</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {trainer.specialty ? `${trainer.specialty} · ` : ""}
                      {formatKstDateLabel(trainer.startedAt)}부터
                    </p>
                  </div>
                  <DisconnectTrainerButton connectionId={trainer.connectionId} trainerName={trainer.name} />
                </li>
              ))}
            </ul>
          ) : null}

          <span className="mx-0.5 mt-3.5 mb-1.5 block text-xs text-muted-foreground">
            트레이너에게 받은 코드를 넣으면 연결돼요
          </span>
          <TrainerCodeForm />
        </section>

        {/* 홈에 있던 로그아웃을 여기로 옮겼다. 알림 버튼 바로 밑에 있어서 잘못 누르기 쉬웠다. */}
        <form action={logout}>
          <button
            type="submit"
            className="flex h-11.5 w-full items-center justify-center gap-2 rounded-full text-sm font-semibold text-muted-foreground transition-colors hover:bg-surface hover:text-foreground"
          >
            <LogOut className="size-4" aria-hidden />
            로그아웃
          </button>
        </form>
      </div>
    </main>
  );
}
