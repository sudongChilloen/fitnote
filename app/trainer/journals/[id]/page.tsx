import Link from "next/link";
import { notFound } from "next/navigation";

import { Check, ChevronLeft, Dumbbell, Eye } from "lucide-react";

import { requireUser } from "@/app/lib/dal";
import { formatKstDateLabel } from "@/lib/date";
import { isStorageConfigured } from "@/lib/storage";
import {
  getJournalDraft,
  JournalEditError,
  MAX_PHOTOS,
} from "@/server/journals/journal-editor.service";
import { getJournalWorkout } from "@/server/journals/journal-workout.service";
import { TrainerError } from "@/server/trainers/trainer.service";

import { deleteDraftAction } from "../actions";

import { JournalForm } from "./journal-form";
import { PhotoUploader } from "./photo-uploader";

export const metadata = { title: "알림장 | FitNote" };

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

  /*
    이 수업에서 무엇을 시켰는지 옆에 펴 둔다.

    읽기만 한다. 무게를 적고 고치는 곳은 수업 기록 화면이다. 같은 것을 두
    화면에서 고칠 수 있게 해 두면 언젠가 한쪽만 고쳐지고, 무엇보다 여기 들어온
    사람이 하려는 일은 글을 쓰는 것이지 세트를 손보는 게 아니다.
  */
  const workout = await getJournalWorkout(user.id, id);

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
          {published ? "알림장 수정" : "알림장 쓰기"}
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

      {/*
        이 수업에서 시킨 운동을 위에 펴 둔다.

        글을 쓰기 전에 "오늘 뭐 했더라" 를 떠올리라고 두는 것이라 읽기 전용이다.
        고치려면 수업 기록 화면으로 간다.
      */}
      {draft.ptSessionId ? (
        <section className="mt-5">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="text-base font-bold">이 수업에서 한 운동</h2>
            <Link
              href={`/trainer/sessions/${draft.ptSessionId}`}
              className="shrink-0 text-xs font-semibold text-brand-strong"
            >
              {workout ? "고치기" : "적기"}
            </Link>
          </div>

          {workout && workout.records.length > 0 ? (
            <ul className="mt-2 flex flex-col gap-2 rounded-2xl border border-border bg-card p-3.5">
              {workout.records.map((record) => (
                <li key={record.id} className="text-sm">
                  <p className="font-semibold">{record.exercise.name}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">
                    {record.sets.length === 0
                      ? "세트 없음"
                      : record.sets
                          .map(
                            (set) =>
                              `${set.weight ?? 0}kg × ${set.reps ?? 0}`,
                          )
                          .join("  ·  ")}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 flex items-center gap-1.5 rounded-xl border border-dashed border-border px-3.5 py-2.5 text-xs text-muted-foreground">
              <Dumbbell className="size-3.5 shrink-0" aria-hidden />
              아직 적은 운동이 없어요. 수업 기록에서 적으면 회원의 운동 기록에 PT
              로 남아요.
            </p>
          )}
        </section>
      ) : null}

      {/*
        여기서부터가 이 화면의 본론이다.

        앞서는 알림장을 접어 두고 운동 기록을 위에 폈는데, 그건 수업 중에 이
        화면을 열었기 때문이었다. 이제 수업 중에는 수업 기록 화면으로 가므로
        여기 들어온 사람은 글을 쓰러 온 것이다. 접어 둘 이유가 없다.
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
