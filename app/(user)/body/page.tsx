import Link from "next/link";

import { ChevronLeft, Plus, TrendingDown, X } from "lucide-react";

import { requireUser } from "@/app/lib/dal";
import { formatKstDateLabel } from "@/lib/date";
import { BODY_GOAL_TYPES, getBodyOverview, METRIC } from "@/server/body/body.service";

import { cancelGoalAction, deleteBodyRecordAction } from "./actions";
import { bodyErrorMessage } from "./messages";
import { ConfirmSubmit } from "./confirm-submit";
import { TrendChart } from "./trend-chart";

export const metadata = { title: "체성분 | FitNote" };

export default async function BodyPage({ searchParams }: PageProps<"/body">) {
  const user = await requireUser();
  const { error, metric } = await searchParams;

  const { records, trends, goals } = await getBodyOverview(user.id);
  const message = bodyErrorMessage(error);

  // 위 밑줄 탭으로 고른 지표. 주소로 들어오는 값이라 아는 값만 받는다.
  const selectedType =
    BODY_GOAL_TYPES.find((type) => type === metric) ?? BODY_GOAL_TYPES[0];
  const trend = trends.find((item) => item.type === selectedType) ?? trends[0];
  const trendGoal = goals.find((goal) => goal.type === selectedType) ?? null;

  return (
    <main className="pb-16">
      <header className="flex items-center gap-2.5 px-4 pt-3.5 pb-1.5">
        <Link
          href="/profile"
          aria-label="내 정보"
          className="flex size-10 shrink-0 items-center justify-center rounded-full border border-border text-ink"
        >
          <ChevronLeft className="size-4.5" aria-hidden />
        </Link>
        <h1 className="min-w-0 flex-1 text-[1.0625rem] font-bold">체성분</h1>
      </header>

      <nav
        aria-label="지표"
        className="mt-1.5 grid grid-cols-3 border-b border-line text-center"
      >
        {trends.map((item) => {
          const active = item.type === selectedType;
          return (
            <Link
              key={item.type}
              href={`/body?metric=${item.type}`}
              scroll={false}
              aria-current={active ? "page" : undefined}
              className={
                active
                  ? "flex h-11 items-center justify-center text-sm font-extrabold text-ink shadow-[inset_0_-3px_0_var(--primary)]"
                  : "flex h-11 items-center justify-center text-sm font-semibold text-faint"
              }
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="flex flex-col gap-3 px-4 pt-3.5">
        {message ? (
          <p className="rounded-[0.875rem] bg-status-urgent-bg px-4 py-3 text-xs font-medium text-status-urgent">
            {message}
          </p>
        ) : null}

        {records.length === 0 ? (
          <div className="rounded-[1.25rem] border border-border p-6 text-center">
            <TrendingDown className="mx-auto size-6 text-muted-foreground" aria-hidden />
            <p className="mt-3 text-sm font-bold">아직 잰 기록이 없어요</p>
            <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
              체중 하나만 적어도 돼요. 매일이 아니어도 괜찮고,
              <br />
              같은 조건에서 재는 게 매일 재는 것보다 중요해요.
            </p>
          </div>
        ) : (
          <>
            <article className="flex items-end justify-between gap-2 px-1">
              <span className="min-w-0">
                <span className="block text-xs text-muted-foreground">
                  {trend.label} ·{" "}
                  {trend.latestAt ? `${formatKstDateLabel(trend.latestAt)} 기준` : "아직 안 쟀어요"}
                </span>
                <b className="text-[2rem] tracking-tight tabular-nums">
                  {trend.latest ?? "-"}
                  <span className="text-sm font-semibold">{trend.unit}</span>
                </b>
              </span>
              {trend.delta !== null ? (
                <span className="shrink-0 rounded-full border-[1.5px] border-brand px-2.75 py-1 text-xs font-bold text-primary tabular-nums">
                  {trend.delta === 0
                    ? "지난번과 같아요"
                    : `지난번보다 ${trend.delta > 0 ? "+" : "-"}${Math.abs(trend.delta)}${trend.unit}`}
                </span>
              ) : null}
            </article>

            <section className="rounded-[1.25rem] bg-[#f7f8f7] pt-3.5 pr-2.5 pb-2 pl-1.5">
              <TrendChart trend={trend} goal={trendGoal?.targetValue ?? null} />
            </section>
          </>
        )}

        <Link
          href="/body/new"
          className="flex h-12.5 items-center justify-center gap-1 rounded-full bg-primary text-[0.9375rem] font-extrabold text-white"
        >
          <Plus className="size-4" aria-hidden />
          {records.length === 0 ? "첫 기록 남기기" : "오늘 기록 남기기"}
        </Link>

        {records.length > 0 ? (
          <div className="grid grid-cols-3 gap-2">
            {trends.map((item) => (
              <Link
                key={item.type}
                href={`/body?metric=${item.type}`}
                scroll={false}
                className={`min-w-0 rounded-2xl border px-2.5 py-2.5 ${
                  item.type === selectedType ? "border-primary" : "border-border"
                }`}
              >
                <article>
                <span className="block text-[0.6875rem] text-muted-foreground">{item.label}</span>
                <b className="block truncate text-[1.0625rem] tabular-nums">
                  {item.latest ?? "-"}
                  <span className="text-[0.6875rem] font-semibold">{item.latest !== null ? item.unit : ""}</span>
                </b>
                <span className="block text-[0.6875rem] font-bold text-primary tabular-nums">
                  {item.delta === null || item.delta === 0
                    ? "\u00a0"
                    : `${item.delta > 0 ? "▲" : "▼"}${Math.abs(item.delta)}`}
                </span>
                </article>
              </Link>
            ))}
          </div>
        ) : null}

        <section className="rounded-[1.25rem] border border-border px-4 py-3.5">
          <div className="flex items-center justify-between gap-2">
            <b className="text-[0.9375rem]">목표</b>
            <Link href="/body/goal" className="shrink-0 text-xs font-bold text-primary">
              + 목표 정하기
            </Link>
          </div>

          {goals.length === 0 ? (
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              목표를 정해두면 지금 값이 자동으로 따라와요. 체중·체지방률·골격근량 중 원하는 것만
              정하면 돼요.
            </p>
          ) : (
            <ul className="flex flex-col">
              {goals.map((goal, index) => (
                <li key={goal.id} className={`pt-2.5 ${index > 0 ? "mt-2.5 border-t border-line" : ""}`}>
                  <div className="flex items-baseline justify-between gap-2">
                    <b className="min-w-0 truncate text-sm">
                      {goal.label} {goal.targetValue}
                      {goal.unit}
                    </b>
                    <span className="shrink-0 text-xs font-bold text-primary tabular-nums">
                      {goal.reached
                        ? "달성"
                        : goal.progress !== null
                          ? `${Math.round(goal.progress * 100)}% 달성`
                          : goal.remaining !== null
                            ? `${goal.remaining}${goal.unit} 남음`
                            : ""}
                    </span>
                  </div>

                  {goal.progress !== null ? (
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-line">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-[#9fdcc4] to-primary"
                        style={{ width: `${Math.round(goal.progress * 100)}%` }}
                      />
                    </div>
                  ) : null}

                  <p className="mt-2 text-xs leading-normal text-muted-foreground tabular-nums">
                    {goal.startValue !== null
                      ? `${goal.startValue}${goal.unit}에서 시작`
                      : "시작할 때 잰 값이 없어요"}
                    {goal.currentValue !== null
                      ? ` · 지금 ${goal.currentValue}${goal.unit}`
                      : " · 아직 잰 값이 없어요"}
                    {!goal.reached && goal.progress !== null && goal.remaining !== null
                      ? ` · ${goal.remaining}${goal.unit} 남음`
                      : ""}
                    {goal.targetDate ? ` · ${formatKstDateLabel(goal.targetDate)}까지` : ""}
                  </p>

                  <form action={cancelGoalAction} className="mt-1.5">
                    <input type="hidden" name="goalId" value={goal.id} />
                    <ConfirmSubmit
                      confirm="이 목표를 그만둘까요?"
                      className="text-xs text-faint underline"
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
          <section>
            <h2 className="mx-1 mt-1 text-base font-extrabold">기록</h2>

            <ul className="flex flex-col">
              {records.map((record) => {
                const kst = new Date(record.recordedAt.getTime() + 9 * 60 * 60 * 1000);
                const rest = [
                  record.bodyFatPercent !== null
                    ? `${METRIC.BODY_FAT.label} ${record.bodyFatPercent}%`
                    : null,
                  record.skeletalMuscleKg !== null
                    ? `${METRIC.MUSCLE_MASS.label} ${record.skeletalMuscleKg}kg`
                    : null,
                  record.waistCm !== null ? `허리 ${record.waistCm}cm` : null,
                  record.memo,
                ].filter(Boolean);
                return (
                  <li
                    key={record.id}
                    className="flex items-center gap-2.5 border-b border-line px-1 py-2.75"
                  >
                    <span className="w-12.5 shrink-0 text-xs font-bold text-muted-foreground tabular-nums">
                      {String(kst.getUTCMonth() + 1).padStart(2, "0")}.
                      {String(kst.getUTCDate()).padStart(2, "0")}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[0.8125rem] tabular-nums">
                      {record.weightKg !== null ? <b>{record.weightKg}kg</b> : null}
                      {record.weightKg !== null && rest.length > 0 ? " · " : ""}
                      {rest.join(" · ")}
                    </span>
                    <form action={deleteBodyRecordAction} className="shrink-0">
                      <input type="hidden" name="recordId" value={record.id} />
                      <ConfirmSubmit
                        confirm={`${formatKstDateLabel(record.recordedAt)} 기록을 지울까요?`}
                        className="flex size-7 items-center justify-center rounded-full text-[#8a938e] hover:bg-surface"
                        label={`${formatKstDateLabel(record.recordedAt)} 기록 지우기`}
                      >
                        <X className="size-3.5" aria-hidden />
                      </ConfirmSubmit>
                    </form>
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}
      </div>
    </main>
  );
}
