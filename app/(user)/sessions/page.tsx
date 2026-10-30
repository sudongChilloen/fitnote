import Link from "next/link";

import { CalendarClock, ChevronLeft, ChevronRight } from "lucide-react";

import { requireUser } from "@/app/lib/dal";
import { formatKstDateLabel } from "@/lib/date";
import { getMyPt, type MyPtContract } from "@/server/pt/pt.service";

import { PastPtRow, UpcomingPtRow } from "./session-row";

export const metadata = { title: "내 PT | FitNote" };

/**
 * 앞으로 받을 회차와 이미 지난 회차를 가른다.
 *
 * 한 줄로 회차순으로만 세우면, 20회짜리 계약에서 다음 수업을 보려고 매번 맨
 * 아래까지 내려야 한다. 지난 것은 최근이 위다 — 회원이 확인하는 건 지난주에
 * 뭘 했는지지 석 달 전 첫 회차가 아니다.
 *
 * 기준을 지금이 아니라 세 시간 전으로 두는 건 다음 수업 목록과 같은 이유다.
 * 오후 7시 수업이 7시 1분에 지난 회차로 내려가면 수업 중에 확인하려던 사람이
 * 엉뚱한 자리를 뒤진다.
 */
function split(contract: MyPtContract) {
  const since = new Date(Date.now() - 3 * 3_600_000);

  const upcoming = contract.sessions.filter(
    (session) =>
      session.scheduledAt >= since &&
      (session.status === "SCHEDULED" || session.status === "CANCELLED"),
  );

  const past = contract.sessions
    .filter((session) => !upcoming.includes(session))
    .reverse();

  return { upcoming, past };
}

function expiryText(contract: MyPtContract) {
  if (contract.expiresAt === null) return `${formatKstDateLabel(contract.startedAt)} 시작 · 만료일 없음`;
  if (contract.expired) return `${formatKstDateLabel(contract.expiresAt)} 만료됨`;
  return (
    `${formatKstDateLabel(contract.startedAt)} 시작 · ${formatKstDateLabel(contract.expiresAt)} 만료` +
    (contract.daysLeft !== null
      ? contract.daysLeft === 0
        ? " · 오늘까지"
        : ` · ${contract.daysLeft}일 남음`
      : "")
  );
}

/** 진행 중인 계약: 초록 카드 + 앞으로 / 지난 회차 목록. */
function ActiveContract({ contract }: { contract: MyPtContract }) {
  const { upcoming, past } = split(contract);
  const used = contract.totalSessions - contract.remaining;
  const ratio = contract.totalSessions > 0 ? used / contract.totalSessions : 0;
  const ring = 2 * Math.PI * 33;

  return (
    <>
      <section className="rounded-3xl bg-primary px-4.5 pt-4.5 pb-4 text-white">
        <div className="flex items-center gap-3">
          <span className="min-w-0 flex-1">
            <span className="block truncate text-xs text-white/75">
              {contract.title} · {contract.trainerName} 트레이너
            </span>
            <span className="mt-1 block text-xs text-white/75">남은 횟수</span>
            {/*
              남은 횟수와 예약된 횟수를 따로 쓴다. 한 숫자로 합치면 "12회 남음" 이
              아직 안 받은 12회인지 더 잡을 수 있는 12회인지 알 수 없다.
            */}
            <b className="block text-[2.5rem] leading-none tracking-tight tabular-nums">
              {contract.remaining}
              <span className="text-[0.9375rem] font-semibold">회</span>
            </b>
          </span>
          <span className="relative size-21 shrink-0">
            <svg viewBox="0 0 84 84" className="size-21" aria-hidden>
              <circle cx="42" cy="42" r="33" fill="none" stroke="rgb(255 255 255 / 14%)" strokeWidth="8" />
              <circle
                cx="42"
                cy="42"
                r="33"
                fill="none"
                stroke="var(--brand)"
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={ring}
                strokeDashoffset={ring * (1 - Math.min(Math.max(ratio, 0), 1))}
                transform="rotate(-90 42 42)"
              />
            </svg>
            <span className="absolute inset-0 flex flex-col items-center justify-center">
              <b className="text-[0.9375rem] tabular-nums">{used}</b>
              <span className="text-[0.625rem] text-white/70 tabular-nums">
                / {contract.totalSessions} 사용
              </span>
            </span>
          </span>
        </div>
        <div className="mt-3.5 grid grid-cols-3 gap-1.5">
          {[
            ["예약됨", contract.scheduledCount],
            ["받은 횟수", contract.completedCount],
            ["미참석", contract.noShowCount],
          ].map(([label, value]) => (
            <span key={label} className="min-w-0 rounded-[0.875rem] bg-white/10 px-2.5 py-2">
              <span className="block text-[0.6875rem] text-white/70">{label}</span>
              <b className="text-[0.9375rem] tabular-nums">{value}회</b>
            </span>
          ))}
        </div>
        <p className="mt-3 text-xs text-white/80 tabular-nums">{expiryText(contract)}</p>
      </section>

      {upcoming.length > 0 ? (
        <section>
          <h2 className="mx-1 mt-1.5 mb-1 text-base font-extrabold">앞으로</h2>
          <ul>
            {upcoming.map((session) => (
              <UpcomingPtRow key={session.id} session={session} trainerName={contract.trainerName} />
            ))}
          </ul>
        </section>
      ) : null}

      {past.length > 0 ? (
        <section>
          <h2 className="mx-1 mt-2.5 mb-1 text-base font-extrabold">지난 회차</h2>
          <ul>
            {past.map((session) => (
              <PastPtRow key={session.id} session={session} />
            ))}
          </ul>
        </section>
      ) : null}

      {contract.sessions.length === 0 ? (
        <p className="rounded-[0.875rem] bg-[#f7f8f7] px-3.5 py-3 text-xs text-muted-foreground">
          아직 잡힌 수업이 없어요. 트레이너가 일정을 잡으면 여기에 보여요.
        </p>
      ) : null}
    </>
  );
}

/**
 * 회원이 보는 내 PT.
 *
 * "몇 회 남았어요?" 를 트레이너에게 묻지 않아도 되게 하는 화면이다. 지금까지
 * 이 답은 트레이너 화면에만 있었고, 회원은 다음 수업 줄에 붙은 "3/20회차" 로
 * 역산해야 했다.
 *
 * 지난 회차를 다 보여 주는 게 이 화면의 절반이다. 안 가서 한 회가 빠졌는데
 * 그 회차가 화면에 없으면 회원은 숫자가 왜 줄었는지 확인할 방법이 없다.
 */
export default async function MyPtPage() {
  const user = await requireUser();
  const contracts = await getMyPt(user.id);

  const active = contracts.filter((c) => !c.expired && c.status === "ACTIVE");
  const closed = contracts.filter((c) => c.expired || c.status !== "ACTIVE");

  return (
    <main className="pb-16">
      <header className="flex items-center gap-2.5 px-4 pt-3.5 pb-2">
        <Link
          href="/profile"
          aria-label="내 정보"
          className="flex size-10 shrink-0 items-center justify-center rounded-full border border-border text-ink"
        >
          <ChevronLeft className="size-4.5" aria-hidden />
        </Link>
        <h1 className="min-w-0 flex-1 text-[1.0625rem] font-bold">내 PT</h1>
      </header>

      <div className="flex flex-col gap-3 px-4 pt-1.5">
        {contracts.length === 0 ? (
          <div className="rounded-[1.25rem] border border-border p-5">
            <span className="flex size-9 items-center justify-center rounded-xl bg-brand-muted text-primary">
              <CalendarClock className="size-4.5" aria-hidden />
            </span>
            <p className="mt-2.5 text-sm font-bold">등록된 PT가 없어요</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              트레이너와 연결하고 PT를 등록하면 남은 횟수와 수업 일정이 여기에 보여요. 내정보에서
              트레이너 초대 코드를 넣을 수 있어요.
            </p>
            <Link
              href="/profile"
              className="mt-3 inline-flex h-10 items-center rounded-full bg-primary px-4 text-sm font-bold text-primary-foreground"
            >
              내정보로 가기
            </Link>
          </div>
        ) : null}

        {active.map((contract) => (
          <ActiveContract key={contract.id} contract={contract} />
        ))}

        {/*
          끝난 계약은 한 줄로 접어 둔다. 지우지 않는 건 재등록할 때 지난번에 몇 회를
          실제로 받았는지가 회원에게도 판단 근거라서다.
        */}
        {closed.length > 0 ? (
          <details className="group rounded-2xl bg-[#f7f8f7]">
            <summary className="flex cursor-pointer list-none items-center gap-2.5 px-3.5 py-3">
              <span className="min-w-0 flex-1">
                <b className="block text-[0.8125rem]">지난 PT {closed.length}개</b>
                <span className="block truncate text-xs text-muted-foreground">
                  {closed
                    .map(
                      (contract) =>
                        `${contract.title}${
                          contract.expiresAt ? ` · ${formatKstDateLabel(contract.expiresAt)} 종료` : ""
                        }`,
                    )
                    .join(" / ")}
                </span>
              </span>
              <ChevronRight className="size-4 shrink-0 text-faint transition-transform group-open:rotate-90" aria-hidden />
            </summary>
            <div className="flex flex-col gap-2 px-2 pb-2">
              {closed.map((contract) => (
                <div key={contract.id} className="rounded-[0.875rem] bg-card px-3 py-2">
                  <div className="flex items-baseline justify-between gap-2">
                    <b className="min-w-0 truncate text-[0.8125rem]">{contract.title}</b>
                    <span className="shrink-0 rounded-full bg-surface px-2 py-0.5 text-[0.6875rem] font-bold text-muted-foreground">
                      {contract.status === "CANCELLED" ? "해지" : "종료"}
                    </span>
                  </div>
                  <p className="text-[0.6875rem] text-muted-foreground tabular-nums">
                    {contract.trainerName} 트레이너 · 받은 {contract.completedCount}회 / 총{" "}
                    {contract.totalSessions}회
                    {contract.noShowCount > 0 ? ` · 미참석 ${contract.noShowCount}회` : ""}
                  </p>
                  <ul>
                    {split(contract).past.map((session) => (
                      <PastPtRow key={session.id} session={session} />
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </details>
        ) : null}
      </div>
    </main>
  );
}
