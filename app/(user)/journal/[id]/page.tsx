import Link from "next/link";
import { notFound } from "next/navigation";

import { ChevronLeft } from "lucide-react";

import { requireUser } from "@/app/lib/dal";
import { MembershipRole } from "@/generated/prisma/enums";
import { formatKstDateLabel } from "@/lib/date";
import {
  JournalError,
  getJournalDetail,
} from "@/server/journals/journal.service";

import { CommentForm } from "./comment-form";

export const metadata = { title: "알림장 | FitNote" };

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-4 rounded-2xl border border-border bg-card p-5">
      <h2 className="text-sm font-bold">{title}</h2>
      <div className="mt-2">{children}</div>
    </section>
  );
}

export default async function JournalDetailPage({
  params,
}: PageProps<"/journal/[id]">) {
  const { id } = await params;
  const user = await requireUser();

  const journal = await getJournalDetail(user.id, id).catch((error) => {
    if (error instanceof JournalError) notFound();
    throw error;
  });

  return (
    <main className="mx-auto w-full max-w-md px-5 pt-4 pb-28">
      <Link
        href="/journal"
        className="-ml-1 inline-flex items-center gap-0.5 text-sm text-muted-foreground"
      >
        <ChevronLeft className="size-4" aria-hidden />
        알림장
      </Link>

      <h1 className="mt-3 text-xl font-bold">{journal.title ?? "PT 알림장"}</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {formatKstDateLabel(journal.date)} ·{" "}
        {journal.trainerMembership.user.name} 트레이너
      </p>

      {journal.photos.length > 0 ? (
        <ul className="mt-4 -mx-5 flex snap-x gap-2 overflow-x-auto px-5">
          {journal.photos.map((photo) => {
            const src = photo.thumbnailUrl ?? photo.url;
            if (src === null) return null;

            return (
              <li key={photo.id} className="shrink-0 snap-start">
                {/*
                  next/image 를 쓰지 않는다. 서명 주소는 열 때마다 값이 달라서 이미지
                  최적화 캐시가 매번 빗나가고, 그때마다 원본을 다시 받아 온다.
                  올릴 때 이미 줄여서 저장하므로 최적화로 얻을 것도 없다.
                */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={src}
                  alt=""
                  loading="lazy"
                  className="size-60 rounded-2xl bg-secondary object-cover"
                />
              </li>
            );
          })}
        </ul>
      ) : null}

      <section className="mt-4 rounded-2xl border border-border bg-card p-5">
        <p className="text-[15px] leading-relaxed whitespace-pre-wrap">
          {journal.content}
        </p>
      </section>

      {journal.workout && journal.workout.records.length > 0 ? (
        <Section title="오늘의 운동">
          <ul className="flex flex-col gap-3">
            {journal.workout.records.map((record) => (
              <li key={record.id}>
                <Link
                  href={`/exercises/${record.exercise.id}`}
                  className="font-semibold"
                >
                  {record.exercise.name}
                </Link>
                <ul className="mt-1 flex flex-col gap-0.5">
                  {record.sets.map((set) => (
                    <li
                      key={set.id}
                      className="text-sm text-muted-foreground tabular-nums"
                    >
                      {set.setNumber}세트 · {set.weight ?? "맨몸"}
                      {set.weight === null ? "" : "kg"} × {set.reps ?? 0}회
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
          <Link
            href={`/workouts/${journal.workout.id}`}
            className="mt-3 inline-block text-sm font-medium text-brand-strong underline-offset-4 hover:underline"
          >
            내 운동 기록에서 보기
          </Link>
        </Section>
      ) : null}

      {journal.workoutSummary ? (
        <Section title="수업 정리">
          <p className="text-sm leading-relaxed whitespace-pre-wrap">
            {journal.workoutSummary}
          </p>
        </Section>
      ) : null}

      {journal.dietGuidance ? (
        <Section title="식단 안내">
          <p className="text-sm leading-relaxed whitespace-pre-wrap">
            {journal.dietGuidance}
          </p>
        </Section>
      ) : null}

      {journal.caution ? (
        <Section title="주의할 점">
          <p className="text-sm leading-relaxed whitespace-pre-wrap">
            {journal.caution}
          </p>
        </Section>
      ) : null}

      {journal.nextGoal ? (
        <Section title="다음 목표">
          <p className="text-sm leading-relaxed whitespace-pre-wrap">
            {journal.nextGoal}
          </p>
        </Section>
      ) : null}

      <Section title={`댓글 ${journal.comments.length}`}>
        {journal.comments.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            아직 댓글이 없어요. 궁금한 점을 물어보세요.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {journal.comments.map((comment) => {
              const mine =
                comment.authorMembershipId === journal.myMembershipId;

              return (
                <li key={comment.id}>
                  <p className="text-xs text-muted-foreground">
                    {mine ? "나" : comment.authorMembership.user.name}
                    {!mine &&
                    comment.authorMembership.role !== MembershipRole.MEMBER
                      ? " 트레이너"
                      : ""}
                  </p>
                  <p
                    className={`mt-0.5 rounded-xl px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap ${
                      mine ? "bg-accent" : "bg-secondary"
                    }`}
                  >
                    {comment.content}
                  </p>
                </li>
              );
            })}
          </ul>
        )}

        <CommentForm journalId={journal.id} />
      </Section>
    </main>
  );
}
