import Link from "next/link";
import { notFound } from "next/navigation";

import { Check, ChevronLeft, Eye } from "lucide-react";

import { requireUser } from "@/app/lib/dal";
import { formatKstDateLabel } from "@/lib/date";
import { isStorageConfigured } from "@/lib/storage";
import {
  getJournalDraft,
  JournalEditError,
  MAX_PHOTOS,
} from "@/server/journals/journal-editor.service";
import { getJournalWorkout } from "@/server/journals/journal-workout.service";
import { getSharingForTrainer } from "@/server/sharing/sharing.service";
import { getBodyPartCounts } from "@/server/exercises/exercise.service";
import { getFavoriteExerciseIds } from "@/server/workouts/favorite.service";
import { getLastRecord } from "@/server/workouts/workout.service";
import { TrainerError } from "@/server/trainers/trainer.service";

import { AddExerciseDrawer } from "@/app/(user)/workouts/[id]/add-exercise-drawer";
import { RecordList } from "@/app/(user)/workouts/[id]/record-list";

import { deleteDraftAction } from "../actions";

import { JournalForm } from "./journal-form";
import { PhotoUploader } from "./photo-uploader";
import { WorkoutControls } from "./workout-controls";

export const metadata = { title: "수업 기록 | FitNote" };

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
  searchParams,
}: PageProps<"/trainer/journals/[id]">) {
  const user = await requireUser();
  const { id } = await params;
  const query = await searchParams;

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

  // 접어 둔 알림장에 이미 쓴 내용이 있는지. 접혀 있으면 안이 안 보인다.
  const hasJournalText = Boolean(
    draft.content.trim() ||
      draft.title?.trim() ||
      draft.workoutSummary?.trim() ||
      draft.dietGuidance?.trim() ||
      draft.caution?.trim() ||
      draft.nextGoal?.trim() ||
      draft.photos.length > 0,
  );

  /*
    PT 수업 운동 기록.

    회원 화면과 똑같은 컴포넌트로 그린다. 세트를 고치는 화면이 두 벌이 되면
    언젠가 한쪽만 고쳐진다. 서비스에서 이미 "이 세션에 손댈 수 있는 사람인가"
    를 판단하므로 같은 서버 액션을 그대로 쓴다.
  */
  const workout = await getJournalWorkout(user.id, id);

  // 직전 기록 힌트에 회원의 개인 운동이 섞이면 공유 설정을 지나간다.
  const sharing = await getSharingForTrainer(user.id, draft.connectionId);

  const [previousRecords, bodyPartCounts, favoriteIds] = await Promise.all([
    Promise.all(
      (workout?.records ?? []).map((record) =>
        getLastRecord(draft.memberUserId, record.exercise.id, workout!.id, {
          ptOnly: !sharing.sharePersonalWorkout,
        }),
      ),
    ),
    workout ? getBodyPartCounts() : Promise.resolve({}),
    // 트레이너 자신의 즐겨찾기다. 자주 처방하는 운동을 빨리 찾으라고 둔다.
    workout ? getFavoriteExerciseIds(user.id) : Promise.resolve([]),
  ]);

  return (
    <main className="px-5 pt-4 pb-16">
      <Link
        href={`/trainer/members/${draft.connectionId}`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground"
      >
        <ChevronLeft className="size-4" aria-hidden />
        {draft.memberName}
      </Link>

      <div className="mt-3 flex items-baseline justify-between gap-2">
        <h1 className="text-xl font-bold">
          {published ? "알림장 수정" : "수업 기록"}
        </h1>
        <span className="shrink-0 text-sm text-muted-foreground">
          {formatKstDateLabel(draft.date)}
        </span>
      </div>

      {query.published === "1" ? (
        <p className="mt-3 flex items-center gap-1.5 rounded-xl bg-accent px-3.5 py-2.5 text-sm font-bold text-brand-strong">
          <Check className="size-4" aria-hidden />
          게시했어요. 회원이 알림장에서 볼 수 있어요.
        </p>
      ) : null}

      {published ? (
        <p className="mt-3 rounded-xl border border-border px-3.5 py-2.5 text-xs text-muted-foreground">
          이미 게시한 알림장이에요. 고치면 바로 반영돼요.
        </p>
      ) : null}

      <section className="mt-5">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-bold">오늘 한 운동</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              적는 대로 회원의 운동 기록에 PT 로 남아요.
            </p>
          </div>
          <WorkoutControls
            journalId={draft.id}
            hasWorkout={workout !== null}
            canDelete={!published}
          />
        </div>

        {draft.ptSessionId === null ? (
          <p className="mt-3 rounded-xl border border-dashed border-border px-3.5 py-2.5 text-xs text-muted-foreground">
            아래 알림장에서 어떤 수업인지 먼저 골라 주세요. 수업에 붙어야 회원
            기록으로 들어가요.
          </p>
        ) : null}

        {workout ? (
          <div className="mt-3 flex flex-col gap-3">
            {workout.records.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border px-3.5 py-2.5 text-xs text-muted-foreground">
                아래에서 운동을 골라 무게와 횟수를 적어 주세요.
              </p>
            ) : (
              <RecordList
                sessionId={workout.id}
                records={workout.records}
                previousRecords={workout.records.map((_, index) => {
                  const previous = previousRecords[index];
                  return previous
                    ? {
                        performedAt: previous.performedAt.toISOString(),
                        sets: previous.sets,
                      }
                    : null;
                })}
                alwaysEditable
              />
            )}

            <AddExerciseDrawer
              sessionId={workout.id}
              bodyPartCounts={bodyPartCounts}
              favoriteIds={favoriteIds}
              addedExerciseIds={workout.records.map(
                (record) => record.exercise.id,
              )}
            />
          </div>
        ) : null}
      </section>

      {/*
        알림장은 접어 둔다.

        수업 중에 이 화면을 여는 이유는 방금 든 무게를 적기 위해서다. 글을 쓰는
        건 대개 수업이 끝나고 나서다. 둘을 나란히 펼쳐 두면 수업 중에 스크롤이
        길어지고, 안 쓴 칸이 여섯 개 보이면 "지금 다 써야 하나" 싶어진다.

        기본으로 펼치는 경우가 둘 있다. 이미 게시한 알림장은 고치러 들어온
        것이고, 수업이 안 붙은 알림장은 여기서 수업을 골라야 운동을 적을 수 있다.
      */}
      <details
        className="mt-7 rounded-2xl border border-border"
        open={published || draft.ptSessionId === null}
      >
        <summary className="flex cursor-pointer items-center justify-between gap-2 px-4 py-3.5">
          <span className="text-base font-bold">알림장</span>
          <span className="text-xs text-muted-foreground">
            {hasJournalText ? "쓰는 중" : "수업 끝나고 적어도 돼요"}
          </span>
        </summary>

        <div className="border-t border-border px-4 pt-4 pb-4">
          <section>
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


        </div>
      </details>

      {published ? (
        <Link
          href={`/journal/${draft.id}`}
          className="mt-4 flex h-11 items-center justify-center gap-1.5 rounded-xl border border-border text-sm font-semibold"
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
            className="h-11 w-full rounded-xl text-sm font-semibold text-destructive"
          >
            초안 삭제
          </button>
        </form>
      )}
    </main>
  );
}
