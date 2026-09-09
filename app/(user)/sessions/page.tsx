import Link from "next/link";

import { CalendarClock } from "lucide-react";

import { requireUser } from "@/app/lib/dal";
import { formatKstDateLabel } from "@/lib/date";
import { getMyPt, type MyPtContract } from "@/server/pt/pt.service";

import { PtSessionRow } from "./session-row";

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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <span className="flex-1">
      <span className="block text-lg font-bold tabular-nums">{value}</span>
      <span className="mt-0.5 block text-[0.6875rem] text-muted-foreground">
        {label}
      </span>
    </span>
  );
}

function ContractCard({ contract }: { contract: MyPtContract }) {
  const { upcoming, past } = split(contract);
  const closed = contract.expired || contract.status !== "ACTIVE";

  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="min-w-0 truncate text-base font-bold">
          {contract.title}
        </h2>
        {closed ? (
          <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-[0.6875rem] font-bold text-muted-foreground">
            {contract.status === "CANCELLED" ? "해지" : "종료"}
          </span>
        ) : null}
      </div>

      <p className="mt-0.5 text-xs text-muted-foreground">
        {contract.trainerName} 트레이너 · 총 {contract.totalSessions}회
      </p>

      {/*
        남은 횟수와 예약된 횟수를 따로 쓴다. 한 숫자로 합치면 "12회 남음" 이
        아직 안 받은 12회인지 더 잡을 수 있는 12회인지 알 수 없다.
      */}
      <div className="mt-4 flex gap-2">
        <Stat label="남은 횟수" value={`${contract.remaining}회`} />
        <Stat label="예약됨" value={`${contract.scheduledCount}회`} />
        <Stat label="받은 횟수" value={`${contract.completedCount}회`} />
        {contract.noShowCount > 0 ? (
          <Stat label="미참석" value={`${contract.noShowCount}회`} />
        ) : null}
      </div>

      <p className="mt-3 text-xs text-muted-foreground tabular-nums">
        {contract.expiresAt === null
          ? `${formatKstDateLabel(contract.startedAt)} 시작 · 만료일 없음`
          : contract.expired
            ? `${formatKstDateLabel(contract.expiresAt)} 만료됨`
            : `${formatKstDateLabel(contract.expiresAt)} 만료` +
              (contract.daysLeft !== null
                ? contract.daysLeft === 0
                  ? " · 오늘까지"
                  : ` · ${contract.daysLeft}일 남음`
                : "")}
      </p>

      {upcoming.length > 0 ? (
        <div className="mt-5">
          <h3 className="text-xs font-bold text-muted-foreground">앞으로</h3>
          <ul className="mt-1 divide-y divide-border">
            {upcoming.map((session) => (
              <PtSessionRow key={session.id} session={session} />
            ))}
          </ul>
        </div>
      ) : null}

      {past.length > 0 ? (
        <div className="mt-5">
          <h3 className="text-xs font-bold text-muted-foreground">지난 회차</h3>
          <ul className="mt-1 divide-y divide-border">
            {past.map((session) => (
              <PtSessionRow key={session.id} session={session} />
            ))}
          </ul>
        </div>
      ) : null}

      {contract.sessions.length === 0 ? (
        <p className="mt-5 text-xs text-muted-foreground">
          아직 잡힌 수업이 없어요. 트레이너가 일정을 잡으면 여기에 보여요.
        </p>
      ) : null}
    </section>
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
    <main className="px-5 pt-5 pb-16">
      <h1 className="text-xl font-bold">내 PT</h1>

      {contracts.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-border bg-card p-5">
          <span className="flex size-9 items-center justify-center rounded-xl bg-accent text-brand-strong">
            <CalendarClock className="size-4.5" aria-hidden />
          </span>
          <p className="mt-2.5 text-sm font-bold">등록된 PT가 없어요</p>
          <p className="mt-1 text-xs text-muted-foreground">
            트레이너와 연결하고 PT를 등록하면 남은 횟수와 수업 일정이 여기에
            보여요. 내정보에서 트레이너 초대 코드를 넣을 수 있어요.
          </p>
          <Link
            href="/profile"
            className="mt-3 inline-flex h-10 items-center rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground"
          >
            내정보로 가기
          </Link>
        </div>
      ) : (
        <div className="mt-4 flex flex-col gap-4">
          {active.map((contract) => (
            <ContractCard key={contract.id} contract={contract} />
          ))}

          {/*
            끝난 계약은 아래로 민다. 지우지 않는 건 재등록할 때 지난번에 몇 회를
            실제로 받았는지가 회원에게도 판단 근거라서다.
          */}
          {closed.length > 0 ? (
            <>
              <h2 className="mt-2 text-sm font-bold text-muted-foreground">
                지난 PT
              </h2>
              {closed.map((contract) => (
                <ContractCard key={contract.id} contract={contract} />
              ))}
            </>
          ) : null}
        </div>
      )}
    </main>
  );
}
