import { notFound } from "next/navigation";

import { requireUser } from "@/app/lib/dal";
import { JournalView } from "@/components/journal/journal-view";
import {
  JournalError,
  getJournalDetail,
} from "@/server/journals/journal.service";

export const metadata = { title: "알림장 | FitNote" };

export default async function JournalDetailPage({
  params,
}: PageProps<"/journal/[id]">) {
  const { id } = await params;
  const user = await requireUser();

  const journal = await getJournalDetail(user.id, id).catch((error) => {
    if (error instanceof JournalError) notFound();
    throw error;
  });

  return <JournalView journal={journal} backHref="/journal" backLabel="알림장" />;
}
