import { Trophy } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { requireUser } from "@/app/lib/dal";
import { formatKstDateLabel } from "@/lib/date";
import { EquipmentIcon } from "@/components/fitness/equipment-icon";
import { BODY_PART_LABEL } from "@/lib/exercise-labels";
import { cn } from "@/lib/utils";
import { getSessionSummary } from "@/server/workouts/workout.service";

export const metadata = {
  title: "운동 요약 | FitNote",
};

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
  const parts = [
    ...new Set(summary.records.map((record) => BODY_PART_LABEL[record.exercise.bodyPart])),
  ].slice(0, 3);

  return (
    <main className="flex flex-col gap-3.5 px-4 pt-8 pb-5">
      <header className="text-center">
        <span className="inline-flex size-21 items-center justify-center rounded-full bg-brand-muted text-primary">
          <Trophy className="size-10.5" strokeWidth={1.8} aria-hidden />
        </span>
        <h1 className="mt-3.5 text-2xl font-extrabold">
          {manual ? "기록을 저장했어요" : "운동을 마쳤어요"}
        </h1>
        <p className="mt-1 text-[0.8125rem] text-muted-foreground">
          {formatKstDateLabel(summary.startedAt)}
          {parts.length > 0 ? ` · ${parts.join("·")}` : ""}
        </p>
      </header>

      <dl className="mt-1.5 grid grid-cols-3 gap-2 text-center">
        <div className="min-w-0 rounded-[1.125rem] bg-[#f7f8f7] p-3">
          <dt className="text-[0.6875rem] text-muted-foreground">시간</dt>
          <dd className="truncate text-xl font-extrabold tabular-nums">
            {summary.durationSec !== null ? (
              // 1분 미만도 "0분" 보다는 "1분" 이 덜 이상하다.
              <>
                {Math.max(1, Math.round(summary.durationSec / 60))}
                <span className="text-[0.6875rem]">분</span>
              </>
            ) : (
              // 몰아서 입력한 기록에는 실제 운동 시간이 없다.
              <span className="text-muted-foreground">—</span>
            )}
          </dd>
        </div>
        <div className="min-w-0 rounded-[1.125rem] bg-[#f7f8f7] p-3">
          <dt className="text-[0.6875rem] text-muted-foreground">세트</dt>
          <dd className="truncate text-xl font-extrabold tabular-nums">{summary.countedSets}</dd>
        </div>
        <div className="min-w-0 rounded-[1.125rem] bg-primary p-3 text-white">
          <dt className="text-[0.6875rem] text-white/75">볼륨</dt>
          <dd className="truncate text-xl font-extrabold tabular-nums">
            {summary.totalVolume.toLocaleString()}
            <span className="text-[0.6875rem]">kg</span>
          </dd>
        </div>
      </dl>

      {summary.prCount > 0 || summary.skippedSets > 0 ? (
        <p className="text-center text-xs text-muted-foreground">
          {summary.prCount > 0 ? (
            <span className="font-bold text-primary">신기록 {summary.prCount}개를 세웠어요</span>
          ) : null}
          {summary.prCount > 0 && summary.skippedSets > 0 ? " · " : ""}
          {summary.skippedSets > 0
            ? `체크하지 않은 세트 ${summary.skippedSets}개는 합계에서 뺐어요`
            : ""}
        </p>
      ) : null}

      {summary.records.length === 0 ? (
        <p className="rounded-[1.375rem] border border-dashed border-border px-5 py-10 text-center text-sm text-muted-foreground">
          기록한 운동이 없어요
        </p>
      ) : (
        <ul className="rounded-[1.375rem] border border-border px-3.5 py-1.5">
          {summary.records.map((record, index) => {
            const badge =
              record.weightPr || record.oneRmPr ? "신기록" : record.firstTime ? "첫 기록" : null;
            return (
              <li
                key={record.id}
                className={cn("flex items-center gap-3 py-3", index > 0 && "border-t border-line")}
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-muted text-primary">
                  <EquipmentIcon name={record.exercise.name} className="size-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex min-w-0 items-center gap-1.5">
                    <Link
                      href={`/exercises/${record.exercise.id}`}
                      className="min-w-0 truncate text-sm font-bold"
                    >
                      {record.exercise.name}
                    </Link>
                    {badge ? (
                      <span className="shrink-0 rounded-full bg-primary px-2 py-px text-[0.6875rem] font-bold text-white">
                        {badge}
                      </span>
                    ) : null}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground tabular-nums">
                    {record.topSet
                      ? `${record.topSet.weight}kg × ${record.topSet.reps}회 · ${record.countedSets}세트`
                      : `${record.countedSets}세트`}
                    {record.weightPr && record.previousBestWeight !== null && record.topSet
                      ? ` · +${
                          Math.round((record.topSet.weight - record.previousBestWeight) * 10) / 10
                        }kg`
                      : ""}
                  </span>
                </span>
                <b className="shrink-0 text-[0.8125rem] tabular-nums">
                  {(record.totalVolume ?? 0).toLocaleString()}kg
                </b>
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-1 flex gap-2">
        <Link
          href={`/workouts/${summary.id}`}
          className="flex h-13 min-w-0 flex-1 items-center justify-center rounded-full border border-border text-sm font-bold"
        >
          기록 수정
        </Link>
        <Link
          href="/home"
          className="flex h-13 min-w-0 flex-1 items-center justify-center rounded-full bg-ink text-sm font-bold text-white"
        >
          홈으로
        </Link>
      </div>
    </main>
  );
}
