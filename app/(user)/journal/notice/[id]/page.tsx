import Link from "next/link";
import { notFound } from "next/navigation";

import { ChevronLeft } from "lucide-react";

import { requireUser } from "@/app/lib/dal";
import { formatKstDateLabel } from "@/lib/date";
import {
  JournalError,
  getNoticeDetail,
} from "@/server/journals/journal.service";

export const metadata = { title: "공지사항 | FitNote" };

export default async function NoticeDetailPage({
  params,
}: PageProps<"/journal/notice/[id]">) {
  const { id } = await params;
  const user = await requireUser();

  const notice = await getNoticeDetail(user.id, id).catch((error) => {
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

      <h1 className="mt-3 text-xl font-bold">{notice.title}</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {notice.publishedAt ? formatKstDateLabel(notice.publishedAt) : ""} ·{" "}
        {notice.authorMembership.user.name}
      </p>

      <section className="mt-4 rounded-2xl border border-border bg-card p-5">
        <p className="text-[15px] leading-relaxed whitespace-pre-wrap">
          {notice.content}
        </p>
      </section>
    </main>
  );
}
