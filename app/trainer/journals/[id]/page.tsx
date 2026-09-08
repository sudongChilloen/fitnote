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
import { TrainerError } from "@/server/trainers/trainer.service";

import { deleteDraftAction } from "../actions";

import { JournalForm } from "./journal-form";
import { PhotoUploader } from "./photo-uploader";

export const metadata = { title: "알림장 작성 | FitNote" };

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
          {published ? "알림장 수정" : "알림장 작성"}
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
          이미 게시한 알림장이에요.{" "}
          {draft.readByMember ? "회원이 읽었어요." : "회원이 아직 안 읽었어요."}{" "}
          고치면 바로 반영돼요.
        </p>
      ) : null}

      <section className="mt-5">
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

      <div className="mt-6">
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
