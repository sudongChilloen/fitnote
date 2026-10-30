import Link from "next/link";

import {
  ChevronDown,
  ChevronRight,
  Dumbbell,
  Megaphone,
  MessageSquare,
  Pin,
  UtensilsCrossed,
} from "lucide-react";

import { requireUser } from "@/app/lib/dal";
import { formatKstDateLabel, kstDaysAgo, toKstDateKey } from "@/lib/date";
import { cn } from "@/lib/utils";
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

type Filter = "all" | "journal" | "diet" | "workout" | "notice";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "전체" },
  { key: "journal", label: "알림장" },
  { key: "diet", label: "식단" },
  { key: "workout", label: "운동" },
  { key: "notice", label: "공지" },
];

const KIND_OF: Record<Exclude<Filter, "all">, TimelineEntry["kind"]> = {
  journal: "JOURNAL",
  diet: "DIET",
  workout: "WORKOUT",
  notice: "NOTICE",
};

/** 종류별 아이콘 원 색. 목록 안에서는 이 작은 원에만 색을 쓴다. */
const KIND_STYLE: Record<
  TimelineEntry["kind"],
  { icon: typeof Dumbbell; circle: string; label: string }
> = {
  JOURNAL: { icon: MessageSquare, circle: "bg-brand-muted text-primary", label: "알림장" },
  NOTICE: { icon: Megaphone, circle: "bg-brand-muted text-primary", label: "공지" },
  DIET: { icon: UtensilsCrossed, circle: "bg-brand-muted text-primary", label: "식단" },
  WORKOUT: { icon: Dumbbell, circle: "bg-brand-muted text-primary", label: "운동" },
};

function isUnread(entry: TimelineEntry) {
  return (entry.kind === "JOURNAL" || entry.kind === "NOTICE") && entry.unread;
}

/** "오늘" · "어제" · "10월 27일 (화)" */
function dayLabel(key: string) {
  if (key === toKstDateKey(new Date())) return "오늘";
  if (key === toKstDateKey(kstDaysAgo(1))) return "어제";
  return formatKstDateLabel(new Date(`${key}T00:00:00+09:00`));
}

function metaOf(entry: TimelineEntry) {
  const parts: string[] = [];
  if (entry.authorName) parts.push(entry.authorName);
  if (entry.kind === "JOURNAL" && entry.photoCount > 0) parts.push(`사진 ${entry.photoCount}`);
  if (entry.kind === "JOURNAL" && entry.commentCount > 0) parts.push(`댓글 ${entry.commentCount}`);
  if (entry.kind === "DIET" && entry.feedbackCount > 0) parts.push(`피드백 ${entry.feedbackCount}`);
  if (entry.kind === "WORKOUT" && entry.isPt) parts.push("PT");
  return parts.join(" · ");
}

/**
 * 알림장.
 *
 * 예전에는 모든 기록을 한 줄로 길게 늘어놓아서 무엇이 새로 왔는지, 언제 일인지
 * 훑어보기 어려웠다. 지금은 세 층으로 나눈다.
 *   1. 고정 공지 — 맨 위 한 줄
 *   2. 새로 온 소식 — 아직 안 읽은 알림장·공지만 큰 카드로
 *   3. 지난 기록 — 날짜별로 묶은 목록. 색은 종류 아이콘에만 쓴다.
 * 위쪽 칩으로 종류를 골라 볼 수 있다.
 */
export default async function JournalPage({ searchParams }: PageProps<"/journal">) {
  const user = await requireUser();
  const { unreadCount, entries } = await getTimeline(user.id);

  const params = await searchParams;
  const filter: Filter = FILTERS.some((item) => item.key === params.type)
    ? (params.type as Filter)
    : "all";

  const visible =
    filter === "all" ? entries : entries.filter((entry) => entry.kind === KIND_OF[filter]);

  const pinned = visible.filter((entry) => entry.kind === "NOTICE" && entry.pinned);
  const fresh = visible.filter(
    (entry) => isUnread(entry) && !(entry.kind === "NOTICE" && entry.pinned),
  );
  const rest = visible.filter(
    (entry) => !isUnread(entry) && !(entry.kind === "NOTICE" && entry.pinned),
  );

  // 처음에는 최근 날짜 묶음만 펼쳐 두고, 그 전 기록은 "더보기" 아래로 접는다.
  // 화면이 끝없이 길어지면 새로 온 것과 지난 것이 다시 섞여 보인다.
  const OPEN_GROUPS = 3;

  // 날짜별 묶음. entries 는 이미 최신순이다.
  const groups: { key: string; items: TimelineEntry[] }[] = [];
  for (const entry of rest) {
    const key = toKstDateKey(entry.date);
    const last = groups[groups.length - 1];
    if (last && last.key === key) last.items.push(entry);
    else groups.push({ key, items: [entry] });
  }

  function renderGroups(list: typeof groups) {
    return (
      <>
        {list.map((group) => (
          <section key={group.key}>
            <h3 className="mx-1 mt-2 mb-1 flex items-baseline gap-2">
              <b className="text-[0.8125rem]">{dayLabel(group.key)}</b>
              <span className="text-[0.6875rem] text-faint tabular-nums">
                {group.items.length}개
              </span>
            </h3>

            <ul className="flex flex-col">
              {group.items.map((entry) => {
                const style = KIND_STYLE[entry.kind];
                const Icon = style.icon;
                const meta = metaOf(entry);
                const tag =
                  entry.kind === "DIET" && entry.feedbackCount > 0
                    ? "피드백"
                    : entry.kind === "WORKOUT" && entry.isPt
                      ? "PT"
                      : null;
                return (
                  <li key={`${entry.kind}-${entry.id}`}>
                    <Link
                      href={hrefOf(entry)}
                      className="flex items-center gap-3 border-b border-line px-1 py-2.5"
                    >
                      <span className="flex size-9.5 shrink-0 items-center justify-center rounded-xl bg-brand-muted text-primary">
                        <Icon className="size-4.5" strokeWidth={1.9} aria-hidden />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex min-w-0 items-center gap-1.5">
                          <span className="min-w-0 truncate text-sm font-bold">{entry.title}</span>
                          {tag ? (
                            <span className="shrink-0 rounded-full border border-brand px-1.75 text-[0.6875rem] leading-[1.0625rem] font-bold text-primary">
                              {tag}
                            </span>
                          ) : null}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {entry.kind === "JOURNAL" || entry.kind === "NOTICE"
                            ? entry.preview || meta
                            : meta || entry.preview || style.label}
                        </span>
                      </span>
                      <ChevronRight className="size-4 shrink-0 text-faint" aria-hidden />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </>
    );
  }

  return (
    <main className="mx-auto w-full max-w-md pt-4.5 pb-28">
      <header className="flex items-end gap-2.5 px-5">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-extrabold tracking-tight">알림장</h1>
          <p className="truncate text-[0.8125rem] text-muted-foreground">
            트레이너 피드백과 내 기록이 모여요
          </p>
        </div>
        {unreadCount > 0 ? (
          <span className="shrink-0 rounded-full bg-primary px-3 py-1.5 text-xs font-bold text-white tabular-nums">
            새 소식 {unreadCount}
          </span>
        ) : null}
      </header>

      {/* 밑줄 탭 */}
      <nav aria-label="종류" className="mt-2.5 overflow-x-auto border-b border-line px-5">
        <ul className="flex w-max gap-4.5">
          {FILTERS.map((item) => {
            const active = item.key === filter;
            return (
              <li key={item.key}>
                <Link
                  href={item.key === "all" ? "/journal" : `/journal?type=${item.key}`}
                  aria-current={active ? "page" : undefined}
                  scroll={false}
                  className={cn(
                    "flex h-10.5 items-center px-0.5 text-sm whitespace-nowrap",
                    active
                      ? "font-extrabold text-ink shadow-[inset_0_-3px_0_var(--primary)]"
                      : "font-semibold text-faint",
                  )}
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="flex flex-col gap-3 px-4 pt-3.5">
        {visible.length === 0 ? (
          <p className="rounded-[1.375rem] bg-[#f7f8f7] py-12 text-center text-sm text-muted-foreground">
            {filter === "all" ? "아직 쌓인 기록이 없어요" : "이 종류의 기록이 없어요"}
          </p>
        ) : null}

        {/* 1. 고정 공지 */}
        {pinned.map((entry) => (
          <Link
            key={`pin-${entry.id}`}
            href={hrefOf(entry)}
            className="flex items-center gap-2.5 rounded-[0.875rem] bg-[#f7f8f7] py-2.5 pr-2 pl-3.5 text-ink"
          >
            <Pin className="size-4 shrink-0 text-primary" aria-hidden />
            <span className="shrink-0 text-[0.6875rem] font-bold text-primary">고정 공지</span>
            <span className="min-w-0 flex-1 truncate text-[0.8125rem] font-bold">{entry.title}</span>
            <ChevronRight className="size-4 shrink-0 text-faint" aria-hidden />
          </Link>
        ))}

        {/* 2. 새로 온 소식 */}
        {fresh.length > 0 ? (
          <section className="flex flex-col gap-2.5">
            <h2 className="mx-1 mt-1 text-base font-extrabold">새로 온 소식</h2>

            {fresh.map((entry) => {
              const style = KIND_STYLE[entry.kind];
              const Icon = style.icon;
              return (
                <Link
                  key={`${entry.kind}-${entry.id}`}
                  href={hrefOf(entry)}
                  className="block rounded-[1.25rem] border-[1.5px] border-brand-mid bg-card px-4 py-3.5 text-ink"
                >
                  <span className="flex items-center gap-2.5">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-muted text-[0.8125rem] font-extrabold text-primary">
                      {entry.authorName ? (
                        entry.authorName.trim().slice(0, 1)
                      ) : (
                        <Icon className="size-4" aria-hidden />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[0.6875rem] text-muted-foreground">
                        {style.label} · {formatKstDateLabel(entry.date)}
                        {entry.authorName ? ` · ${entry.authorName}` : ""}
                      </span>
                      <span className="block truncate text-[0.9375rem] font-bold">
                        {entry.title}
                      </span>
                    </span>
                    <span className="shrink-0 rounded-full bg-primary px-2.25 py-0.75 text-[0.6875rem] font-bold text-white">
                      새 글
                    </span>
                  </span>
                  {entry.preview ? (
                    <span className="mt-2 line-clamp-2 block text-[0.8125rem] leading-relaxed text-[#4b5650]">
                      {entry.preview}
                    </span>
                  ) : null}
                  {entry.kind === "NOTICE" ||
                  (entry.kind === "JOURNAL" && (entry.photoCount > 0 || entry.commentCount > 0)) ? (
                    <span className="mt-2.5 flex flex-wrap gap-1.5 text-[0.6875rem] font-semibold text-muted-foreground">
                      {entry.kind === "NOTICE" ? (
                        <span className="rounded-full bg-surface px-2.5 py-0.75">공지</span>
                      ) : null}
                      {entry.kind === "JOURNAL" && entry.photoCount > 0 ? (
                        <span className="rounded-full bg-surface px-2.5 py-0.75">
                          사진 {entry.photoCount}
                        </span>
                      ) : null}
                      {entry.kind === "JOURNAL" && entry.commentCount > 0 ? (
                        <span className="rounded-full bg-surface px-2.5 py-0.75">
                          댓글 {entry.commentCount}
                        </span>
                      ) : null}
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </section>
        ) : null}

        {/* 3. 지난 기록: 날짜별 묶음. 최근 묶음만 펼치고 나머지는 더보기. */}
        {renderGroups(groups.slice(0, OPEN_GROUPS))}

        {groups.length > OPEN_GROUPS ? (
          <details className="group">
            <summary className="mt-1 flex h-11 cursor-pointer list-none items-center justify-center gap-1 rounded-full bg-surface text-[0.8125rem] font-bold text-[#4b5650] group-open:hidden">
              이전 기록{" "}
              {groups.slice(OPEN_GROUPS).reduce((sum, group) => sum + group.items.length, 0)}개 더보기
              <ChevronDown className="size-4" aria-hidden />
            </summary>
            <div className="flex flex-col gap-3">{renderGroups(groups.slice(OPEN_GROUPS))}</div>
          </details>
        ) : null}
      </div>
    </main>
  );
}
