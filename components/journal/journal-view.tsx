import Link from "next/link";

import { ChevronLeft } from "lucide-react";

import { CommentForm } from "@/app/(user)/journal/[id]/comment-form";
import { formatKstDateLabel } from "@/lib/date";
import type { getJournalDetail } from "@/server/journals/journal.service";

export type JournalDetail = Awaited<ReturnType<typeof getJournalDetail>>;

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-4 rounded-2xl bg-card shadow-card p-5">
      <h2 className="text-sm font-bold">{title}</h2>
      <div className="mt-2">{children}</div>
    </section>
  );
}

/**
 * 회원에게 보이는 알림장 화면.
 *
 * 회원 화면과 트레이너 미리보기가 같은 모양을 쓴다. 미리보기에서는 회원 전용
 * 주소로 가는 링크와 댓글 입력을 빼고, 돌아갈 곳을 트레이너 화면으로 둔다.
 */
export function JournalView({
  journal,
  backHref,
  backLabel,
  preview = false,
}: {
  journal: JournalDetail;
  backHref: string;
  backLabel: string;
  preview?: boolean;
}) {
  return (
    <main className="mx-auto w-full max-w-md px-5 pt-4 pb-28">
      {preview ? (
        <div className="mb-3 rounded-xl bg-secondary px-3 py-2 text-xs text-muted-foreground">
          회원에게 보이는 화면 미리보기
        </div>
      ) : null}
      <Link
        href={backHref}
        className="-ml-1 inline-flex items-center gap-0.5 text-sm text-muted-foreground"
      >
        <ChevronLeft className="size-4" aria-hidden />
        {backLabel}
      </Link>

      <h1 className="mt-3 text-xl font-bold">{journal.title ?? "PT 알림장"}</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {formatKstDateLabel(journal.date)} ·{" "}
        {journal.trainerProfile.displayName ?? journal.trainerProfile.user.name}{" "}
        트레이너
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

      <section className="mt-4 rounded-2xl bg-card shadow-card p-5">
        <p className="text-[15px] leading-relaxed whitespace-pre-wrap">
          {journal.content}
        </p>
      </section>

      {journal.workout && journal.workout.records.length > 0 ? (
        <Section title="오늘의 운동">
          <ul className="flex flex-col gap-3">
            {journal.workout.records.map((record) => (
              <li key={record.id}>
                {preview ? (
                  <p className="font-semibold">{record.exercise.name}</p>
                ) : (
                  <Link
                    href={`/exercises/${record.exercise.id}`}
                    className="font-semibold"
                  >
                    {record.exercise.name}
                  </Link>
                )}
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
          {!preview ? (
            <Link
              href={`/workouts/${journal.workout.id}`}
              className="mt-3 inline-block text-sm font-medium text-brand-strong underline-offset-4 hover:underline"
            >
              내 운동 기록에서 보기
            </Link>
          ) : null}
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
              const mine = comment.authorUserId === journal.myUserId;
              const byTrainer =
                comment.authorUserId === journal.trainerProfile.userId;

              return (
                <li key={comment.id}>
                  <p className="text-xs text-muted-foreground">
                    {mine ? "나" : comment.author.name}
                    {!mine && byTrainer ? " 트레이너" : ""}
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

        {!preview ? (
          <CommentForm journalId={journal.id} />
        ) : (
          <p className="mt-3 text-xs text-muted-foreground">
            회원에게 보이는 화면 미리보기입니다.
          </p>
        )}
      </Section>
    </main>
  );
}
