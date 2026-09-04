import type {
  AlternativeType,
  Difficulty,
  EquipmentCategory,
  ExerciseMovementType,
  WorkoutBodyPart,
} from "@/generated/prisma/enums";

/**
 * enum 의 한글 라벨.
 * 타입만 import 하므로 클라이언트 번들에 Prisma 런타임이 포함되지 않는다.
 */
export const BODY_PART_LABEL: Record<WorkoutBodyPart, string> = {
  CHEST: "가슴",
  BACK: "등",
  SHOULDER: "어깨",
  ARM: "팔",
  LEG: "하체",
  GLUTE: "둔근",
  ABS: "복근",
  FULL_BODY: "전신",
  CARDIO: "유산소",
  OTHER: "기타",
};

export const MOVEMENT_TYPE_LABEL: Record<ExerciseMovementType, string> = {
  PUSH: "밀기",
  PULL: "당기기",
  SQUAT: "스쿼트",
  HINGE: "힙힌지",
  LUNGE: "런지",
  CARRY: "운반",
  ROTATION: "회전",
  ISOLATION: "고립",
  CARDIO: "유산소",
  OTHER: "기타",
};

export const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  BEGINNER: "초급",
  INTERMEDIATE: "중급",
  ADVANCED: "고급",
};

export const EQUIPMENT_CATEGORY_LABEL: Record<EquipmentCategory, string> = {
  FREE_WEIGHT: "프리웨이트",
  MACHINE: "머신",
  CABLE: "케이블",
  CARDIO: "유산소",
  BODYWEIGHT: "맨몸",
  BAND: "밴드",
  OTHER: "기타",
};

export const ALTERNATIVE_TYPE_LABEL: Record<AlternativeType, string> = {
  SAME_MUSCLE: "같은 부위",
  SAME_MOVEMENT: "같은 동작",
  EQUIPMENT_ALTERNATIVE: "기구 대체",
  DIFFICULTY_ALTERNATIVE: "난이도 대체",
};

/** 난이도별 뱃지 색상 */
export const DIFFICULTY_BADGE: Record<Difficulty, string> = {
  BEGINNER: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  INTERMEDIATE: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  ADVANCED: "bg-rose-500/10 text-rose-700 dark:text-rose-400",
};

export const BODY_PART_OPTIONS = Object.entries(BODY_PART_LABEL) as [
  WorkoutBodyPart,
  string,
][];

export const DIFFICULTY_OPTIONS = Object.entries(DIFFICULTY_LABEL) as [
  Difficulty,
  string,
][];

export const MOVEMENT_TYPE_OPTIONS = Object.entries(MOVEMENT_TYPE_LABEL) as [
  ExerciseMovementType,
  string,
][];
