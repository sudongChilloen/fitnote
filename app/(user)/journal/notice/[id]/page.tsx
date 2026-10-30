import { notFound } from "next/navigation";

import { PageHeader } from "@/components/layout/page-header";

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
    <main className="mx-auto w-full max-w-md pb-28">
      <PageHeader backHref="/journal" backLabel="알림장으로" title="공지" />
      <div className="flex flex-col gap-3.5 px-4 pt-1.5">
        <section>
          <span className="inline-block rounded-full border border-brand px-2.25 py-0.5 text-[0.6875rem] font-bold text-primary">
            공지
          </span>
          <h1 className="mt-2 text-[1.375rem] leading-snug font-extrabold">{notice.title}</h1>
          <p className="mt-1.5 text-[0.8125rem] text-muted-foreground">
            {notice.authorMembership.user.name}
            {notice.publishedAt ? ` · ${formatKstDateLabel(notice.publishedAt)}` : ""}
          </p>
        </section>
        <p className="border-l-[3px] border-primary py-0.5 pl-3 text-sm leading-relaxed whitespace-pre-wrap text-[#2b3631]">
          {notice.content}
        </p>
      </div>
    </main>
  );
}
