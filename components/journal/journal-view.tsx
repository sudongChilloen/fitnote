import Link from "next/link";

import { ChevronLeft } from "lucide-react";

import { CommentForm } from "@/app/(user)/journal/[id]/comment-form";
import { EquipmentIcon } from "@/components/fitness/equipment-icon";
import { formatKstDateLabel } from "@/lib/date";
import type { getJournalDetail } from "@/server/journals/journal.service";

export type JournalDetail = Awaited<ReturnType<typeof getJournalDetail>>;

/** 본문 블록: 왼쪽 세로 막대 색으로 종류를 구분하고, 제목 글자로도 말한다. */
function Block({ label, bar, text }: { label: string; bar: string; text: string }) {
  return (
    <section className="border-l-[3px] py-0.5 pl-3" style={{ borderColor: bar }}>
      <h2 className="text-xs font-extrabold text-primary">{label}</h2>
      <p className="mt-1 text-sm leading-relaxed whitespace-pre-wrap text-[#2b3631]">{text}</p>
    </section>
  );
}

/** "60kg × 10회 · 4세트". 세트마다 다르면 세트 수만. */
function summarizeSets(sets: { weight: number | null; reps: number | null }[]) {
  if (sets.length === 0) return "기록 없음";
  const [first] = sets;
  const same = sets.every((set) => set.weight === first.weight && set.reps === first.reps);
  if (!same) return `${sets.length}세트`;
  const weight = first.weight === null ? "맨몸" : `${first.weight}kg`;
  return `${weight} × ${first.reps ?? 0}회 · ${sets.length}세트`;
}

function shortDate(date: Date) {
  const kst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  return `${kst.getUTCMonth() + 1}월 ${kst.getUTCDate()}일`;
}

/**
 * 회원에게 보이는 알림장 화면 (v3).
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
  const trainerName = journal.trainerProfile.displayName ?? journal.trainerProfile.user.name;
  const records = journal.workout?.records ?? [];
  const totalSets = records.reduce((sum, record) => sum + record.sets.length, 0);
  const totalVolume = records.reduce(
    (sum, record) =>
      sum + record.sets.reduce((acc, set) => acc + (set.weight ?? 0) * (set.reps ?? 0), 0),
    0,
  );

  const blocks = [
    { label: "오늘 수업", text: journal.content, bar: "#2f6b53" },
    { label: "운동 정리", text: journal.workoutSummary, bar: "#5fd3a8" },
    { label: "식단 안내", text: journal.dietGuidance, bar: "#a8e6cf" },
    { label: "주의할 점", text: journal.caution, bar: "#ef6b4e" },
    { label: "다음 목표", text: journal.nextGoal, bar: "#2f6b53" },
  ].filter((block): block is { label: string; text: string; bar: string } => Boolean(block.text));

  return (
    <main className="mx-auto w-full max-w-md pb-28">
      <header className="flex items-center gap-2.5 px-4 pt-3.5 pb-2">
        <Link
          href={backHref}
          aria-label={`${backLabel}(으)로 돌아가기`}
          className="flex size-10 shrink-0 items-center justify-center rounded-full border border-border text-ink"
        >
          <ChevronLeft className="size-4.5" aria-hidden />
        </Link>
        <b className="min-w-0 flex-1 truncate text-[1.0625rem]">{backLabel}</b>
      </header>

      <div className="flex flex-col gap-3.5 px-4 pt-1.5">
        {preview ? (
          <p className="rounded-[0.875rem] bg-[#f7f8f7] px-3 py-2 text-xs text-muted-foreground">
            회원에게 보이는 화면 미리보기
          </p>
        ) : null}

        <section>
          {journal.ptSession ? (
            <span className="inline-block rounded-full border border-brand px-2.25 py-0.5 text-[0.6875rem] font-bold text-primary">
              {journal.ptSession.sessionNumber}회차 · PT
            </span>
          ) : null}
          <h1 className="mt-2 text-[1.375rem] leading-snug font-extrabold">
            {journal.title ?? "PT 알림장"}
          </h1>
          <div className="mt-2.5 flex items-center gap-2">
            <span className="flex size-7.5 shrink-0 items-center justify-center rounded-full bg-brand-muted text-xs font-extrabold text-primary">
              {trainerName.trim().slice(0, 1)}
            </span>
            <span className="min-w-0 truncate text-[0.8125rem]">
              <b>{trainerName} 트레이너</b>{" "}
              <span className="text-muted-foreground">· {formatKstDateLabel(journal.date)}</span>
            </span>
          </div>
        </section>

        {blocks.map((block) => (
          <Block key={block.label} {...block} />
        ))}

        {records.length > 0 && journal.workout ? (
          <section className="rounded-[1.25rem] border border-border p-3.5">
            <div className="flex items-center justify-between gap-2">
              <b className="text-[0.9375rem]">수업 운동 기록</b>
              <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                {totalSets}세트
                {totalVolume > 0 ? ` · ${Math.round(totalVolume).toLocaleString()}kg` : ""}
              </span>
            </div>
            <ul>
              {records.map((record, index) => (
                <li
                  key={record.id}
                  className={`flex items-center gap-2.5 py-2.25 ${index > 0 ? "border-t border-line" : ""}`}
                >
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-[0.625rem] bg-brand-muted text-primary">
                    <EquipmentIcon name={record.exercise.name} className="size-4.25" />
                  </span>
                  {preview ? (
                    <b className="min-w-0 flex-1 truncate text-[0.8125rem]">{record.exercise.name}</b>
                  ) : (
                    <Link
                      href={`/exercises/${record.exercise.id}`}
                      className="min-w-0 flex-1 truncate text-[0.8125rem] font-bold"
                    >
                      {record.exercise.name}
                    </Link>
                  )}
                  <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                    {summarizeSets(record.sets)}
                  </span>
                </li>
              ))}
            </ul>
            {!preview ? (
              <Link
                href={`/workouts/${journal.workout.id}`}
                className="mt-1 block text-xs font-semibold text-primary"
              >
                내 운동 기록에서 보기 ›
              </Link>
            ) : null}
          </section>
        ) : null}

        {journal.photos.length > 0 ? (
          <ul className="grid grid-cols-2 gap-2">
            {journal.photos.map((photo) => {
              const src = photo.thumbnailUrl ?? photo.url;
              if (src === null) return null;

              return (
                <li key={photo.id}>
                  {/*
                    next/image 를 쓰지 않는다. 서명 주소는 열 때마다 값이 달라서 이미지
                    최적화 캐시가 매번 빗나가고, 그때마다 원본을 다시 받아 온다.
                  */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={src}
                    alt=""
                    loading="lazy"
                    className="aspect-square w-full rounded-2xl bg-line object-cover"
                  />
                </li>
              );
            })}
          </ul>
        ) : null}

        <section>
          <b className="mx-0.5 mb-2 block text-[0.9375rem]">댓글 {journal.comments.length}</b>

          {journal.comments.length === 0 ? (
            <p className="text-[0.8125rem] text-muted-foreground">
              아직 댓글이 없어요. 궁금한 점을 물어보세요.
            </p>
          ) : (
            <ul className="flex flex-col gap-2.5">
              {journal.comments.map((comment) => {
                const mine = comment.authorUserId === journal.myUserId;
                const byTrainer = comment.authorUserId === journal.trainerProfile.userId;

                return (
                  <li key={comment.id} className="flex gap-2">
                    <span
                      className={`flex size-7.5 shrink-0 items-center justify-center rounded-full text-xs font-extrabold ${
                        byTrainer ? "bg-brand-muted text-primary" : "bg-surface text-[#4b5650]"
                      }`}
                    >
                      {comment.author.name.trim().slice(0, 1)}
                    </span>
                    <span
                      className={`min-w-0 flex-1 rounded-[0.25rem_1rem_1rem_1rem] px-3 py-2.5 ${
                        byTrainer ? "bg-brand-muted" : "bg-surface"
                      }`}
                    >
                      <span className="block text-[0.6875rem] text-muted-foreground">
                        {mine ? "나" : comment.author.name}
                        {!mine && byTrainer ? " 트레이너" : ""} · {shortDate(comment.createdAt)}
                      </span>
                      <span className="mt-0.5 block text-[0.8125rem] leading-normal whitespace-pre-wrap">
                        {comment.content}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}

          {!preview ? (
            <CommentForm
              journalId={journal.id}
              placeholder="트레이너에게 댓글 남기기"
              submitLabel="보내기"
            />
          ) : (
            <p className="mt-3 text-xs text-muted-foreground">
              회원에게 보이는 화면 미리보기입니다.
            </p>
          )}
        </section>
      </div>
    </main>
  );
}
