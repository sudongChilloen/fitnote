import Link from "next/link";

import { Camera, ChevronLeft, ChevronRight, UtensilsCrossed } from "lucide-react";

import { requireUser } from "@/app/lib/dal";
import { formatKstDateLabel, formatKstTimeLabel, toKstDateKey } from "@/lib/date";
import {
  getDietByDate,
  getLatestFeedbacks,
  MEAL_LABEL,
  parseDateKey,
} from "@/server/diet/diet.service";
import { getMySharing } from "@/server/sharing/sharing.service";


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

  const [records, sharing] = await Promise.all([
    getDietByDate(user.id, dateKey),
    getMySharing(user.id),
  ]);
  const feedbacks = await getLatestFeedbacks(records.map((record) => record.id));
  const doneMeals = new Set(records.map((record) => record.mealType));
  const visibleTo =
    sharing && sharing.setting.shareDiet
      ? sharing.trainerName
        ? `${sharing.trainerName} 트레이너가 볼 수 있어요`
        : "담당 트레이너가 정해지면 볼 수 있어요"
      : sharing
        ? "지금은 트레이너에게 보이지 않아요"
        : null;

  const prev = shiftDay(dateKey, -1);
  const next = shiftDay(dateKey, 1);
  // 내일 식단을 미리 적을 일은 없다. 앞으로 가는 길을 열어두면 빈 화면만 나온다.
  const canGoNext = dateKey < today;

  return (
    <main className="mx-auto w-full max-w-md pb-28">
      <header className="flex items-center gap-2.5 px-4 pt-3.5 pb-2">
        <Link
          href="/home"
          aria-label="홈으로"
          className="flex size-10 shrink-0 items-center justify-center rounded-full border border-border text-ink"
        >
          <ChevronLeft className="size-4.5" aria-hidden />
        </Link>
        <h1 className="min-w-0 flex-1 text-[1.0625rem] font-bold">식단</h1>
        <Link
          href={`/calendar?date=${dateKey}`}
          className="flex h-9 shrink-0 items-center rounded-full border border-border px-3.5 text-[0.8125rem] font-bold"
        >
          캘린더
        </Link>
      </header>

      <div className="flex flex-col gap-3 px-4 pt-1.5">
        <nav aria-label="날짜 이동" className="flex items-center gap-2">
          <Link
            href={`/diet?date=${prev}`}
            aria-label="이전 날"
            className="flex size-9.5 shrink-0 items-center justify-center rounded-full border border-border text-ink"
          >
            <ChevronLeft className="size-4" aria-hidden />
          </Link>
          <p className="min-w-0 flex-1 truncate text-center">
            <b className="text-base">{formatKstDateLabel(new Date(`${dateKey}T00:00:00+09:00`))}</b>
            {dateKey === today ? (
              <span className="ml-1 rounded-full bg-brand-muted px-2 py-0.5 text-[0.6875rem] font-bold text-primary">
                오늘
              </span>
            ) : null}
          </p>
          {canGoNext ? (
            <Link
              href={`/diet?date=${next}`}
              aria-label="다음 날"
              className="flex size-9.5 shrink-0 items-center justify-center rounded-full border border-border text-ink"
            >
              <ChevronRight className="size-4" aria-hidden />
            </Link>
          ) : (
            <span
              aria-hidden
              className="flex size-9.5 shrink-0 items-center justify-center rounded-full border border-border text-[#c4cbc7]"
            >
              <ChevronRight className="size-4" />
            </span>
          )}
        </nav>

        {/* 하루 요약: 몇 끼 남겼는지 + 아침·점심·저녁·간식 칸 */}
        <section className="rounded-[1.375rem] bg-primary px-4.5 py-4 text-white">
          <div className="flex items-end justify-between gap-2">
            <span className="shrink-0">
              <span className="block text-xs text-white/75">
                {dateKey === today ? "오늘" : "이 날"} 남긴 식단
              </span>
              <b className="text-[2rem] leading-tight tabular-nums">
                {records.length}
                <span className="text-sm font-semibold">끼</span>
              </b>
            </span>
            {visibleTo ? (
              <Link href="/profile/sharing" className="min-w-0 truncate text-[0.6875rem] text-white/75">
                {visibleTo}
              </Link>
            ) : null}
          </div>
          <div className="mt-3 grid grid-cols-4 gap-1.5">
            {(["BREAKFAST", "LUNCH", "DINNER", "SNACK"] as const).map((meal) => (
              <span
                key={meal}
                className={
                  doneMeals.has(meal)
                    ? "flex h-8.5 items-center justify-center rounded-full bg-brand text-xs font-bold text-ink"
                    : "flex h-8.5 items-center justify-center rounded-full bg-white/12 text-xs font-bold text-white/70"
                }
              >
                {MEAL_LABEL[meal]}
              </span>
            ))}
          </div>
        </section>

        <Link
          href={`/diet/new?date=${dateKey}`}
          className="flex h-13 w-full items-center justify-center gap-2 rounded-full bg-ink text-[0.9375rem] font-bold text-white"
        >
          <Camera className="size-4.5" aria-hidden />
          식단 남기기
        </Link>

        {records.length === 0 ? (
          <div className="rounded-[1.25rem] border border-dashed border-border p-6 text-center">
            <span className="mx-auto flex size-10 items-center justify-center rounded-xl bg-surface text-muted-foreground">
              <UtensilsCrossed className="size-5" aria-hidden />
            </span>
            <p className="mt-3 text-sm font-bold">아직 남긴 식단이 없어요</p>
            <p className="mt-1 text-xs text-muted-foreground">사진 한 장이면 충분해요.</p>
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {records.map((record) => {
              const feedback = feedbacks.get(record.id);
              return (
                <li key={record.id}>
                  <Link
                    href={`/diet/${record.id}`}
                    className="block overflow-hidden rounded-[1.25rem] border border-border"
                  >
                    {record.thumbnailUrl ? (
                      // 서명 주소는 열 때마다 값이 달라 이미지 최적화 캐시가 매번 빗나간다.
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={record.imageUrl ?? record.thumbnailUrl}
                        alt=""
                        loading="lazy"
                        className="h-37.5 w-full bg-line object-cover"
                      />
                    ) : null}
                    <span className="block px-3.5 py-3">
                      <span className="flex items-center gap-2">
                        <span className="shrink-0 rounded-full border border-brand px-2 py-px text-[0.6875rem] font-bold text-primary">
                          {MEAL_LABEL[record.mealType]}
                        </span>
                        <b className="min-w-0 flex-1 truncate text-[0.9375rem]">
                          {record.foodName ?? (record.hasPhoto ? "사진으로 남겼어요" : "식단")}
                        </b>
                        <span className="shrink-0 text-[0.6875rem] text-faint tabular-nums">
                          {formatKstTimeLabel(record.createdAt)}
                        </span>
                      </span>
                      {record.memo ? (
                        <span className="mt-1 block truncate text-xs text-muted-foreground">
                          {record.memo}
                        </span>
                      ) : null}
                      {feedback ? (
                        <span className="mt-2.5 flex gap-2 rounded-[0.875rem] bg-[#f7f8f7] px-3 py-2.5">
                          <span className="flex size-6.5 shrink-0 items-center justify-center rounded-full bg-brand-muted text-[0.6875rem] font-extrabold text-primary">
                            {feedback.trainerName.trim().slice(0, 1)}
                          </span>
                          <span className="line-clamp-2 min-w-0 flex-1 text-xs leading-normal text-[#2b3631]">
                            {feedback.content}
                            {record.feedbackCount > 1 ? ` 외 ${record.feedbackCount - 1}개` : ""}
                          </span>
                        </span>
                      ) : null}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </main>
  );
}
