import Link from "next/link";
import { notFound } from "next/navigation";

import {
  CalendarClock,
  Check,
  Lock,
  MessageSquare,
  PenLine,
  UtensilsCrossed,
} from "lucide-react";

import { requireUser } from "@/app/lib/dal";
import { formatKstDateLabel } from "@/lib/date";
import { listMemberDiet } from "@/server/diet/diet-trainer.service";
import { MEAL_LABEL } from "@/server/diet/diet.service";
import {
  getMemberPersonalWorkouts,
  getSharingForTrainer,
} from "@/server/sharing/sharing.service";
import {
  getMemberDetail,
  TrainerError,
} from "@/server/trainers/trainer.service";

import { beginJournal } from "../../journals/actions";

export async function generateMetadata({
  params,
}: PageProps<"/trainer/members/[id]">) {
  const user = await requireUser();
  const { id } = await params;

  try {
    const member = await getMemberDetail(user.id, id);
    return { title: `${member.name} | FitNote` };
  } catch {
    return { title: "회원 | FitNote" };
  }
}

function formatTime(date: Date) {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

export default async function TrainerMemberPage({
  params,
}: PageProps<"/trainer/members/[id]">) {
  const user = await requireUser();
  const { id } = await params;

  let member;
  try {
    member = await getMemberDetail(user.id, id);
  } catch (error) {
    // 담당이 아닌 회원은 "권한 없음" 이 아니라 없는 것으로 다룬다. 권한 없음이라고
    // 알려주면 그 아이디의 회원이 있다는 사실 자체가 새어 나간다.
    if (error instanceof TrainerError) notFound();
    throw error;
  }

  // 공유 설정을 먼저 읽고, 켜진 것만 가져온다. 꺼져 있으면 조회 자체를 하지
  // 않으므로 "안 보여주는데 읽기는 했다" 는 상황이 생기지 않는다.
  const sharing = await getSharingForTrainer(user.id, id);

  const [personalWorkouts, recentDiet] = await Promise.all([
    sharing.sharePersonalWorkout
      ? getMemberPersonalWorkouts(user.id, id, 5)
      : [],
    sharing.shareDiet
      ? listMemberDiet(user.id, id, 3).then(({ days }) =>
          days.flatMap((day) => day.records),
        )
      : [],
  ]);

  return (
    <main className="px-5 pt-5 pb-16">
      <h1 className="text-xl font-bold">{member.name}</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {formatKstDateLabel(member.joinedAt)} 담당 시작
      </p>

      <section className="mt-6">
        <h2 className="text-base font-bold">PT 계약</h2>

        {member.contracts.length === 0 ? (
          <p className="mt-2 rounded-2xl border border-border bg-card p-4 text-xs text-muted-foreground">
            진행 중인 PT 계약이 없어요.
          </p>
        ) : (
          <ul className="mt-2 flex flex-col gap-2.5">
            {member.contracts.map((contract) => {
              const left = contract.totalSessions - contract.usedSessions;
              const ratio =
                contract.totalSessions === 0
                  ? 0
                  : (contract.usedSessions / contract.totalSessions) * 100;

              return (
                <li
                  key={contract.id}
                  className="rounded-2xl border border-border bg-card p-4"
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="truncate font-bold">{contract.productName}</p>
                    <p className="shrink-0 text-sm font-bold text-brand-strong tabular-nums">
                      {left}회 남음
                    </p>
                  </div>

                  <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-secondary">
                    <div
                      className="h-full rounded-full bg-brand"
                      style={{ width: `${ratio}%` }}
                    />
                  </div>

                  <p className="mt-2 text-xs text-muted-foreground tabular-nums">
                    {contract.usedSessions} / {contract.totalSessions}회
                    {contract.expiresAt
                      ? ` · ${formatKstDateLabel(contract.expiresAt)} 만료`
                      : ""}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="mt-7">
        <h2 className="text-base font-bold">다가오는 수업</h2>

        {member.upcomingSessions.length === 0 ? (
          <p className="mt-2 rounded-2xl border border-border bg-card p-4 text-xs text-muted-foreground">
            잡힌 수업이 없어요.
          </p>
        ) : (
          <ul className="mt-2 flex flex-col gap-2">
            {member.upcomingSessions.map((session) => (
              <li
                key={session.id}
                className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4"
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-secondary text-muted-foreground">
                  <CalendarClock className="size-4.5" aria-hidden />
                </span>

                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold">
                    {formatKstDateLabel(session.scheduledAt)}{" "}
                    {formatTime(session.scheduledAt)}
                  </span>
                  <span className="mt-0.5 block text-xs text-muted-foreground tabular-nums">
                    {session.sessionNumber}회차
                  </span>
                </span>

                {session.journalId ? (
                  <Link
                    href={`/trainer/journals/${session.journalId}`}
                    className="shrink-0 text-xs font-semibold text-brand-strong"
                  >
                    알림장
                  </Link>
                ) : (
                  <form action={beginJournal} className="shrink-0">
                    <input
                      type="hidden"
                      name="memberMembershipId"
                      value={member.membershipId}
                    />
                    <input
                      type="hidden"
                      name="ptSessionId"
                      value={session.id}
                    />
                    <button
                      type="submit"
                      className="text-xs font-semibold text-brand-strong"
                    >
                      알림장 쓰기
                    </button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-7">
        <div className="flex items-baseline justify-between">
          <h2 className="text-base font-bold">알림장</h2>

          <form action={beginJournal}>
            <input
              type="hidden"
              name="memberMembershipId"
              value={member.membershipId}
            />
            <button
              type="submit"
              className="flex items-center gap-1 text-sm font-semibold text-brand-strong"
            >
              <PenLine className="size-3.5" aria-hidden />
              새로 쓰기
            </button>
          </form>
        </div>

        {member.journals.length === 0 ? (
          <p className="mt-2 rounded-2xl border border-border bg-card p-4 text-xs text-muted-foreground">
            아직 쓴 알림장이 없어요.
          </p>
        ) : (
          <ul className="mt-2 flex flex-col gap-2">
            {member.journals.map((journal) => (
              <li key={journal.id}>
                <Link
                  href={`/trainer/journals/${journal.id}`}
                  className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4"
                >
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span className="truncate text-sm font-bold">
                        {journal.title ?? formatKstDateLabel(journal.date)}
                      </span>
                      {journal.status === "DRAFT" ? (
                        <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-[0.6875rem] font-bold text-muted-foreground">
                          초안
                        </span>
                      ) : null}
                      {journal.awaitingReply ? (
                        <span className="shrink-0 rounded-full bg-brand px-2 py-0.5 text-[0.6875rem] font-bold text-primary">
                          답장 대기
                        </span>
                      ) : null}
                    </span>

                    <span className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{formatKstDateLabel(journal.date)}</span>
                      {journal.commentCount > 0 ? (
                        <span className="flex items-center gap-0.5">
                          <MessageSquare className="size-3" aria-hidden />
                          <span className="tabular-nums">
                            {journal.commentCount}
                          </span>
                        </span>
                      ) : null}
                      {journal.status === "PUBLISHED" &&
                      journal.readByMember ? (
                        <span className="flex items-center gap-0.5">
                          <Check className="size-3" aria-hidden />
                          읽음
                        </span>
                      ) : null}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-7">
        <div className="flex items-baseline justify-between">
          <h2 className="text-base font-bold">개인 운동 기록</h2>
          {sharing.sharePersonalWorkout ? (
            <span className="text-xs text-muted-foreground">
              회원이 공유 중
            </span>
          ) : null}
        </div>

        {!sharing.sharePersonalWorkout ? (
          <div className="mt-2 rounded-2xl border border-dashed border-border p-4">
            <span className="flex size-8 items-center justify-center rounded-xl bg-secondary text-muted-foreground">
              <Lock className="size-4" aria-hidden />
            </span>
            <p className="mt-2.5 text-sm font-bold">
              회원이 개인 운동 기록을 공유하지 않았어요
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              회원이 내 정보 &gt; 공유 설정에서 켜면 여기에 나타나요. PT
              수업에서 직접 적은 기록은 알림장에서 계속 볼 수 있어요.
            </p>
          </div>
        ) : personalWorkouts.length === 0 ? (
          <p className="mt-2 rounded-2xl border border-border bg-card p-4 text-xs text-muted-foreground">
            아직 혼자 한 운동 기록이 없어요.
          </p>
        ) : (
          <ul className="mt-2 flex flex-col gap-2">
            {personalWorkouts.map((session) => (
              <li
                key={session.id}
                className="rounded-2xl border border-border bg-card p-4"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-sm font-bold">
                    {formatKstDateLabel(session.startedAt)}
                  </p>
                  <p className="shrink-0 text-xs text-muted-foreground tabular-nums">
                    {session.totalSets}세트
                  </p>
                </div>
                <p className="mt-1 truncate text-xs text-muted-foreground">
                  {session.exerciseNames.length === 0
                    ? "기록한 운동이 없어요"
                    : session.exerciseNames.join(" · ")}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-7">
        <div className="flex items-baseline justify-between">
          <h2 className="text-base font-bold">식단</h2>
          {sharing.shareDiet ? (
            <Link
              href={`/trainer/members/${id}/diet`}
              className="text-sm font-semibold text-brand-strong"
            >
              전체 보기
            </Link>
          ) : null}
        </div>

        {!sharing.shareDiet ? (
          <div className="mt-2 rounded-2xl border border-dashed border-border p-4">
            <span className="flex size-8 items-center justify-center rounded-xl bg-secondary text-muted-foreground">
              <Lock className="size-4" aria-hidden />
            </span>
            <p className="mt-2.5 text-sm font-bold">
              회원이 식단을 공유하지 않았어요
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              회원이 내 정보 &gt; 공유 설정에서 켜면 여기에 나타나요.
            </p>
          </div>
        ) : recentDiet.length === 0 ? (
          <p className="mt-2 rounded-2xl border border-border bg-card p-4 text-xs text-muted-foreground">
            아직 올린 식단이 없어요.
          </p>
        ) : (
          <ul className="mt-2 flex flex-col gap-2">
            {recentDiet.map((record) => (
              <li key={record.id}>
                <Link
                  href={`/trainer/members/${id}/diet/${record.id}`}
                  className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3"
                >
                  {record.thumbnailUrl ? (
                    // 서명 주소는 열 때마다 값이 달라 최적화 캐시가 빗나간다.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={record.thumbnailUrl}
                      alt=""
                      loading="lazy"
                      className="size-14 shrink-0 rounded-xl bg-secondary object-cover"
                    />
                  ) : (
                    <span className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-secondary text-muted-foreground">
                      <UtensilsCrossed className="size-4.5" aria-hidden />
                    </span>
                  )}

                  <span className="min-w-0 flex-1">
                    <span className="text-xs text-muted-foreground">
                      {formatKstDateLabel(record.date)} ·{" "}
                      {MEAL_LABEL[record.mealType]}
                    </span>
                    <span className="mt-0.5 block truncate text-sm font-bold">
                      {record.foodName ?? record.memo ?? "사진만 올렸어요"}
                    </span>
                  </span>

                  {record.feedbackCount === 0 ? (
                    <span className="shrink-0 rounded-full bg-brand px-2 py-0.5 text-[0.6875rem] font-bold text-primary">
                      피드백 대기
                    </span>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
