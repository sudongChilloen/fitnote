import Link from "next/link";

import {
  Dumbbell,
  ImageIcon,
  Megaphone,
  MessageSquare,
  UtensilsCrossed,
} from "lucide-react";

import { requireUser } from "@/app/lib/dal";
import { formatKstDateLabel } from "@/lib/date";
import {
  getTimeline,
  type TimelineEntry,
} from "@/server/journals/journal.service";

export const metadata = { title: "알림장 | FitNote" };

function hrefOf(entry: TimelineEntry) {
  if (entry.kind === "JOURNAL") return `/journal/${entry.id}`;
  if (entry.kind === "NOTICE") return `/journal/notice/${entry.id}`;
  if (entry.kind === "DIET") return `/diet/${entry.id}`;
  return `/workouts/${entry.id}`;
}

function Badge({ entry }: { entry: TimelineEntry }) {
  if (entry.kind === "NOTICE") {
    return (
      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-secondary text-muted-foreground">
        <Megaphone className="size-4.5" aria-hidden />
      </span>
    );
  }
  if (entry.kind === "JOURNAL") {
    return (
      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-accent text-brand-strong">
        <MessageSquare className="size-4.5" aria-hidden />
      </span>
    );
  }
  if (entry.kind === "DIET") {
    return (
      <span
        className={
          entry.feedbackCount > 0
            ? "flex size-9 shrink-0 items-center justify-center rounded-xl bg-accent text-brand-strong"
            : "flex size-9 shrink-0 items-center justify-center rounded-xl bg-secondary text-muted-foreground"
        }
      >
        <UtensilsCrossed className="size-4.5" aria-hidden />
      </span>
    );
  }
  return (
    <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-secondary text-muted-foreground">
      <Dumbbell className="size-4.5" aria-hidden />
    </span>
  );
}

export default async function JournalPage() {
  const user = await requireUser();
  const { hasCenter, unreadCount, entries } = await getTimeline(user.id);

  return (
    <main className="mx-auto w-full max-w-md px-5 pt-6 pb-28">
      <div className="flex items-baseline justify-between">
        <h1 className="text-xl font-bold">알림장</h1>
        {unreadCount > 0 ? (
          <span className="rounded-full bg-accent px-2.5 py-1 text-xs font-bold text-brand-strong tabular-nums">
            새 소식 {unreadCount}
          </span>
        ) : null}
      </div>

      {!hasCenter ? (
        <div className="mt-4 rounded-2xl border border-border bg-card p-5">
          <p className="text-sm font-bold">아직 센터에 연결되지 않았어요</p>
          <p className="mt-1 text-xs text-muted-foreground">
            트레이너에게 받은 코드를 넣으면 알림장과 공지를 받아볼 수 있어요.
          </p>
          <Link
            href="/profile"
            className="mt-3 inline-flex h-10 items-center rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground"
          >
            코드 입력하러 가기
          </Link>
        </div>
      ) : null}

      {entries.length === 0 ? (
        <p className="mt-10 text-center text-sm text-muted-foreground">
          아직 쌓인 기록이 없어요
        </p>
      ) : (
        <ul className="mt-4 flex flex-col gap-2">
          {entries.map((entry) => (
            <li key={`${entry.kind}-${entry.id}`}>
              <Link
                href={hrefOf(entry)}
                className="flex gap-3 rounded-2xl border border-border bg-card p-4"
              >
                <Badge entry={entry} />

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    {entry.kind === "NOTICE" && entry.pinned ? (
                      <span className="rounded bg-secondary px-1.5 py-0.5 text-[11px] font-bold text-muted-foreground">
                        고정
                      </span>
                    ) : null}
                    <p className="truncate font-bold">{entry.title}</p>
                    {entry.kind !== "WORKOUT" &&
                    entry.kind !== "DIET" &&
                    entry.unread ? (
                      <span
                        className="size-1.5 shrink-0 rounded-full bg-brand-strong"
                        aria-label="안 읽음"
                      />
                    ) : null}
                  </div>

                  <p className="mt-0.5 truncate text-sm text-muted-foreground">
                    {entry.preview}
                  </p>

                  <p className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{formatKstDateLabel(entry.date)}</span>
                    {entry.authorName ? <span>{entry.authorName}</span> : null}
                    {entry.kind === "JOURNAL" && entry.photoCount > 0 ? (
                      <span className="flex items-center gap-0.5 tabular-nums">
                        <ImageIcon className="size-3" aria-hidden />
                        {entry.photoCount}
                      </span>
                    ) : null}
                    {entry.kind === "JOURNAL" && entry.commentCount > 0 ? (
                      <span className="flex items-center gap-0.5 tabular-nums">
                        <MessageSquare className="size-3" aria-hidden />
                        {entry.commentCount}
                      </span>
                    ) : null}
                    {entry.kind === "DIET" && entry.feedbackCount > 0 ? (
                      <span className="flex items-center gap-0.5 font-bold text-brand-strong tabular-nums">
                        <MessageSquare className="size-3" aria-hidden />
                        피드백 {entry.feedbackCount}
                      </span>
                    ) : null}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
