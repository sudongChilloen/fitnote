import Link from "next/link";

import { requireUser } from "@/app/lib/dal";
import {
  BODY_PART_LABEL,
  DIFFICULTY_LABEL,
  MOVEMENT_TYPE_LABEL,
} from "@/lib/exercise-labels";
import { getExercises } from "@/server/exercises/exercise.service";
import { cn } from "@/lib/utils";

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
  const user = await requireUser();

  const params = await searchParams;

  const search = typeof params.search === "string" ? params.search : undefined;
  const bodyPart = pickEnum(BODY_PART_LABEL, params.bodyPart);
  const difficulty = pickEnum(DIFFICULTY_LABEL, params.difficulty);
  const movementType = pickEnum(MOVEMENT_TYPE_LABEL, params.movementType);
  const favoriteOnly = params.favorite === "1";
  const page = toPage(params.page);

  const { data, pagination } = await getExercises({
    search,
    bodyPart,
    difficulty,
    movementType,
    favoriteOfUserId: favoriteOnly ? user.id : undefined,
    page,
    limit: 20,
  });

  function pageHref(target: number) {
    const next = new URLSearchParams();

    if (search) next.set("search", search);
    if (bodyPart) next.set("bodyPart", bodyPart);
    if (difficulty) next.set("difficulty", difficulty);
    if (movementType) next.set("movementType", movementType);
    if (favoriteOnly) next.set("favorite", "1");
    if (target > 1) next.set("page", String(target));

    const query = next.toString();
    return query ? `/exercises?${query}` : "/exercises";
  }

  /** 즐겨찾기 탭을 오갈 때 검색·부위 조건은 그대로 두고 페이지만 1로 돌린다. */
  function scopeHref(target: boolean) {
    const next = new URLSearchParams();

    if (search) next.set("search", search);
    if (bodyPart) next.set("bodyPart", bodyPart);
    if (difficulty) next.set("difficulty", difficulty);
    if (movementType) next.set("movementType", movementType);
    if (target) next.set("favorite", "1");

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

      <nav aria-label="목록 범위" className="flex gap-2">
        {(
          [
            { label: "전체", value: false },
            { label: "즐겨찾기", value: true },
          ] as const
        ).map((tab) => (
          <Link
            key={tab.label}
            href={scopeHref(tab.value)}
            aria-current={favoriteOnly === tab.value ? "page" : undefined}
            className={cn(
              "rounded-full px-4 py-2 text-sm font-semibold transition-colors",
              favoriteOnly === tab.value
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-secondary-foreground hover:bg-muted",
            )}
          >
            {tab.label}
          </Link>
        ))}
      </nav>

      <section className="rounded-2xl border border-border bg-card p-4">
        <ExerciseFilters total={pagination.total} />
      </section>

      {data.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border py-16 text-center text-sm text-muted-foreground">
          {favoriteOnly
            ? "즐겨찾기한 운동이 없어요. 운동 상세에서 하트를 눌러 두면 여기 모여요."
            : "조건에 맞는 운동이 없어요."}
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
