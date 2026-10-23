import { notFound } from "next/navigation";

import { requireUser } from "@/app/lib/dal";
import { JournalView } from "@/components/journal/journal-view";
import {
  JournalError,
  getJournalDetail,
} from "@/server/journals/journal.service";

export const metadata = { title: "알림장 미리보기 | FitNote" };

/** 회원에게 보이는 알림장을 트레이너 화면 안에서 미리 본다. */
export default async function JournalPreviewPage({
  params,
}: PageProps<"/trainer/journals/[id]/preview">) {
  const { id } = await params;
  const user = await requireUser();

  const journal = await getJournalDetail(user.id, id).catch((error) => {
    if (error instanceof JournalError) notFound();
    throw error;
  });

  return (
    <JournalView
      journal={journal}
      backHref={`/trainer/journals/${id}`}
      backLabel="알림장 편집"
      preview
    />
  );
}
