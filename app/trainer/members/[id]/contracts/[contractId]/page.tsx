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
      ? "bg-brand/15 text-brand-strong"
      : session.status === "NO_SHOW"
        ? "bg-destructive/10 text-destructive"
        : session.status === "CANCELLED"
          ? "bg-secondary text-muted-foreground"
          : "bg-secondary text-foreground";

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

  const ratio =
    contract.totalSessions === 0
      ? 0
      : (contract.usedSessions / contract.totalSessions) * 100;

  const hidden = (
    <>
      <input type="hidden" name="connectionId" value={id} />
      <input type="hidden" name="contractId" value={contractId} />
    </>
  );

  return (
    <main className="px-5 pt-5 pb-16">
      <Link
        href={`/trainer/members/${id}`}
        className="-ml-1 inline-flex items-center gap-1 text-sm text-muted-foreground"
      >
        <ChevronLeft className="size-4" aria-hidden />
        {member.name}
      </Link>

      <h1 className="mt-3 text-xl font-bold">{contract.title}</h1>

      <div className="mt-3 rounded-2xl border border-border bg-card p-4">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-sm text-muted-foreground tabular-nums">
            {contract.usedSessions} / {contract.totalSessions}회
          </p>
          <p className="text-sm font-bold text-brand-strong tabular-nums">
            {contract.remaining}회 남음
          </p>
        </div>

        <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full rounded-full bg-brand"
            style={{ width: `${ratio}%` }}
          />
        </div>

        <p className="mt-2.5 text-xs text-muted-foreground">
          {formatKstDateLabel(contract.startedAt)} 시작
          {contract.expiresAt
            ? ` · ${formatKstDateLabel(contract.expiresAt)}까지`
            : " · 기간 없음"}
          {contract.status !== "ACTIVE"
            ? ` · ${CONTRACT_STATUS_LABEL[contract.status]}`
            : ""}
        </p>

        {contract.expired && contract.status === "ACTIVE" ? (
          <p className="mt-1.5 text-xs font-bold text-destructive">
            기간이 지났어요. 연장하지 않으면 새 수업을 잡을 수 없어요.
          </p>
        ) : null}
      </div>

      {message ? (
        <p className="mt-4 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-xs font-medium text-destructive">
          {message}
        </p>
      ) : null}

      {canSchedule ? (
        <details className="mt-4 rounded-2xl border border-border bg-card">
          <summary className="flex h-12 cursor-pointer list-none items-center gap-2 px-4 text-sm font-bold">
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
                  className="h-11 rounded-xl border border-border bg-background px-3 text-sm"
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
                  className="h-11 rounded-xl border border-border bg-background px-3 text-sm"
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
                className="h-11 rounded-xl border border-border bg-background px-3 text-sm tabular-nums"
              />
            </label>

            <SubmitButton>수업 잡기</SubmitButton>
          </form>
        </details>
      ) : contract.status === "ACTIVE" && !contract.expired ? (
        <p className="mt-4 rounded-2xl border border-border bg-card p-4 text-xs text-muted-foreground">
          남은 횟수를 모두 잡아뒀어요. 계약을 연장하거나 새로 등록해주세요.
        </p>
      ) : null}

      <section className="mt-7">
        <h2 className="text-base font-bold">회차</h2>

        {sessions.length === 0 ? (
          <p className="mt-2 rounded-2xl border border-border bg-card p-4 text-xs text-muted-foreground">
            아직 잡은 수업이 없어요.
          </p>
        ) : (
          <ol className="mt-2 flex flex-col gap-2.5">
            {sessions.map((session) => (
              <li
                key={session.id}
                className="rounded-2xl border border-border bg-card p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-bold">
                      {session.sessionNumber}회차
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {formatKstDateLabel(session.scheduledAt)}{" "}
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
                      className="inline-flex h-8 items-center gap-1 rounded-full border border-border px-3 text-xs font-bold"
                    >
                      <Dumbbell className="size-3.5" aria-hidden />
                      {session.workoutSessionId ? "운동 기록" : "운동 적기"}
                    </Link>
                  ) : null}

                  {session.journalId ? (
                    <Link
                      href={`/trainer/journals/${session.journalId}`}
                      className="inline-flex h-8 items-center gap-1 rounded-full border border-border px-3 text-xs font-bold"
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
                        className="inline-flex h-8 items-center gap-1 rounded-full border border-border px-3 text-xs font-bold"
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

                    <details className="rounded-xl border border-border">
                      <summary className="flex h-10 cursor-pointer list-none items-center px-3 text-xs font-bold text-muted-foreground">
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
                            className="h-10 rounded-lg border border-border bg-background px-2.5 text-xs"
                          />
                          <input
                            name="time"
                            type="time"
                            step={300}
                            defaultValue={toKstTimeValue(session.scheduledAt)}
                            required
                            className="h-10 rounded-lg border border-border bg-background px-2.5 text-xs"
                          />
                        </div>

                        <select
                          name="movedBy"
                          defaultValue="MEMBER"
                          className="h-10 rounded-lg border border-border bg-background px-2.5 text-xs"
                        >
                          <option value="MEMBER">회원이 요청</option>
                          <option value="TRAINER">트레이너가 요청</option>
                        </select>

                        <input
                          name="reason"
                          type="text"
                          maxLength={100}
                          placeholder="사유 (선택)"
                          className="h-10 rounded-lg border border-border bg-background px-2.5 text-xs"
                        />

                        <SubmitButton variant="outline" className="h-10">
                          날짜 옮기기
                        </SubmitButton>
                      </form>
                    </details>

                    <details className="rounded-xl border border-border">
                      <summary className="flex h-10 cursor-pointer list-none items-center px-3 text-xs font-bold text-muted-foreground">
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
                            className="h-10 rounded-lg border border-border bg-background px-2.5 text-xs"
                          >
                            <option value="MEMBER">회원이 취소</option>
                            <option value="TRAINER">트레이너가 취소</option>
                          </select>

                          <input
                            name="reason"
                            type="text"
                            maxLength={100}
                            placeholder="사유 (선택)"
                            className="h-10 rounded-lg border border-border bg-background px-2.5 text-xs"
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

      <section className="mt-8">
        <h2 className="text-base font-bold">계약 관리</h2>

        <form
          action={extendContractAction}
          className="mt-2 flex flex-col gap-2.5 rounded-2xl border border-border bg-card p-4"
        >
          {hidden}
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-bold">만료일 바꾸기</span>
            <input
              name="expiresAt"
              type="date"
              defaultValue={
                contract.expiresAt ? toKstDateKey(contract.expiresAt) : ""
              }
              className="h-11 rounded-xl border border-border bg-background px-3 text-sm"
            />
          </label>
          <p className="text-xs text-muted-foreground">
            비워두면 기간 제한 없이 두고, 끝난 계약이면 다시 진행 중으로
            돌아와요.
          </p>
          <SubmitButton variant="outline">기간 저장</SubmitButton>
        </form>

        <form action={cancelContractAction} className="mt-2.5">
          {hidden}
          <SubmitButton
            variant="danger"
            className="w-full"
            confirm="이 계약을 중단할까요? 잡아둔 수업도 함께 취소돼요."
          >
            계약 중단
          </SubmitButton>
        </form>
      </section>
    </main>
  );
}
