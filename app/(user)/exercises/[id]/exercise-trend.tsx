import Link from "next/link";

import { formatKstDateLabel } from "@/lib/date";
import { getExerciseTrend } from "@/server/workouts/workout.service";

/**
 * 운동 하나의 기록 추이.
 *
 * 그래프 라이브러리를 쓰지 않고 각 줄 뒤에 볼륨만큼 색을 깐다.
 * 점 몇 개짜리 꺾은선을 그리려고 번들을 키울 이유가 없고,
 * 값이 글자로 함께 보이므로 색을 못 봐도 읽을 수 있다.
 */
export async function ExerciseTrend({
  userId,
  exerciseId,
}: {
  userId: string;
  exerciseId: string;
}) {
  const trend = await getExerciseTrend(userId, exerciseId);

  if (trend.entries.length === 0) {
    return (
      <section className="rounded-2xl border border-border bg-card p-5">
        <h2 className="text-sm font-bold">내 기록</h2>
        <p className="mt-3 text-sm text-muted-foreground">
          아직 이 운동을 기록한 적이 없어요.
        </p>
      </section>
    );
  }

  const maxVolume = Math.max(...trend.entries.map((entry) => entry.volume), 1);

  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-bold">내 기록</h2>
        <span className="text-xs text-muted-foreground tabular-nums">
          총 {trend.totalCount}회
        </span>
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-2 text-center">
        <div className="rounded-xl bg-secondary px-3 py-2.5">
          <dt className="text-xs text-muted-foreground">최고 중량</dt>
          <dd className="mt-0.5 font-bold tabular-nums">
            {trend.bestWeight !== null ? (
              `${trend.bestWeight}kg`
            ) : (
              <span className="text-muted-foreground">—</span>
            )}
          </dd>
        </div>
        <div className="rounded-xl bg-secondary px-3 py-2.5">
          <dt className="text-xs text-muted-foreground">추정 1RM</dt>
          <dd className="mt-0.5 font-bold tabular-nums">
            {trend.bestOneRm !== null ? (
              `${trend.bestOneRm}kg`
            ) : (
              <span className="text-muted-foreground">—</span>
            )}
          </dd>
        </div>
      </dl>

      <ul className="mt-3 flex flex-col gap-1.5">
        {trend.entries.map((entry) => (
          <li key={entry.recordId}>
            <Link
              href={`/workouts/${entry.sessionId}`}
              className="relative flex items-center justify-between gap-3 overflow-hidden rounded-xl px-3 py-2.5 transition-colors hover:bg-muted"
            >
              <span
                aria-hidden
                className="absolute inset-y-0 left-0 bg-brand/20"
                style={{
                  width: `${Math.max(4, (entry.volume / maxVolume) * 100)}%`,
                }}
              />

              <span className="relative min-w-0 text-sm">
                <span className="font-medium">
                  {formatKstDateLabel(entry.performedAt)}
                </span>
                {entry.isPr ? (
                  <span className="ml-1.5 rounded-full bg-accent px-1.5 py-0.5 text-[0.65rem] font-bold text-brand-strong">
                    신기록
                  </span>
                ) : entry.firstTime ? (
                  <span className="ml-1.5 rounded-full border border-border px-1.5 py-0.5 text-[0.65rem] font-medium text-muted-foreground">
                    첫 기록
                  </span>
                ) : null}
              </span>

              <span className="relative shrink-0 text-right text-sm tabular-nums">
                {entry.topSet ? (
                  <span className="font-semibold">
                    {entry.topSet.weight}kg × {entry.topSet.reps}회
                  </span>
                ) : (
                  <span className="text-muted-foreground">기록 없음</span>
                )}
                <span className="block text-xs text-muted-foreground">
                  {entry.setCount}세트 · {entry.volume.toLocaleString()}kg
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>

      {trend.totalCount > trend.entries.length ? (
        <p className="mt-3 text-center text-xs text-muted-foreground">
          최근 {trend.entries.length}회만 보여주고 있어요
        </p>
      ) : null}
    </section>
  );
}
