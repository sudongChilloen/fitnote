import Link from "next/link";

import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  Plus,
  UtensilsCrossed,
} from "lucide-react";

import { requireUser } from "@/app/lib/dal";
import { formatKstDateLabel, toKstDateKey } from "@/lib/date";
import {
  getDietByDate,
  MEAL_LABEL,
  parseDateKey,
} from "@/server/diet/diet.service";

import { DietSharingNotice } from "./diet-sharing-notice";

export const metadata = { title: "식단 | FitNote" };

function shiftDay(dateKey: string, days: number) {
  const date = new Date(`${dateKey}T00:00:00+09:00`);
  date.setUTCDate(date.getUTCDate() + days);
  return toKstDateKey(date);
}

export default async function DietPage({ searchParams }: PageProps<"/diet">) {
  const user = await requireUser();

  const { date } = await searchParams;
  const dateKey = parseDateKey(date);
  const today = toKstDateKey(new Date());

  const records = await getDietByDate(user.id, dateKey);

  const prev = shiftDay(dateKey, -1);
  const next = shiftDay(dateKey, 1);
  // 내일 식단을 미리 적을 일은 없다. 앞으로 가는 길을 열어두면 빈 화면만 나온다.
  const canGoNext = dateKey < today;

  return (
    <main className="mx-auto w-full max-w-md px-5 pt-6 pb-28">
      <div className="flex items-baseline justify-between">
        <h1 className="text-xl font-bold">식단</h1>
        <Link
          href={`/calendar?date=${dateKey}`}
          className="flex items-center gap-1 text-sm text-muted-foreground"
        >
          <CalendarDays className="size-3.5" aria-hidden />
          캘린더
        </Link>
      </div>

      <nav
        aria-label="날짜 이동"
        className="mt-4 flex items-center justify-between rounded-2xl border border-border bg-card px-2 py-2"
      >
        <Link
          href={`/diet?date=${prev}`}
          aria-label="이전 날"
          className="flex size-10 items-center justify-center rounded-xl text-muted-foreground"
        >
          <ChevronLeft className="size-5" aria-hidden />
        </Link>

        <p className="text-sm font-bold">
          {dateKey === today
            ? "오늘"
            : formatKstDateLabel(new Date(`${dateKey}T00:00:00+09:00`))}
        </p>

        {canGoNext ? (
          <Link
            href={`/diet?date=${next}`}
            aria-label="다음 날"
            className="flex size-10 items-center justify-center rounded-xl text-muted-foreground"
          >
            <ChevronRight className="size-5" aria-hidden />
          </Link>
        ) : (
          <span className="size-10" />
        )}
      </nav>

      <div className="mt-3">
        <DietSharingNotice userId={user.id} />
      </div>

      <Link
        href={`/diet/new?date=${dateKey}`}
        className="mt-4 flex h-13 w-full items-center justify-center gap-1.5 rounded-xl bg-primary text-sm font-bold text-primary-foreground"
      >
        <Plus className="size-4" aria-hidden />
        식단 남기기
      </Link>

      {records.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-dashed border-border p-6 text-center">
          <span className="mx-auto flex size-10 items-center justify-center rounded-xl bg-secondary text-muted-foreground">
            <UtensilsCrossed className="size-5" aria-hidden />
          </span>
          <p className="mt-3 text-sm font-bold">아직 남긴 식단이 없어요</p>
          <p className="mt-1 text-xs text-muted-foreground">
            사진 한 장이면 충분해요.
          </p>
        </div>
      ) : (
        <ul className="mt-4 flex flex-col gap-2">
          {records.map((record) => (
            <li key={record.id}>
              <Link
                href={`/diet/${record.id}`}
                className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3"
              >
                {record.thumbnailUrl ? (
                  // 서명 주소는 열 때마다 값이 달라 이미지 최적화 캐시가 매번 빗나간다.
                  // 올릴 때 이미 줄여서 저장하므로 최적화로 얻을 것도 없다.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={record.thumbnailUrl}
                    alt=""
                    loading="lazy"
                    className="size-16 shrink-0 rounded-xl bg-secondary object-cover"
                  />
                ) : (
                  <span className="flex size-16 shrink-0 items-center justify-center rounded-xl bg-secondary text-muted-foreground">
                    <UtensilsCrossed className="size-5" aria-hidden />
                  </span>
                )}

                <span className="min-w-0 flex-1">
                  <span className="text-xs font-bold text-brand-strong">
                    {MEAL_LABEL[record.mealType]}
                  </span>
                  <span className="mt-0.5 block truncate text-sm font-bold">
                    {record.foodName ?? record.memo ?? "사진만 남겼어요"}
                  </span>
                  {record.feedbackCount > 0 ? (
                    <span className="mt-1 flex items-center gap-1 text-xs text-brand-strong">
                      <MessageSquare className="size-3" aria-hidden />
                      트레이너 피드백 {record.feedbackCount}
                    </span>
                  ) : null}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
