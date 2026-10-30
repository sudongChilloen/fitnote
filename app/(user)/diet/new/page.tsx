import Link from "next/link";

import { ChevronLeft } from "lucide-react";

import { requireUser } from "@/app/lib/dal";
import { formatKstDateLabel } from "@/lib/date";
import {
  guessMealType,
  MEAL_LABEL,
  MEAL_ORDER,
  parseDateKey,
  parseMealType,
} from "@/server/diet/diet.service";

import { createDietRecord } from "../actions";
import { DietPhotoPicker } from "./diet-photo-picker";
import { SubmitDietButton } from "./submit-diet-button";

export const metadata = { title: "식단 남기기 | FitNote" };

const ERROR_TEXT: Record<string, string> = {
  empty: "사진을 올리거나 무엇을 먹었는지 적어주세요.",
  storage: "사진 저장소에 문제가 있어요. 사진 없이 먼저 남겨보세요.",
  unknown: "남기지 못했어요. 잠시 후 다시 시도해주세요.",
};

export default async function NewDietPage({
  searchParams,
}: PageProps<"/diet/new">) {
  await requireUser();

  const { date, meal, error } = await searchParams;

  const dateKey = parseDateKey(date);
  // 주소로 넘어온 끼니가 우선이고, 없으면 지금 시각으로 짐작한다.
  const selected = parseMealType(meal) ?? guessMealType();
  const message = typeof error === "string" ? ERROR_TEXT[error] : undefined;

  return (
    <main className="mx-auto w-full max-w-md pb-28">
      <header className="flex items-center gap-2.5 px-4 pt-3.5 pb-2">
        <Link
          href={`/diet?date=${dateKey}`}
          aria-label="식단으로"
          className="flex size-10 shrink-0 items-center justify-center rounded-full border border-border text-ink"
        >
          <ChevronLeft className="size-4.5" aria-hidden />
        </Link>
        <span className="min-w-0 flex-1">
          <h1 className="text-[1.0625rem] font-bold">식단 남기기</h1>
          <p className="truncate text-xs text-muted-foreground">
            {formatKstDateLabel(new Date(`${dateKey}T00:00:00+09:00`))}
          </p>
        </span>
      </header>

      <form action={createDietRecord} className="flex flex-col gap-4 px-4 pt-1.5">
        <input type="hidden" name="date" value={dateKey} />

        {message ? (
          <p
            role="alert"
            className="rounded-[0.875rem] bg-status-urgent-bg px-4 py-3 text-sm font-medium text-status-urgent"
          >
            {message}
          </p>
        ) : null}

        <DietPhotoPicker />

        <fieldset>
          <legend className="mx-1 mb-1.5 text-[0.8125rem] font-bold">끼니</legend>
          {/* 라디오라 자바스크립트 없이도 고를 수 있다. 하나는 반드시 켜져 있다. */}
          <div
            className="grid gap-1.5"
            style={{ gridTemplateColumns: `repeat(${MEAL_ORDER.length}, minmax(0, 1fr))` }}
          >
            {MEAL_ORDER.map((meal) => (
              <label key={meal} className="min-w-0 cursor-pointer">
                <input
                  type="radio"
                  name="mealType"
                  value={meal}
                  defaultChecked={meal === selected}
                  className="peer sr-only"
                />
                <span className="flex h-10.5 items-center justify-center rounded-full border border-border text-[0.8125rem] font-bold whitespace-nowrap peer-checked:border-ink peer-checked:bg-ink peer-checked:text-white peer-focus-visible:ring-2 peer-focus-visible:ring-ring">
                  {MEAL_LABEL[meal]}
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <div>
          <label htmlFor="foodName" className="mx-1 mb-1.5 block text-[0.8125rem] font-bold">
            무엇을 먹었나요
          </label>
          <input
            id="foodName"
            name="foodName"
            type="text"
            maxLength={100}
            placeholder="현미밥, 닭가슴살, 샐러드"
            className="h-12 w-full rounded-2xl border border-border bg-card px-3.5 text-sm outline-none focus:ring-2 focus:ring-ring/40"
          />
        </div>

        <div>
          <label htmlFor="memo" className="mx-1 mb-1.5 block text-[0.8125rem] font-bold">
            메모 <span className="font-normal text-faint">(선택)</span>
          </label>
          <textarea
            id="memo"
            name="memo"
            rows={3}
            maxLength={500}
            placeholder="운동 전에 먹었어요"
            className="h-22 w-full resize-none rounded-2xl border border-border bg-card px-3.5 py-3 text-sm outline-none focus:ring-2 focus:ring-ring/40"
          />
        </div>

        <p className="mx-1 text-xs leading-normal text-muted-foreground">
          칼로리는 받지 않아요. 사진과 한 줄이면 트레이너가 볼 수 있어요.
        </p>

        <SubmitDietButton />
      </form>
    </main>
  );
}
