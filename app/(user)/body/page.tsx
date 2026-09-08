import Link from "next/link";

import { ChevronLeft, Plus, Target, Trash2, TrendingDown } from "lucide-react";

import { requireUser } from "@/app/lib/dal";
import { formatKstDateLabel } from "@/lib/date";
import { getBodyOverview, METRIC } from "@/server/body/body.service";

import { cancelGoalAction, deleteBodyRecordAction } from "./actions";
import { bodyErrorMessage } from "./messages";
import { ConfirmSubmit } from "./confirm-submit";
import { TrendChart } from "./trend-chart";

export const metadata = { title: "체성분 | FitNote" };

/** 숫자 뒤에 단위를 붙인다. 소수 한 자리까지만 둔다. */
function value(n: number | null, unit: string) {
  return n === null ? "-" : `${n}${unit}`;
}

export default async function BodyPage({ searchParams }: PageProps<"/body">) {
  const user = await requireUser();
  const { error } = await searchParams;

  const { records, trends, goals } = await getBodyOverview(user.id);
  const message = bodyErrorMessage(error);

  const measured = trends.filter((trend) => trend.latest !== null);

  return (
    <main className="px-5 pt-8 pb-16">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-bold tracking-tight">체성분</h1>

        <Link
          href="/body/new"
          className="inline-flex h-9 items-center gap-1 rounded-full bg-brand px-3.5 text-sm font-bold text-brand-foreground"
        >
          <Plus className="size-4" aria-hidden />
          기록
        </Link>
      </div>

      {message ? (
        <p className="mt-4 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-xs font-medium text-destructive">
          {message}
        </p>
      ) : null}

      {records.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-border bg-card p-6 text-center">
          <TrendingDown
            className="mx-auto size-6 text-muted-foreground"
            aria-hidden
          />
          <p className="mt-3 text-sm font-bold">아직 잰 기록이 없어요</p>
          <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
            체중 하나만 적어도 돼요. 매일이 아니어도 괜찮고,
            <br />
            같은 조건에서 재는 게 매일 재는 것보다 중요해요.
          </p>
          <Link
            href="/body/new"
            className="mt-4 inline-flex h-10 items-center rounded-xl bg-brand px-4 text-sm font-bold text-brand-foreground"
          >
            첫 기록 남기기
          </Link>
        </div>
      ) : (
        <section className="mt-5 flex flex-col gap-3">
          {measured.map((trend) => (
            <article
              key={trend.type}
              className="rounded-2xl border border-border bg-card p-4"
            >
              <div className="flex items-baseline justify-between gap-2">
                <h2 className="text-sm font-bold">{trend.label}</h2>

                <p className="text-xl font-bold tabular-nums">
                  {value(trend.latest, trend.unit)}
                </p>
              </div>

              <div className="mt-1 flex items-baseline justify-between gap-2 text-xs text-muted-foreground">
                <span>
                  {trend.latestAt
                    ? `${formatKstDateLabel(trend.latestAt)} 기준`
                    : ""}
                </span>

                {trend.delta === null ? (
                  <span>지난번과 비교하려면 한 번 더 재주세요</span>
                ) : trend.delta === 0 ? (
                  <span>지난번과 같아요</span>
                ) : (
                  <span className="font-bold tabular-nums">
                    지난번보다 {trend.delta > 0 ? "+" : ""}
                    {trend.delta}
                    {trend.unit}
                  </span>
                )}
              </div>

              <TrendChart trend={trend} />
            </article>
          ))}
        </section>
      )}

      <section className="mt-8">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-base font-bold">목표</h2>

          <Link
            href="/body/goal"
            className="inline-flex h-8 items-center gap-1 rounded-full border border-border px-3 text-xs font-bold"
          >
            <Target className="size-3.5" aria-hidden />
            목표 정하기
          </Link>
        </div>

        {goals.length === 0 ? (
          <p className="mt-2 rounded-2xl border border-border bg-card p-4 text-xs leading-relaxed text-muted-foreground">
            목표를 정해두면 지금 값이 자동으로 따라와요. 체중·체지방률·골격근량
            중 원하는 것만 정하면 돼요.
          </p>
        ) : (
          <ul className="mt-2 flex flex-col gap-2.5">
            {goals.map((goal) => (
              <li
                key={goal.id}
                className="rounded-2xl border border-border bg-card p-4"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-sm font-bold">
                    {goal.label} {goal.targetValue}
                    {goal.unit}
                  </p>

                  {goal.reached ? (
                    <span className="shrink-0 rounded-full bg-brand/15 px-2.5 py-0.5 text-xs font-bold text-brand-strong">
                      달성
                    </span>
                  ) : goal.remaining !== null ? (
                    <span className="shrink-0 text-sm font-bold text-brand-strong tabular-nums">
                      {goal.remaining}
                      {goal.unit} 남음
                    </span>
                  ) : null}
                </div>

                {goal.progress !== null ? (
                  <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-secondary">
                    <div
                      className="h-full rounded-full bg-brand"
                      style={{ width: `${Math.round(goal.progress * 100)}%` }}
                    />
                  </div>
                ) : null}

                <p className="mt-2 text-xs text-muted-foreground tabular-nums">
                  {goal.startValue !== null
                    ? `${goal.startValue}${goal.unit}에서 시작`
                    : "시작할 때 잰 값이 없어요"}
                  {goal.currentValue !== null
                    ? ` · 지금 ${goal.currentValue}${goal.unit}`
                    : " · 아직 잰 값이 없어요"}
                  {goal.targetDate
                    ? ` · ${formatKstDateLabel(goal.targetDate)}까지`
                    : ""}
                </p>

                <form action={cancelGoalAction} className="mt-2.5">
                  <input type="hidden" name="goalId" value={goal.id} />
                  <ConfirmSubmit
                    confirm="이 목표를 그만둘까요?"
                    className="text-xs font-semibold text-muted-foreground"
                  >
                    목표 그만두기
                  </ConfirmSubmit>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>

      {records.length > 0 ? (
        <section className="mt-8">
          <h2 className="text-base font-bold">기록</h2>

          <ul className="mt-2 flex flex-col gap-2">
            {records.map((record) => (
              <li
                key={record.id}
                className="rounded-2xl border border-border bg-card p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-bold">
                      {formatKstDateLabel(record.recordedAt)}
                    </p>

                    <p className="mt-1 text-xs text-muted-foreground tabular-nums">
                      {[
                        record.weightKg !== null
                          ? `${METRIC.WEIGHT.label} ${record.weightKg}kg`
                          : null,
                        record.bodyFatPercent !== null
                          ? `${METRIC.BODY_FAT.label} ${record.bodyFatPercent}%`
                          : null,
                        record.skeletalMuscleKg !== null
                          ? `${METRIC.MUSCLE_MASS.label} ${record.skeletalMuscleKg}kg`
                          : null,
                        record.waistCm !== null
                          ? `허리 ${record.waistCm}cm`
                          : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>

                    {record.memo ? (
                      <p className="mt-1.5 text-xs text-muted-foreground">
                        {record.memo}
                      </p>
                    ) : null}
                  </div>

                  <form action={deleteBodyRecordAction} className="shrink-0">
                    <input type="hidden" name="recordId" value={record.id} />
                    <ConfirmSubmit
                      confirm={`${formatKstDateLabel(record.recordedAt)} 기록을 지울까요?`}
                      className="flex size-8 items-center justify-center rounded-lg text-muted-foreground"
                      label="기록 지우기"
                    >
                      <Trash2 className="size-4" aria-hidden />
                    </ConfirmSubmit>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <Link
        href="/profile"
        className="mt-8 inline-flex items-center gap-1 text-sm text-muted-foreground"
      >
        <ChevronLeft className="size-4" aria-hidden />내 정보
      </Link>
    </main>
  );
}
