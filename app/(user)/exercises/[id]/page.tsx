import { Plus } from "lucide-react";
import { notFound } from "next/navigation";
import Link from "next/link";

import { EquipmentIcon } from "@/components/fitness/equipment-icon";
import {
  BODY_PART_MUSCLES,
  MuscleFigure,
  levelsForBodyPart,
} from "@/components/fitness/muscle-figure";
import { PageHeader } from "@/components/layout/page-header";

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
    <section className="rounded-[1.25rem] border border-border px-4 py-3.5">
      <h2 className="text-[0.9375rem] font-bold">{title}</h2>
      <div className="mt-2.5">{children}</div>
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
    <main className="flex flex-col pb-6">
      <PageHeader
        backHref="/exercises"
        backLabel="운동 목록"
        title={exercise.name}
        subtitle={`${BODY_PART_LABEL[exercise.bodyPart]} · ${MOVEMENT_TYPE_LABEL[exercise.movementType]}`}
        right={
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[0.6875rem] font-bold",
              DIFFICULTY_BADGE[exercise.difficulty],
            )}
          >
            {DIFFICULTY_LABEL[exercise.difficulty]}
          </span>
        }
      />

      <div className="flex flex-col gap-3 px-4 pt-1.5">
      {/* 어느 근육을 쓰는지 그림과 글자로 함께 보여 준다. */}
      <section className="flex items-center gap-3.5 rounded-[1.375rem] bg-[#f7f8f7] px-4 py-3.5">
        {BODY_PART_MUSCLES[exercise.bodyPart].main.length > 0 ? (
          <MuscleFigure
            levels={levelsForBodyPart(exercise.bodyPart)}
            label={`주로 쓰는 근육: ${exercise.targetMuscle ?? BODY_PART_LABEL[exercise.bodyPart]}`}
            className="h-28 w-15 shrink-0"
          />
        ) : (
          <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-brand-muted text-primary">
            <EquipmentIcon name={exercise.equipment[0]?.name} className="size-7" />
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className="block text-[0.6875rem] font-bold text-primary">주로 쓰는 근육</span>
          <span className="mt-1.5 flex flex-wrap gap-1">
            <span className="rounded-full bg-primary px-2.25 py-0.5 text-[0.6875rem] font-bold text-white">
              {exercise.targetMuscle ?? BODY_PART_LABEL[exercise.bodyPart]}
            </span>
            {BODY_PART_MUSCLES[exercise.bodyPart].assistLabels.map((label) => (
              <span
                key={label}
                className="rounded-full border border-brand-mid bg-card px-2.25 py-px text-[0.6875rem] font-semibold text-primary"
              >
                {label}
              </span>
            ))}
          </span>
          {exercise.description ? (
            <span className="mt-2 block text-xs leading-relaxed text-[#4b5650]">
              {exercise.description}
            </span>
          ) : null}
        </span>
      </section>

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
            className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-primary text-sm font-bold text-primary-foreground"
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
                  "flex items-center gap-1.5 rounded-full py-1.5 pr-3 pl-2 text-[0.8125rem]",
                  item.isPrimary
                    ? "bg-primary font-bold text-white"
                    : "bg-surface text-ink",
                )}
              >
                <EquipmentIcon name={item.name} className="size-4 shrink-0" />
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
          <p className="text-[0.8125rem] leading-relaxed whitespace-pre-line text-[#2b3631]">
            {exercise.instruction}
          </p>
        </Section>
      )}

      {exercise.breathing && (
        <Section title="호흡">
          <p className="text-[0.8125rem] leading-relaxed text-[#2b3631]">
            {exercise.breathing}
          </p>
        </Section>
      )}

      {exercise.caution && (
        <section className="border-l-[3px] border-coral py-0.5 pl-3">
          <h2 className="text-xs font-extrabold text-status-urgent">
            주의할 점
          </h2>
          <p className="mt-1 text-[0.8125rem] leading-relaxed text-[#2b3631]">
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
          <ul className="flex flex-col">
            {exercise.alternatives.map((alternative) => (
              <li key={alternative.id}>
                <Link
                  href={`/exercises/${alternative.id}`}
                  className="flex flex-col gap-1 border-b border-line py-2.5 last:border-b-0"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="min-w-0 truncate text-sm font-bold">{alternative.name}</span>
                    <span className="shrink-0 rounded-full border border-brand px-2 py-0.5 text-[0.6875rem] font-bold text-primary">
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
      </div>
    </main>
  );
}
