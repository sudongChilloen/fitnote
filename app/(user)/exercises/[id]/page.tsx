import { Plus } from "lucide-react";
import { notFound } from "next/navigation";
import Link from "next/link";

import { requireUser } from "@/app/lib/dal";
import {
  ALTERNATIVE_TYPE_LABEL,
  BODY_PART_LABEL,
  DIFFICULTY_BADGE,
  DIFFICULTY_LABEL,
  EQUIPMENT_CATEGORY_LABEL,
  MOVEMENT_TYPE_LABEL,
} from "@/lib/exercise-labels";
import { cn } from "@/lib/utils";
import { getExerciseById } from "@/server/exercises/exercise.service";
import { isFavorite } from "@/server/workouts/favorite.service";
import { getActiveSession } from "@/server/workouts/workout.service";

import { recordThisExercise, toggleFavorite } from "../actions";
import { ExerciseTrend } from "./exercise-trend";
import { FavoriteToggleButton } from "./favorite-toggle-button";

export async function generateMetadata({
  params,
}: PageProps<"/exercises/[id]">) {
  const { id } = await params;
  const exercise = await getExerciseById(id);

  return {
    title: exercise ? `${exercise.name} | FitNote` : "운동을 찾을 수 없어요",
  };
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <h2 className="text-sm font-bold">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

export default async function ExerciseDetailPage({
  params,
  searchParams,
}: PageProps<"/exercises/[id]">) {
  const user = await requireUser();

  const { id } = await params;
  const exercise = await getExerciseById(id);

  if (!exercise) {
    notFound();
  }

  const expanded = (await searchParams).records === "all";

  const [favorite, activeSession] = await Promise.all([
    isFavorite(user.id, exercise.id),
    getActiveSession(user.id),
  ]);

  // 이미 오늘 운동에 들어 있으면 또 넣지 않고 그리로 보낸다.
  const alreadyAdded =
    activeSession?.records.some(
      (record) => record.exercise.id === exercise.id,
    ) ?? false;

  return (
    <main className="flex flex-col gap-5 px-5 pt-6">
      <Link
        href="/exercises"
        className="text-sm font-semibold text-muted-foreground hover:text-foreground"
      >
        ← 운동 라이브러리
      </Link>

      <header className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight">{exercise.name}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {BODY_PART_LABEL[exercise.bodyPart]}
            {exercise.targetMuscle ? ` · ${exercise.targetMuscle}` : ""} ·{" "}
            {MOVEMENT_TYPE_LABEL[exercise.movementType]}
          </p>
        </div>

        <span
          className={cn(
            "shrink-0 rounded-full px-3 py-1 text-xs font-semibold",
            DIFFICULTY_BADGE[exercise.difficulty],
          )}
        >
          {DIFFICULTY_LABEL[exercise.difficulty]}
        </span>
      </header>

      {/*
        운동 라이브러리는 설명을 읽는 곳이 아니라 기록의 출발점이어야 한다.
        여기서 "운동 시작 → 운동 추가 → 검색 → 이 운동 찾기" 를 다시 하게 만들면
        방금 보고 있던 운동을 처음부터 다시 찾는 셈이다.
      */}
      <div className="flex items-center gap-2">
        <form action={recordThisExercise} className="flex-1">
          <input type="hidden" name="exerciseId" value={exercise.id} />
          <button
            type="submit"
            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-bold text-primary-foreground"
          >
            <Plus className="size-4" />
            {alreadyAdded
              ? "오늘 운동에서 이어서 하기"
              : activeSession
                ? "오늘 운동에 추가하기"
                : "이 운동 기록하기"}
          </button>
        </form>

        <form action={toggleFavorite}>
          <input type="hidden" name="exerciseId" value={exercise.id} />
          {/* 서버는 "뒤집어라" 가 아니라 "이렇게 만들어라" 를 받는다.
              두 번 눌리거나 화면이 두 개 열려 있어도 결과가 같다. */}
          <input type="hidden" name="on" value={favorite ? "0" : "1"} />
          <FavoriteToggleButton on={favorite} />
        </form>
      </div>

      {exercise.description && (
        <p className="text-sm leading-6 text-muted-foreground">
          {exercise.description}
        </p>
      )}

      <Section title="필요한 기구">
        {exercise.equipment.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            기구 없이 할 수 있어요.
          </p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {exercise.equipment.map((item) => (
              <li
                key={item.id}
                className={cn(
                  "rounded-lg px-3 py-2 text-sm",
                  item.isPrimary
                    ? "bg-primary text-primary-foreground font-semibold"
                    : "bg-secondary text-secondary-foreground",
                )}
              >
                {item.name}
                <span
                  className={cn(
                    "ml-1.5 text-xs",
                    item.isPrimary
                      ? "text-primary-foreground/70"
                      : "text-muted-foreground",
                  )}
                >
                  {EQUIPMENT_CATEGORY_LABEL[item.category]}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {exercise.instruction && (
        <Section title="운동 방법">
          <p className="text-sm leading-6 whitespace-pre-line text-muted-foreground">
            {exercise.instruction}
          </p>
        </Section>
      )}

      {exercise.breathing && (
        <Section title="호흡">
          <p className="text-sm leading-6 text-muted-foreground">
            {exercise.breathing}
          </p>
        </Section>
      )}

      {exercise.caution && (
        <section className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-5">
          <h2 className="text-sm font-bold text-amber-700 dark:text-amber-400">
            주의사항
          </h2>
          <p className="mt-3 text-sm leading-6 text-amber-800 dark:text-amber-200/80">
            {exercise.caution}
          </p>
        </section>
      )}

      {/*
        내 기록은 운동 방법 아래에 둔다. 처음 하는 운동일수록 방법이 궁금한데,
        기록을 위에 두면 열두 줄 밑으로 밀려난다.
      */}
      <ExerciseTrend
        userId={user.id}
        exerciseId={exercise.id}
        expanded={expanded}
        moreHref={`/exercises/${exercise.id}?records=all`}
      />

      <Section title="이 운동 대신 할 수 있어요">
        {exercise.alternatives.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            아직 등록된 대체 운동이 없어요.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {exercise.alternatives.map((alternative) => (
              <li key={alternative.id}>
                <Link
                  href={`/exercises/${alternative.id}`}
                  className="flex flex-col gap-2 rounded-xl bg-secondary p-4 transition-colors hover:bg-muted"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-semibold">{alternative.name}</span>
                    <span className="shrink-0 rounded-full bg-card px-2.5 py-1 text-xs font-semibold text-muted-foreground">
                      {ALTERNATIVE_TYPE_LABEL[alternative.type]}
                    </span>
                  </div>

                  {alternative.reason && (
                    <p className="text-xs leading-5 text-muted-foreground">
                      {alternative.reason}
                    </p>
                  )}

                  {alternative.equipment.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      필요 기구:{" "}
                      {alternative.equipment
                        .map((item) => item.name)
                        .join(", ")}
                    </p>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </main>
  );
}
