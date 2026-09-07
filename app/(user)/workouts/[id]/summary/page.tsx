import { Trophy } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { requireUser } from "@/app/lib/dal";
import { formatKstDateLabel } from "@/lib/date";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getSessionSummary } from "@/server/workouts/workout.service";

export const metadata = {
  title: "운동 요약 | FitNote",
};

const ctaClass = "h-12 w-full rounded-xl font-bold";

export default async function WorkoutSummaryPage({
  params,
}: PageProps<"/workouts/[id]/summary">) {
  const user = await requireUser();
  const { id } = await params;

  const summary = await getSessionSummary(user.id, id);

  if (!summary) {
    notFound();
  }

  // 아직 하는 중이거나 취소한 운동은 보여줄 성과가 없다.
  // 요약 주소를 직접 열었을 때 빈 화면 대신 기록 화면으로 돌려보낸다.
  if (summary.status !== "COMPLETED") {
    redirect(`/workouts/${id}`);
  }

  const manual = summary.entryMode === "MANUAL";

  return (
    <main className="flex flex-col gap-4 px-5 pt-8 pb-8">
      <header className="text-center">
        <p className="text-sm text-muted-foreground">
          {formatKstDateLabel(summary.startedAt)}
        </p>
        <h1 className="mt-1 text-2xl font-bold">
          {manual ? "기록을 저장했어요" : "운동을 마쳤어요"}
        </h1>
      </header>

      {summary.prCount > 0 ? (
        <p className="flex items-center justify-center gap-1.5 rounded-2xl bg-accent px-4 py-3 text-sm font-semibold text-brand-strong">
          <Trophy className="size-4" aria-hidden />
          신기록 {summary.prCount}개를 세웠어요
        </p>
      ) : null}

      <section className="rounded-2xl border border-border bg-card p-5">
        <dl className="grid grid-cols-3 gap-2 text-center">
          <div>
            <dt className="text-xs text-muted-foreground">시간</dt>
            <dd className="mt-1 text-lg font-bold tabular-nums">
              {summary.durationSec !== null ? (
                // 1분 미만도 "0분" 보다는 "1분" 이 덜 이상하다.
                `${Math.max(1, Math.round(summary.durationSec / 60))}분`
              ) : (
                // 몰아서 입력한 기록에는 실제 운동 시간이 없다.
                <span className="text-muted-foreground">—</span>
              )}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">세트</dt>
            <dd className="mt-1 text-lg font-bold tabular-nums">
              {summary.countedSets}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">볼륨</dt>
            <dd className="mt-1 text-lg font-bold tabular-nums">
              {summary.totalVolume.toLocaleString()}
              <span className="ml-0.5 text-xs font-medium text-muted-foreground">
                kg
              </span>
            </dd>
          </div>
        </dl>

        {summary.skippedSets > 0 ? (
          <p className="mt-3 border-t border-border pt-3 text-center text-xs text-muted-foreground">
            체크하지 않은 세트 {summary.skippedSets}개는 합계에서 뺐어요
          </p>
        ) : null}
      </section>

      {summary.records.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border px-5 py-10 text-center text-sm text-muted-foreground">
          기록한 운동이 없어요
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {summary.records.map((record) => (
            <li
              key={record.id}
              className="rounded-2xl border border-border bg-card p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-semibold">
                    {record.exercise.name}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">
                    {record.countedSets}세트 ·{" "}
                    {(record.totalVolume ?? 0).toLocaleString()}kg
                  </p>
                </div>

                {record.weightPr || record.oneRmPr ? (
                  <span className="shrink-0 rounded-full bg-accent px-2.5 py-1 text-xs font-semibold text-brand-strong">
                    신기록
                  </span>
                ) : record.firstTime ? (
                  <span className="shrink-0 rounded-full border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground">
                    첫 기록
                  </span>
                ) : null}
              </div>

              {record.topSet ? (
                <p className="mt-2 text-sm tabular-nums">
                  최고 세트{" "}
                  <span className="font-semibold">
                    {record.topSet.weight}kg × {record.topSet.reps}회
                  </span>
                  {record.oneRm !== null ? (
                    <span className="text-muted-foreground">
                      {" · "}추정 1RM {record.oneRm}kg
                    </span>
                  ) : null}
                </p>
              ) : null}

              {record.weightPr &&
              record.previousBestWeight !== null &&
              record.topSet ? (
                <p className="mt-1 text-xs font-medium text-brand-strong tabular-nums">
                  이전 최고 {record.previousBestWeight}kg에서{" "}
                  {Math.round(
                    (record.topSet.weight - record.previousBestWeight) * 10,
                  ) / 10}
                  kg 올랐어요
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-col gap-2 pt-1">
        <Link href="/home" className={cn(buttonVariants(), ctaClass)}>
          홈으로
        </Link>
        <Link
          href={`/workouts/${summary.id}`}
          className={cn(buttonVariants({ variant: "outline" }), ctaClass)}
        >
          기록 수정
        </Link>
      </div>
    </main>
  );
}
