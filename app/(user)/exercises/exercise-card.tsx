import Link from "next/link";

import { Heart } from "lucide-react";

import { EquipmentIcon } from "@/components/fitness/equipment-icon";
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

/**
 * 운동 목록 한 줄 (v3).
 * 왼쪽 민트 타일은 주 기구 픽토그램, 오른쪽 하트는 즐겨찾기 여부.
 * 하트를 누르면 상세로 간다 — 상세에서 켜고 끈다.
 */
export function ExerciseCard({
  exercise,
  favorite = false,
}: {
  exercise: ExerciseCardData;
  favorite?: boolean;
}) {
  const primary =
    exercise.equipment.find((item) => item.isPrimary) ?? exercise.equipment[0];
  const extra = exercise.equipment.length - (primary ? 1 : 0);

  return (
    <Link
      href={`/exercises/${exercise.id}`}
      className="flex items-center gap-3 border-b border-line px-1 py-2.5 text-ink"
    >
      <span className="flex size-12 shrink-0 items-center justify-center rounded-[0.875rem] bg-brand-muted text-primary">
        <EquipmentIcon name={primary?.name} className="size-6" />
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="min-w-0 truncate text-sm font-bold">{exercise.name}</span>
          <span
            className={cn(
              "shrink-0 rounded-full px-1.5 text-[0.6875rem] leading-[1.125rem] font-bold",
              DIFFICULTY_BADGE[exercise.difficulty],
            )}
          >
            {DIFFICULTY_LABEL[exercise.difficulty]}
          </span>
        </span>
        <span className="mt-0.5 block truncate text-xs text-muted-foreground">
          {[
            exercise.targetMuscle ?? BODY_PART_LABEL[exercise.bodyPart],
            MOVEMENT_TYPE_LABEL[exercise.movementType],
            primary?.name,
          ]
            .filter(Boolean)
            .join(" · ")}
          {extra > 0 ? ` +${extra}` : ""}
        </span>
      </span>

      <span
        className={cn(
          "flex size-8 shrink-0 items-center justify-center",
          favorite ? "text-primary" : "text-[#8a938e]",
        )}
      >
        <Heart
          className="size-4.5"
          fill={favorite ? "currentColor" : "none"}
          strokeWidth={2}
          aria-label={favorite ? "즐겨찾기됨" : "즐겨찾기 안 됨"}
        />
      </span>
    </Link>
  );
}
