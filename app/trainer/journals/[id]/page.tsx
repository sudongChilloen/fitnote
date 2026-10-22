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

  return (
    <main className="px-5 pt-4 pb-16">
      <header>
        <Link
          href={`/trainer/members/${draft.connectionId}`}
          className="inline-flex min-h-9 items-center gap-1 rounded-lg pr-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronLeft className="size-4" aria-hidden />
          {draft.memberName}
        </Link>

        <div className="mt-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-brand-strong">
              SESSION JOURNAL
            </p>

            <h1 className="mt-1.5 text-2xl font-bold tracking-tight">
              {published ? "알림장 수정" : "알림장 쓰기"}
            </h1>

            <p className="mt-2 text-sm text-muted-foreground">
              {draft.memberName} 회원 · {formatKstDateLabel(draft.date)}
            </p>
          </div>

          <span
            className={`mt-1 shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${
              published
                ? "bg-accent text-brand-strong"
                : "bg-secondary text-muted-foreground"
            }`}
          >
            {published ? "게시 완료" : "작성 중"}
          </span>
        </div>
      </header>

      {/*
        이 수업에서 한 운동.
      */}
      {draft.ptSessionId ? (
        <section className="mt-6">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent text-brand-strong">
                <Dumbbell className="size-4" aria-hidden />
              </span>

              <div className="min-w-0">
                <h2 className="text-base font-bold tracking-tight">
                  수업 운동 기록
                </h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  알림장과 연결된 운동 내역
                </p>
              </div>
            </div>

            <Link
              href={`/trainer/sessions/${draft.ptSessionId}`}
              className="inline-flex h-9 shrink-0 items-center justify-center rounded-xl border border-border px-3 text-xs font-bold transition-colors hover:bg-secondary"
            >
              {workout ? "기록 수정" : "운동 기록하기"}
            </Link>
          </div>

          {workout && workout.records.length > 0 ? (
            <ul className="mt-3 divide-y divide-border/70 overflow-hidden rounded-2xl border border-border/70 bg-card">
              {workout.records.map((record) => (
                <li key={record.id} className="px-4 py-3.5">
                  <p className="text-sm font-bold">{record.exercise.name}</p>

                  <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground tabular-nums">
                    {record.sets.length === 0
                      ? "세트 없음"
                      : record.sets
                          .map(
                            (set) => `${set.weight ?? 0}kg × ${set.reps ?? 0}`,
                          )
                          .join("  ·  ")}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <div className="mt-3 rounded-2xl border border-dashed border-border px-4 py-4">
              <p className="text-sm font-semibold">
                아직 기록된 운동이 없어요.
              </p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                수업 기록에서 운동을 작성하면 회원의 운동 기록에도 PT 내역으로
                남아요.
              </p>
            </div>
          )}
        </section>
      ) : null}

      {/*
        사진.
      */}
      <section className="mt-6">
        {isStorageConfigured() ? (
          <PhotoUploader
            journalId={draft.id}
            photos={draft.photos}
            maxPhotos={MAX_PHOTOS}
          />
        ) : (
          <p className="rounded-xl border border-dashed border-border px-3.5 py-2.5 text-xs text-muted-foreground">
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
        <section className="mt-6 rounded-2xl border border-border/70 bg-card p-5 shadow-card">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold tracking-tight">
                회원과 주고받은 댓글
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                알림장에 대한 질문과 답변을 확인해요.
              </p>
            </div>

            <span className="shrink-0 rounded-full bg-secondary px-2.5 py-1 text-xs font-bold tabular-nums">
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
          href={`/journal/${draft.id}`}
          className="mt-4 flex h-12 items-center justify-center gap-2 rounded-xl border border-border bg-card text-sm font-bold transition-colors hover:bg-secondary active:scale-[0.99]"
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
            className="h-11 w-full rounded-xl text-sm font-semibold text-destructive transition-colors hover:bg-destructive/5"
          >
            초안 삭제
          </button>
        </form>
      )}
    </main>
  );
}
