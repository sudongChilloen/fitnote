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
    <main className="mx-auto w-full max-w-md px-5 pt-6 pb-28">
      <Link
        href={`/diet?date=${dateKey}`}
        className="-ml-1 inline-flex items-center gap-0.5 text-sm text-muted-foreground"
      >
        <ChevronLeft className="size-4" aria-hidden />
        식단
      </Link>

      <h1 className="mt-2 text-xl font-bold">식단 남기기</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {formatKstDateLabel(new Date(`${dateKey}T00:00:00+09:00`))}
      </p>

      {message ? (
        <p
          role="alert"
          className="mt-4 rounded-xl bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive"
        >
          {message}
        </p>
      ) : null}

      <form action={createDietRecord} className="mt-5">
        <input type="hidden" name="date" value={dateKey} />

        <fieldset>
          <legend className="text-sm font-bold">끼니</legend>
          {/* 라디오라 자바스크립트 없이도 고를 수 있다. 하나는 반드시 켜져 있다. */}
          <div className="mt-2 flex flex-wrap gap-2">
            {MEAL_ORDER.map((meal) => (
              <label key={meal} className="cursor-pointer">
                <input
                  type="radio"
                  name="mealType"
                  value={meal}
                  defaultChecked={meal === selected}
                  className="peer sr-only"
                />
                <span className="flex h-11 items-center rounded-xl border border-border px-4 text-sm font-semibold peer-checked:border-brand-strong peer-checked:bg-accent peer-checked:text-brand-strong peer-focus-visible:ring-2 peer-focus-visible:ring-brand-strong">
                  {MEAL_LABEL[meal]}
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="mt-5">
          <DietPhotoPicker />
        </div>

        <div className="mt-5">
          <label htmlFor="foodName" className="text-sm font-bold">
            무엇을 먹었나요
          </label>
          <input
            id="foodName"
            name="foodName"
            type="text"
            maxLength={100}
            placeholder="현미밥, 닭가슴살, 샐러드"
            className="mt-2 h-13 w-full rounded-xl border border-border bg-card px-4 text-sm"
          />
        </div>

        <div className="mt-5">
          <label htmlFor="memo" className="text-sm font-bold">
            메모
            <span className="ml-1 font-normal text-muted-foreground">
              (선택)
            </span>
          </label>
          <textarea
            id="memo"
            name="memo"
            rows={3}
            maxLength={500}
            placeholder="운동 전에 먹었어요"
            className="mt-2 w-full rounded-xl border border-border bg-card p-4 text-sm"
          />
        </div>

        <SubmitDietButton />
      </form>

      <p className="mt-3 text-center text-xs text-muted-foreground">
        칼로리는 받지 않아요. 사진과 한 줄이면 트레이너가 볼 수 있어요.
      </p>
    </main>
  );
}
