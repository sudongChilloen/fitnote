import Link from "next/link";

import { requireUser } from "@/app/lib/dal";
import {
  BODY_PART_LABEL,
  DIFFICULTY_LABEL,
  MOVEMENT_TYPE_LABEL,
} from "@/lib/exercise-labels";
import { getExercises } from "@/server/exercises/exercise.service";

import { ExerciseCard } from "./exercise-card";
import { ExerciseFilters } from "./exercise-filters";

export const metadata = {
  title: "운동 라이브러리 | FitNote",
};

/** URL 로 임의의 값이 들어와도 Prisma 까지 내려가지 않도록 걸러낸다. */
function pickEnum<T extends Record<string, string>>(
  labels: T,
  value: string | string[] | undefined,
): keyof T | undefined {
  if (typeof value === "string" && value in labels) {
    return value as keyof T;
  }
  return undefined;
}

function toPage(value: string | string[] | undefined) {
  const parsed = Number(typeof value === "string" ? value : "1");
  return Number.isFinite(parsed) && parsed >= 1 ? Math.floor(parsed) : 1;
}

export default async function ExercisesPage({
  searchParams,
}: PageProps<"/exercises">) {
  await requireUser();

  const params = await searchParams;

  const search = typeof params.search === "string" ? params.search : undefined;
  const bodyPart = pickEnum(BODY_PART_LABEL, params.bodyPart);
  const difficulty = pickEnum(DIFFICULTY_LABEL, params.difficulty);
  const movementType = pickEnum(MOVEMENT_TYPE_LABEL, params.movementType);
  const page = toPage(params.page);

  const { data, pagination } = await getExercises({
    search,
    bodyPart,
    difficulty,
    movementType,
    page,
    limit: 20,
  });

  function pageHref(target: number) {
    const next = new URLSearchParams();

    if (search) next.set("search", search);
    if (bodyPart) next.set("bodyPart", bodyPart);
    if (difficulty) next.set("difficulty", difficulty);
    if (movementType) next.set("movementType", movementType);
    if (target > 1) next.set("page", String(target));

    const query = next.toString();
    return query ? `/exercises?${query}` : "/exercises";
  }

  return (
    <main className="flex flex-col gap-6 px-5 pt-8">
      <header>
        <p className="text-sm font-semibold text-muted-foreground">
          EXERCISE LIBRARY
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">
          운동 라이브러리
        </h1>
      </header>

      <section className="rounded-2xl border border-border bg-card p-4">
        <ExerciseFilters total={pagination.total} />
      </section>

      {data.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border py-16 text-center text-sm text-muted-foreground">
          조건에 맞는 운동이 없어요.
        </p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {data.map((exercise) => (
            <li key={exercise.id}>
              <ExerciseCard exercise={exercise} />
            </li>
          ))}
        </ul>
      )}

      {pagination.totalPages > 1 && (
        <nav
          aria-label="페이지 이동"
          className="flex items-center justify-between"
        >
          {pagination.hasPreviousPage ? (
            <Link
              href={pageHref(pagination.page - 1)}
              className="rounded-lg bg-secondary px-4 py-2 text-sm font-semibold"
            >
              이전
            </Link>
          ) : (
            <span />
          )}

          <span className="text-sm text-muted-foreground">
            {pagination.page} / {pagination.totalPages}
          </span>

          {pagination.hasNextPage ? (
            <Link
              href={pageHref(pagination.page + 1)}
              className="rounded-lg bg-secondary px-4 py-2 text-sm font-semibold"
            >
              다음
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
    </main>
  );
}
