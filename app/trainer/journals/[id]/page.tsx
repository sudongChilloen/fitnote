import Link from "next/link";
import { notFound } from "next/navigation";

import { ChevronLeft, Dumbbell, Eye } from "lucide-react";

import { requireUser } from "@/app/lib/dal";
import { formatKstDateLabel } from "@/lib/date";
import { isStorageConfigured } from "@/lib/storage";
import { CommentForm } from "@/app/(user)/journal/[id]/comment-form";

import {
  getJournalDraft,
  JournalEditError,
  MAX_PHOTOS,
} from "@/server/journals/journal-editor.service";
import { getJournalWorkout } from "@/server/journals/journal-workout.service";
import { getTrainerJournalComments } from "@/server/journals/journal.service";
import { TrainerError } from "@/server/trainers/trainer.service";

import { deleteDraftAction } from "../actions";

import { JournalForm } from "./journal-form";
import { PhotoUploader } from "./photo-uploader";

export const metadata = {
  title: "알림장 | FitNote",
};

function formatOption(date: Date) {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

export default async function JournalEditorPage({
  params,
}: PageProps<"/trainer/journals/[id]">) {
  const user = await requireUser();
  const { id } = await params;

  let draft;

  try {
    draft = await getJournalDraft(user.id, id);
  } catch (error) {
    if (error instanceof JournalEditError || error instanceof TrainerError) {
      notFound();
    }

    throw error;
  }

  const published = draft.status === "PUBLISHED";

  /*
    이 수업에서 기록한 운동.
    알림장에서는 읽기만 하고, 실제 수정은 수업 기록 화면에서 한다.
  */
  const workout = await getJournalWorkout(user.id, id);

  /*
    게시된 알림장에만 댓글을 보여준다.

    초안은 회원에게 공개되지 않았기 때문에 댓글 자체가 존재할 수 없다.
    또한 댓글 조회는 별도의 trainer 전용 service에서 권한을 검사한다.
  */
  const comments = published
    ? await getTrainerJournalComments(user.id, id)
    : null;

  const totalSets = workout?.records.reduce((sum, record) => sum + record.sets.length, 0) ?? 0;
  const totalVolume =
    workout?.records.reduce(
      (sum, record) =>
        sum + record.sets.reduce((acc, set) => acc + (set.weight ?? 0) * (set.reps ?? 0), 0),
      0,
    ) ?? 0;

  return (
    <main className="px-4 pt-3.5 pb-6">
      <header className="flex items-center gap-2.5">
        <Link
          href={`/trainer/members/${draft.connectionId}`}
          aria-label={`${draft.memberName} 회원 상세`}
          className="flex size-10 shrink-0 items-center justify-center rounded-full border border-border text-ink"
        >
          <ChevronLeft className="size-4.5" aria-hidden />
        </Link>
        <span className="min-w-0 flex-1 leading-tight">
          <h1 className="text-[1.0625rem] font-bold">{published ? "알림장 수정" : "알림장 쓰기"}</h1>
          <span className="block truncate text-xs text-muted-foreground">
            {draft.memberName} · {formatKstDateLabel(draft.date)}
          </span>
        </span>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-[0.6875rem] font-bold ${
            published ? "bg-brand-muted text-primary" : "bg-surface text-muted-foreground"
          }`}
        >
          {published ? "게시 완료" : "작성 중"}
        </span>
      </header>

      {/*
        이 수업에서 한 운동. 알림장에서는 읽기만 하고, 실제 수정은 수업 기록 화면에서 한다.
      */}
      {draft.ptSessionId ? (
        <section className="mt-3.5 rounded-[1.375rem] bg-brand-muted px-4 py-3.5">
          <div className="flex items-center gap-2">
            <Dumbbell className="size-4.5 shrink-0 text-primary" aria-hidden />
            <b className="min-w-0 flex-1 text-sm text-primary">
              {workout && workout.records.length > 0 ? "이 수업의 운동 기록" : "아직 기록된 운동이 없어요"}
            </b>
            <Link
              href={`/trainer/sessions/${draft.ptSessionId}`}
              className="shrink-0 text-xs font-bold text-primary"
            >
              {workout ? "기록 수정" : "운동 기록하기"}
            </Link>
          </div>

          {workout && workout.records.length > 0 ? (
            <>
              <ul className="mt-1.5">
                {workout.records.map((record) => {
                  const top = record.sets.reduce<{ weight: number; reps: number } | null>(
                    (best, set) =>
                      best === null || (set.weight ?? 0) > best.weight
                        ? { weight: set.weight ?? 0, reps: set.reps ?? 0 }
                        : best,
                    null,
                  );
                  return (
                    <li key={record.id} className="mt-1.5 flex items-center gap-2 text-[0.8125rem]">
                      <b className="min-w-0 flex-1 truncate">{record.exercise.name}</b>
                      <span className="shrink-0 text-[#4b5650] tabular-nums">
                        {record.sets.length === 0
                          ? "세트 없음"
                          : `${top ? `${top.weight}kg × ${top.reps} · ` : ""}${record.sets.length}세트`}
                      </span>
                    </li>
                  );
                })}
              </ul>
              <p className="mt-2.5 border-t border-[#c9ecdc] pt-2.5 text-xs font-bold text-primary tabular-nums">
                총 {totalSets}세트
                {totalVolume > 0 ? ` · 볼륨 ${Math.round(totalVolume).toLocaleString()}kg` : ""}
              </p>
            </>
          ) : (
            <p className="mt-1.5 text-xs leading-relaxed text-primary/80">
              수업 기록에서 운동을 작성하면 회원의 운동 기록에도 PT 내역으로 남아요.
            </p>
          )}
        </section>
      ) : null}

      {/*
        사진.
      */}
      <section className="mt-4">
        {isStorageConfigured() ? (
          <PhotoUploader
            journalId={draft.id}
            photos={draft.photos}
            maxPhotos={MAX_PHOTOS}
          />
        ) : (
          <p className="rounded-[0.875rem] border border-dashed border-border px-3.5 py-2.5 text-xs text-muted-foreground">
            사진 저장소가 아직 설정되지 않아 사진은 올릴 수 없어요.
          </p>
        )}
      </section>

      {/*
        알림장 본문.
      */}
      <div className="mt-5">
        <JournalForm
          journalId={draft.id}
          status={draft.status}
          ptSessionId={draft.ptSessionId}
          title={draft.title ?? ""}
          content={draft.content}
          workoutSummary={draft.workoutSummary ?? ""}
          dietGuidance={draft.dietGuidance ?? ""}
          caution={draft.caution ?? ""}
          nextGoal={draft.nextGoal ?? ""}
          sessionOptions={draft.sessionOptions.map((session) => ({
            id: session.id,
            scheduledAt: formatOption(session.scheduledAt),
            sessionNumber: session.sessionNumber,
            hasWorkout: session.hasWorkout,
          }))}
        />
      </div>

      {/*
        회원 댓글.
        
        기존에는 댓글을 보려면
        "회원에게 보이는 화면"으로 이동해야 했지만,
        이제 트레이너 알림장 화면 자체에서 바로 본다.
      */}
      {published && comments ? (
        <section className="mt-5 rounded-[1.375rem] border border-border p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-[0.9375rem] font-bold">
                회원과 주고받은 댓글
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                알림장에 대한 질문과 답변을 확인해요.
              </p>
            </div>

            <span className="shrink-0 rounded-full bg-surface px-2.5 py-1 text-xs font-bold tabular-nums">
              {comments.comments.length}개
            </span>
          </div>

          {comments.comments.length > 0 ? (
            <span className="text-xs text-muted-foreground">
              {comments.memberName} 회원
            </span>
          ) : null}

          {comments.comments.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">
              아직 회원 댓글이 없어요.
            </p>
          ) : (
            <ul className="mt-3 flex flex-col gap-3">
              {comments.comments.map((comment) => {
                const mine = comment.authorUserId === user.id;

                return (
                  <li key={comment.id}>
                    <p className="text-xs text-muted-foreground">
                      {mine ? "나 · 트레이너" : `${comment.author.name} 회원`}
                    </p>

                    <p
                      className={`mt-0.5 rounded-[0.25rem_1rem_1rem_1rem] px-3 py-2.5 text-[0.8125rem] leading-relaxed whitespace-pre-wrap ${
                        mine ? "bg-brand-muted" : "bg-surface"
                      }`}
                    >
                      {comment.content}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}

          <CommentForm
            journalId={draft.id}
            placeholder="회원에게 답변을 남겨보세요"
            submitLabel="답변"
          />
        </section>
      ) : null}

      {/*
        게시된 알림장은 회원에게 보이는 화면을 미리 볼 수 있다.
        단, 댓글은 위에서 이미 확인할 수 있으므로 이 버튼을 누를 필요가 없다.
      */}
      {published ? (
        <Link
          href={`/trainer/journals/${draft.id}/preview`}
          className="mt-4 flex h-12 items-center justify-center gap-2 rounded-full border border-border bg-card text-sm font-bold transition-colors hover:bg-secondary active:scale-[0.99]"
        >
          <Eye className="size-4" aria-hidden />
          회원에게 보이는 화면
        </Link>
      ) : (
        <form action={deleteDraftAction} className="mt-4">
          <input type="hidden" name="journalId" value={draft.id} />

          <input
            type="hidden"
            name="memberMembershipId"
            value={draft.connectionId}
          />

          <button
            type="submit"
            className="h-11 w-full rounded-full text-sm font-semibold text-destructive transition-colors hover:bg-destructive/5"
          >
            초안 삭제
          </button>
        </form>
      )}
    </main>
  );
}
