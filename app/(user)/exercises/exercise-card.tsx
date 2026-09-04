import Link from "next/link";

import {
  BODY_PART_LABEL,
  DIFFICULTY_BADGE,
  DIFFICULTY_LABEL,
  MOVEMENT_TYPE_LABEL,
} from "@/lib/exercise-labels";
import { cn } from "@/lib/utils";

export interface ExerciseCardData {
  id: string;
  name: string;
  bodyPart: keyof typeof BODY_PART_LABEL;
  targetMuscle: string | null;
  movementType: keyof typeof MOVEMENT_TYPE_LABEL;
  difficulty: keyof typeof DIFFICULTY_LABEL;
  equipment: { id: string; name: string; isPrimary: boolean }[];
}

export function ExerciseCard({ exercise }: { exercise: ExerciseCardData }) {
  const primary = exercise.equipment.find((item) => item.isPrimary);

  return (
    <Link
      href={`/exercises/${exercise.id}`}
      className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 transition-colors hover:bg-muted/50"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate font-bold">{exercise.name}</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {BODY_PART_LABEL[exercise.bodyPart]}
            {exercise.targetMuscle ? ` · ${exercise.targetMuscle}` : ""}
          </p>
        </div>

        <span
          className={cn(
            "shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold",
            DIFFICULTY_BADGE[exercise.difficulty],
          )}
        >
          {DIFFICULTY_LABEL[exercise.difficulty]}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <span className="rounded-md bg-secondary px-2 py-1 text-xs text-secondary-foreground">
          {MOVEMENT_TYPE_LABEL[exercise.movementType]}
        </span>

        {primary && (
          <span className="rounded-md bg-secondary px-2 py-1 text-xs text-secondary-foreground">
            {primary.name}
          </span>
        )}

        {exercise.equipment.length > (primary ? 1 : 0) && (
          <span className="text-xs text-muted-foreground">
            +{exercise.equipment.length - (primary ? 1 : 0)}
          </span>
        )}
      </div>
    </Link>
  );
}
