import Link from "next/link";

import { ChevronLeft } from "lucide-react";

import { requireUser } from "@/app/lib/dal";
import { toKstDateKey } from "@/lib/date";
import {
  BODY_GOAL_TYPES,
  getBodyOverview,
  METRIC,
  parseGoalType,
} from "@/server/body/body.service";

import { setGoalAction } from "../actions";
import { bodyErrorMessage } from "../messages";
import { SaveButton } from "../save-button";

export const metadata = { title: "목표 정하기 | FitNote" };

export default async function GoalPage({
  searchParams,
}: PageProps<"/body/goal">) {
  const user = await requireUser();
  const { error, type } = await searchParams;

  const { trends, goals } = await getBodyOverview(user.id);

  const selected = parseGoalType(type) ?? BODY_GOAL_TYPES[0];
  const message = bodyErrorMessage(error);
  const today = toKstDateKey(new Date());

  return (
    <main className="px-5 pt-8 pb-16">
      <Link
        href="/body"
        className="-ml-1 inline-flex items-center gap-1 text-sm text-muted-foreground"
      >
        <ChevronLeft className="size-4" aria-hidden />
        체성분
      </Link>

      <h1 className="mt-3 text-xl font-bold">목표 정하기</h1>
      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
        지금 값은 적지 않아도 돼요. 기록을 남기면 알아서 따라와요.
      </p>

      {message ? (
        <p className="mt-4 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-xs font-medium text-destructive">
          {message}
        </p>
      ) : null}

      {/*
        지표를 고르는 것은 라디오로 둔다. 어차피 셋뿐이라 접었다 펴는 것보다
        한눈에 보이는 편이 낫고, 지금 값을 옆에 붙여 목표를 정할 때 참고하게 한다.
      */}
      <form action={setGoalAction} className="mt-5 flex flex-col gap-4">
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1.5 text-sm font-bold">무엇을</legend>

          {BODY_GOAL_TYPES.map((goalType) => {
            const meta = METRIC[goalType];
            const trend = trends.find((row) => row.type === goalType);
            const existing = goals.find((goal) => goal.type === goalType);

            return (
              <label
                key={goalType}
                className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 has-checked:border-brand has-checked:bg-accent"
              >
                <input
                  type="radio"
                  name="type"
                  value={goalType}
                  defaultChecked={goalType === selected}
                  className="size-4"
                />

                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold">{meta.label}</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground tabular-nums">
                    {trend?.latest === null || trend === undefined
                      ? "아직 잰 값이 없어요"
                      : `지금 ${trend.latest}${meta.unit}`}
                    {existing
                      ? ` · 지금 목표 ${existing.targetValue}${meta.unit} (바꾸면 새로 시작해요)`
                      : ""}
                  </span>
                </span>
              </label>
            );
          })}
        </fieldset>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-bold">목표 값</span>
          <input
            name="targetValue"
            type="number"
            inputMode="decimal"
            step="0.1"
            required
            placeholder="예: 68"
            className="h-12 rounded-xl border border-border bg-card px-4 text-base tabular-nums"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-bold">
            언제까지{" "}
            <span className="font-medium text-muted-foreground">(선택)</span>
          </span>
          <input
            name="targetDate"
            type="date"
            min={today}
            className="h-12 rounded-xl border border-border bg-card px-4 text-base"
          />
        </label>

        <SaveButton className="mt-2">목표 세우기</SaveButton>
      </form>
    </main>
  );
}
