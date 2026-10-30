import Link from "next/link";
import { notFound } from "next/navigation";

import {
  CalendarClock,
  Check,
  ChevronLeft,
  Dumbbell,
  PenLine,
  RotateCcw,
  X,
} from "lucide-react";

import { requireUser } from "@/app/lib/dal";
import {
  formatKstDateLabel,
  formatKstTimeLabel,
  toKstDateKey,
  toKstTimeValue,
} from "@/lib/date";
import {
  CONTRACT_STATUS_LABEL,
  listContracts,
  listSessions,
  PTError,
  SESSION_STATUS_LABEL,
  type SessionRow,
} from "@/server/pt/pt.service";
import {
  getMemberDetail,
  TrainerError,
} from "@/server/trainers/trainer.service";

import { beginJournal } from "@/app/trainer/journals/actions";
import {
  cancelContractAction,
  extendContractAction,
  rescheduleSessionAction,
  scheduleSessionAction,
  updateSessionAction,
} from "../actions";
import { ptErrorMessage } from "../messages";
import { SubmitButton } from "../submit-button";

export const metadata = { title: "PT 계약 | FitNote" };

const ACTOR_LABEL = { MEMBER: "회원", TRAINER: "트레이너" } as const;

function StatusChip({ session }: { session: SessionRow }) {
  const tone =
    session.status === "COMPLETED"
      ? "bg-brand-muted text-primary"
      : session.status === "NO_SHOW"
        ? "bg-status-urgent-bg text-status-urgent"
        : session.status === "CANCELLED"
          ? "bg-surface text-muted-foreground"
          : "border border-input text-muted-foreground";

  return (
    <span
      className={`inline-flex h-6 shrink-0 items-center rounded-full px-2.5 text-xs font-bold ${tone}`}
    >
      {SESSION_STATUS_LABEL[session.status]}
      {session.status !== "COMPLETED" && session.deducted ? " · 차감" : ""}
    </span>
  );
}

export default async function ContractPage({
  params,
  searchParams,
}: PageProps<"/trainer/members/[id]/contracts/[contractId]">) {
  const user = await requireUser();
  const { id, contractId } = await params;
  const { error } = await searchParams;

  let member;
  let sessions;
  let contracts;
  try {
    [member, contracts, sessions] = await Promise.all([
      getMemberDetail(user.id, id),
      listContracts(user.id, id),
      listSessions(user.id, contractId),
    ]);
  } catch (caught) {
    if (caught instanceof TrainerError || caught instanceof PTError) notFound();
    throw caught;
  }

  const contract = contracts.find((row) => row.id === contractId);
  if (!contract) notFound();

  const message = ptErrorMessage(error);

  const canSchedule =
    contract.status === "ACTIVE" &&
    !contract.expired &&
    contract.usedSessions + contract.scheduledCount < contract.totalSessions;


  const hidden = (
    <>
      <input type="hidden" name="connectionId" value={id} />
      <input type="hidden" name="contractId" value={contractId} />
    </>
  );

  const completedCount = sessions.filter((session) => session.status === "COMPLETED").length;
  const noShowCount = sessions.filter((session) => session.status === "NO_SHOW").length;
  const pct = (n: number) =>
    contract.totalSessions > 0 ? `${Math.min(100, (n / contract.totalSessions) * 100)}%` : "0%";
  const otherContracts = contracts.filter((row) => row.id !== contractId);
  const dayKey = (date: Date) => toKstDateKey(date).replaceAll("-", ".");
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();
  const daysLeft = contract.expiresAt
    ? Math.ceil((contract.expiresAt.getTime() - now) / 86_400_000)
    : null;

  return (
    <main className="px-4 pt-3.5 pb-6">
      <header className="flex items-center gap-2.5">
        <Link
          href={`/trainer/members/${id}`}
          aria-label={`${member.name} 회원 상세`}
          className="flex size-10 shrink-0 items-center justify-center rounded-full border border-border text-ink"
        >
          <ChevronLeft className="size-4.5" aria-hidden />
        </Link>
        <span className="min-w-0 flex-1 leading-tight">
          <h1 className="text-[1.0625rem] font-bold">PT 계약 관리</h1>
          <span className="block truncate text-xs text-muted-foreground">{member.name}</span>
        </span>
      </header>

      <section
        className={`mt-3.5 rounded-3xl border-[1.5px] p-4 ${
          contract.status === "ACTIVE" && !contract.expired ? "border-primary" : "border-border"
        }`}
      >
        <div className="flex items-center gap-2">
          <span
            className={`shrink-0 rounded-full px-2.5 py-0.75 text-[0.6875rem] font-extrabold ${
              contract.status === "ACTIVE" && !contract.expired
                ? "bg-brand-muted text-primary"
                : "bg-surface text-muted-foreground"
            }`}
          >
            {contract.expired && contract.status === "ACTIVE"
              ? "기간 지남"
              : contract.status === "ACTIVE"
                ? "진행 중"
                : CONTRACT_STATUS_LABEL[contract.status]}
          </span>
          <b className="min-w-0 flex-1 truncate text-base">{contract.title}</b>
        </div>

        <div className="mt-3 flex items-end gap-1.5">
          <b className="text-4xl leading-none tracking-tight tabular-nums">{contract.remaining}</b>
          <span className="pb-0.5 text-sm font-semibold text-muted-foreground tabular-nums">
            / {contract.totalSessions}회 남음
          </span>
        </div>
        <p className="mt-1 text-xs text-muted-foreground tabular-nums">
          총 {contract.totalSessions}회 중 {contract.usedSessions}회 완료
        </p>

        {/* 진행 · 노쇼 · 예약 · 남음 을 한 막대에 쌓는다. 글자 범례로도 다시 말한다. */}
        <div
          className="mt-3 flex h-2.5 overflow-hidden rounded-full bg-line"
          role="img"
          aria-label={`진행 ${completedCount}회, 노쇼 ${noShowCount}회, 예약 ${contract.scheduledCount}회, 남음 ${contract.remaining}회`}
        >
          <span className="bg-primary" style={{ width: pct(completedCount) }} />
          <span className="bg-coral" style={{ width: pct(noShowCount) }} />
          <span className="bg-brand-mid" style={{ width: pct(contract.scheduledCount) }} />
        </div>
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[0.6875rem] text-muted-foreground tabular-nums">
          {[
            ["bg-primary", `진행 ${completedCount}`],
            ["bg-coral", `노쇼 ${noShowCount}`],
            ["bg-brand-mid", `예약 ${contract.scheduledCount}`],
            ["bg-line", `남음 ${contract.remaining}`],
          ].map(([color, label]) => (
            <span key={label} className="flex items-center gap-1">
              <span aria-hidden className={`inline-block size-2 rounded-[2px] ${color}`} />
              {label}
            </span>
          ))}
        </div>

        <dl className="mt-3.5 grid grid-cols-[4.75rem_minmax(0,1fr)] gap-y-2 text-[0.8125rem]">
          <dt className="text-muted-foreground">기간</dt>
          <dd className="font-bold tabular-nums">
            {dayKey(contract.startedAt)} ~ {contract.expiresAt ? dayKey(contract.expiresAt) : "기간 없음"}
            {daysLeft !== null && daysLeft >= 0 ? (
              <span className="font-semibold text-muted-foreground"> (D-{daysLeft})</span>
            ) : null}
          </dd>
          <dt className="text-muted-foreground">예약</dt>
          <dd className="font-bold tabular-nums">{contract.scheduledCount}회 잡혀 있어요</dd>
        </dl>

        {contract.expired && contract.status === "ACTIVE" ? (
          <p className="mt-3 rounded-xl bg-status-urgent-bg px-3 py-2.5 text-xs font-semibold text-status-urgent">
            계약 기간이 지났어요. 기간을 연장해야 새 수업을 예약할 수 있어요.
          </p>
        ) : null}
      </section>

      {message ? (
        <p className="mt-3 rounded-[0.875rem] bg-status-urgent-bg px-4 py-3 text-xs font-medium text-status-urgent">
          {message}
        </p>
      ) : null}

      {canSchedule ? (
        <details className="mt-3 overflow-hidden rounded-[1.375rem] border border-border bg-card">
          <summary className="flex h-12 cursor-pointer list-none items-center gap-2 px-4 text-[0.9375rem] font-bold">
            <CalendarClock className="size-4" aria-hidden />
            수업 잡기
          </summary>

          <form
            action={scheduleSessionAction}
            className="flex flex-col gap-3 border-t border-border p-4"
          >
            {hidden}

            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-bold">날짜</span>
                <input
                  name="date"
                  type="date"
                  defaultValue={toKstDateKey(new Date())}
                  required
                  className="h-11 rounded-[0.875rem] border border-border bg-background px-3 text-sm"
                />
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-bold">시각</span>
                <input
                  name="time"
                  type="time"
                  step={300}
                  defaultValue="19:00"
                  required
                  className="h-11 rounded-[0.875rem] border border-border bg-background px-3 text-sm"
                />
              </label>
            </div>

            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-bold">진행 시간 (분)</span>
              <input
                name="durationMinutes"
                type="number"
                min={10}
                max={240}
                step={5}
                defaultValue={60}
                className="h-11 rounded-[0.875rem] border border-border bg-background px-3 text-sm tabular-nums"
              />
            </label>

            <SubmitButton>수업 잡기</SubmitButton>
          </form>
        </details>
      ) : contract.status === "ACTIVE" && !contract.expired ? (
        <p className="mt-3 rounded-[1.125rem] bg-[#f7f8f7] p-4 text-xs text-muted-foreground">
          남은 횟수를 모두 잡아뒀어요. 계약을 연장하거나 새로 등록해주세요.
        </p>
      ) : null}

      <section className="mt-5">
        <h2 className="mx-1 text-base font-extrabold">회차</h2>

        {sessions.length === 0 ? (
          <p className="mt-2 rounded-2xl border border-border bg-card p-4 text-xs text-muted-foreground">
            아직 잡은 수업이 없어요.
          </p>
        ) : (
          <ol className="mt-3 flex flex-col gap-3">
            {sessions.map((session) => (
              <li
                key={session.id}
                className="overflow-hidden rounded-[1.25rem] border border-border bg-card p-3.5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[0.9375rem] font-bold">
                      {session.sessionNumber}회차 수업
                    </p>
                    <p className="mt-1 text-sm font-medium">
                      {formatKstDateLabel(session.scheduledAt)}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {formatKstTimeLabel(session.scheduledAt)} ·{" "}
                      {session.durationMinutes}분
                    </p>
                  </div>

                  <StatusChip session={session} />
                </div>

                {session.reschedules.length > 0 ? (
                  <ul className="mt-2.5 flex flex-col gap-1 border-l-2 border-border pl-3">
                    {session.reschedules.map((move, index) => (
                      <li key={index} className="text-xs text-muted-foreground">
                        {formatKstDateLabel(move.fromScheduledAt)} →{" "}
                        {formatKstDateLabel(move.toScheduledAt)} 옮김 ·{" "}
                        {ACTOR_LABEL[move.movedBy]} 요청
                        {move.reason ? ` · ${move.reason}` : ""}
                      </li>
                    ))}
                  </ul>
                ) : null}

                {session.cancelReason ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    {session.cancelledBy
                      ? `${ACTOR_LABEL[session.cancelledBy]} · `
                      : ""}
                    {session.cancelReason}
                  </p>
                ) : null}

                <div className="mt-2.5 flex flex-wrap items-center gap-2">
                  {/*
                    운동을 적고 고치는 곳은 수업 기록 화면 하나다. 여기서는
                    거기로 보내기만 한다 — 같은 것을 두 화면에서 고칠 수 있게
                    해 두면 언젠가 한쪽만 고쳐진다.
                  */}
                  {session.status !== "CANCELLED" ? (
                    <Link
                      href={`/trainer/sessions/${session.id}`}
                      className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border bg-background px-3.5 text-xs font-bold transition-colors hover:bg-surface"
                    >
                      <Dumbbell className="size-3.5" aria-hidden />
                      {session.workoutSessionId ? "운동 기록" : "운동 적기"}
                    </Link>
                  ) : null}

                  {session.journalId ? (
                    <Link
                      href={`/trainer/journals/${session.journalId}`}
                      className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border bg-background px-3.5 text-xs font-bold transition-colors hover:bg-surface"
                    >
                      <PenLine className="size-3.5" aria-hidden />
                      알림장
                    </Link>
                  ) : session.status === "COMPLETED" ? (
                    <form action={beginJournal}>
                      <input
                        type="hidden"
                        name="memberMembershipId"
                        value={id}
                      />
                      <input
                        type="hidden"
                        name="ptSessionId"
                        value={session.id}
                      />
                      <button
                        type="submit"
                        className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border bg-background px-3.5 text-xs font-bold transition-colors hover:bg-surface"
                      >
                        <PenLine className="size-3.5" aria-hidden />
                        알림장 쓰기
                      </button>
                    </form>
                  ) : null}
                </div>

                {session.status === "SCHEDULED" ? (
                  <div className="mt-3 flex flex-col gap-2 border-t border-border pt-3">
                    <form action={updateSessionAction}>
                      {hidden}
                      <input
                        type="hidden"
                        name="sessionId"
                        value={session.id}
                      />
                      <input type="hidden" name="intent" value="complete" />
                      <SubmitButton className="w-full">
                        <Check className="size-4" aria-hidden />
                        수업 완료
                      </SubmitButton>
                    </form>

                    <details className="overflow-hidden rounded-2xl border border-border bg-background">
                      <summary className="flex h-11 cursor-pointer list-none items-center justify-between px-3.5 text-xs font-semibold text-muted-foreground marker:hidden">
                        미루기
                      </summary>

                      <form
                        action={rescheduleSessionAction}
                        className="flex flex-col gap-2.5 border-t border-border p-3"
                      >
                        {hidden}
                        <input
                          type="hidden"
                          name="sessionId"
                          value={session.id}
                        />

                        <div className="grid grid-cols-2 gap-2">
                          <input
                            name="date"
                            type="date"
                            defaultValue={toKstDateKey(session.scheduledAt)}
                            required
                            className="h-10 rounded-xl border border-border bg-background px-2.5 text-xs"
                          />
                          <input
                            name="time"
                            type="time"
                            step={300}
                            defaultValue={toKstTimeValue(session.scheduledAt)}
                            required
                            className="h-10 rounded-xl border border-border bg-background px-2.5 text-xs"
                          />
                        </div>

                        <select
                          name="movedBy"
                          defaultValue="MEMBER"
                          className="h-10 rounded-xl border border-border bg-background px-2.5 text-xs"
                        >
                          <option value="MEMBER">회원이 요청</option>
                          <option value="TRAINER">트레이너가 요청</option>
                        </select>

                        <input
                          name="reason"
                          type="text"
                          maxLength={100}
                          placeholder="사유 (선택)"
                          className="h-10 rounded-xl border border-border bg-background px-2.5 text-xs"
                        />

                        <SubmitButton variant="outline" className="h-10">
                          날짜 옮기기
                        </SubmitButton>
                      </form>
                    </details>

                    <details className="overflow-hidden rounded-2xl border border-border bg-background">
                      <summary className="flex h-11 cursor-pointer list-none items-center justify-between px-3.5 text-xs font-semibold text-muted-foreground marker:hidden">
                        노쇼 · 취소
                      </summary>

                      <div className="flex flex-col gap-3 border-t border-border p-3">
                        <form
                          action={updateSessionAction}
                          className="flex flex-col gap-2"
                        >
                          {hidden}
                          <input
                            type="hidden"
                            name="sessionId"
                            value={session.id}
                          />
                          <input type="hidden" name="intent" value="no_show" />

                          <label className="flex items-center gap-2 text-xs">
                            <input
                              name="deduct"
                              type="checkbox"
                              defaultChecked
                              className="size-4"
                            />
                            횟수 차감
                          </label>

                          <SubmitButton variant="danger" className="h-10">
                            노쇼로 처리
                          </SubmitButton>
                        </form>

                        <form
                          action={updateSessionAction}
                          className="flex flex-col gap-2 border-t border-border pt-3"
                        >
                          {hidden}
                          <input
                            type="hidden"
                            name="sessionId"
                            value={session.id}
                          />
                          <input type="hidden" name="intent" value="cancel" />

                          <select
                            name="cancelledBy"
                            defaultValue="MEMBER"
                            className="h-10 rounded-xl border border-border bg-background px-2.5 text-xs"
                          >
                            <option value="MEMBER">회원이 취소</option>
                            <option value="TRAINER">트레이너가 취소</option>
                          </select>

                          <input
                            name="reason"
                            type="text"
                            maxLength={100}
                            placeholder="사유 (선택)"
                            className="h-10 rounded-xl border border-border bg-background px-2.5 text-xs"
                          />

                          <label className="flex items-center gap-2 text-xs">
                            <input
                              name="deduct"
                              type="checkbox"
                              className="size-4"
                            />
                            횟수 차감
                          </label>

                          <SubmitButton variant="outline" className="h-10">
                            <X className="size-3.5" aria-hidden />
                            수업 취소
                          </SubmitButton>
                        </form>
                      </div>
                    </details>
                  </div>
                ) : (
                  <form action={updateSessionAction} className="mt-3">
                    {hidden}
                    <input type="hidden" name="sessionId" value={session.id} />
                    <input type="hidden" name="intent" value="reopen" />
                    <SubmitButton
                      variant="outline"
                      className="h-9 w-full text-xs"
                      confirm="이 회차를 다시 예정으로 되돌릴까요?"
                    >
                      <RotateCcw className="size-3.5" aria-hidden />
                      되돌리기
                    </SubmitButton>
                  </form>
                )}
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="mt-5 rounded-[1.375rem] border border-border p-4">
        <h2 className="text-[0.9375rem] font-bold">기간 연장</h2>
        <form action={extendContractAction} className="mt-2.5 flex flex-col gap-2.5">
          {hidden}
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-bold text-muted-foreground">새 만료일</span>
            <input
              name="expiresAt"
              type="date"
              defaultValue={contract.expiresAt ? toKstDateKey(contract.expiresAt) : ""}
              className="h-11 rounded-[0.875rem] border border-border bg-background px-3 text-sm"
            />
          </label>
          <p className="text-xs text-muted-foreground">
            비워두면 기간 제한 없이 두고, 끝난 계약이면 다시 진행 중으로 돌아와요.
          </p>
          <SubmitButton variant="outline">기간 저장</SubmitButton>
        </form>
      </section>

      <section className="mt-3 rounded-[1.375rem] border border-border p-4">
        <h2 className="text-[0.9375rem] font-bold">재등록 · 새 계약</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">횟수와 기간을 정해 새 계약을 등록해요</p>
        <Link
          href={`/trainer/members/${id}/contracts/new`}
          className="mt-3 flex h-12 items-center justify-center rounded-full bg-primary text-[0.9375rem] font-extrabold text-white"
        >
          새 계약 등록
        </Link>
      </section>

      {otherContracts.length > 0 ? (
        <section className="mt-4">
          <h2 className="mx-1 mb-1 text-base font-extrabold">다른 계약</h2>
          <ul>
            {otherContracts.map((row) => (
              <li key={row.id}>
                <Link
                  href={`/trainer/members/${id}/contracts/${row.id}`}
                  className="flex items-center gap-3 border-b border-line px-1 py-3"
                >
                  <span className="min-w-0 flex-1">
                    <b className="block truncate text-sm">{row.title}</b>
                    <span className="block truncate text-xs text-muted-foreground tabular-nums">
                      {dayKey(row.startedAt)} ~ {row.expiresAt ? dayKey(row.expiresAt) : "기간 없음"} · {row.usedSessions}/{row.totalSessions}회
                    </span>
                  </span>
                  <span className="shrink-0 rounded-full bg-surface px-2.25 py-0.75 text-[0.6875rem] font-bold text-muted-foreground">
                    {row.status === "ACTIVE" && !row.expired ? "진행 중" : row.expired ? "기간 지남" : CONTRACT_STATUS_LABEL[row.status]}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <form action={cancelContractAction} className="mt-3">
          {hidden}
          <SubmitButton
            variant="danger"
            className="h-11 w-full border-0 text-[0.8125rem] font-semibold"
            confirm="이 계약을 중단할까요? 잡아둔 수업도 함께 취소돼요."
          >
            계약 중단하기
          </SubmitButton>
      </form>
    </main>
  );
}
