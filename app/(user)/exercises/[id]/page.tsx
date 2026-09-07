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
}: PageProps<"/exercises/[id]">) {
  await requireUser();

  const { id } = await params;
  const exercise = await getExerciseById(id);

  if (!exercise) {
    notFound();
  }

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
                      {alternative.equipment.map((item) => item.name).join(", ")}
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
