import type { WorkoutBodyPart } from "@/generated/prisma/enums";

/**
 * 근육 그림 (v3, 앞모습 한 장).
 *
 * 부위마다 0~3 단계로 칠한다. 0 = 회색(안 씀), 1 = 연민트, 2 = 민트, 3 = 딥그린(주로 씀).
 * 색만으로 뜻을 전하지 않도록 쓰는 쪽에서 aria-label 이나 옆 글자로 다시 말해 준다.
 */
export type MuscleRegion =
  | "shoulders"
  | "chest"
  | "abs"
  | "arms"
  | "hips"
  | "thighs"
  | "calves";

export type MuscleLevels = Partial<Record<MuscleRegion, 0 | 1 | 2 | 3>>;

const FILL = ["#dfe4e1", "#a8e6cf", "#5fd3a8", "#2f6b53"] as const;

export function MuscleFigure({
  levels,
  label,
  className,
}: {
  levels: MuscleLevels;
  label: string;
  className?: string;
}) {
  const c = (region: MuscleRegion) => FILL[levels[region] ?? 0];

  return (
    <svg viewBox="0 0 120 220" role="img" aria-label={label} className={className}>
      <circle cx="60" cy="20" r="13" fill="#e3e7e4" />
      <circle cx="37" cy="50" r="9" fill={c("shoulders")} />
      <circle cx="83" cy="50" r="9" fill={c("shoulders")} />
      <path d="M42 42 Q60 37 78 42 L80 66 Q60 70 40 66 Z" fill={c("chest")} />
      <path d="M44 68 Q60 72 76 68 L78 100 Q60 106 42 100 Z" fill={c("abs")} />
      <line x1="33" y1="58" x2="26" y2="112" stroke={c("arms")} strokeWidth="11" strokeLinecap="round" />
      <line x1="87" y1="58" x2="94" y2="112" stroke={c("arms")} strokeWidth="11" strokeLinecap="round" />
      <path d="M41 101 Q60 112 79 101 L78 122 Q60 128 42 122 Z" fill={c("hips")} />
      <line x1="50" y1="126" x2="48" y2="168" stroke={c("thighs")} strokeWidth="17" strokeLinecap="round" />
      <line x1="70" y1="126" x2="72" y2="168" stroke={c("thighs")} strokeWidth="17" strokeLinecap="round" />
      <line x1="48" y1="176" x2="48" y2="210" stroke={c("calves")} strokeWidth="11" strokeLinecap="round" />
      <line x1="72" y1="176" x2="72" y2="210" stroke={c("calves")} strokeWidth="11" strokeLinecap="round" />
    </svg>
  );
}

/** 운동 부위별로 어느 근육을 주로·보조로 쓰는지. 주 = 3, 보조 = 1. */
export const BODY_PART_MUSCLES: Record<
  WorkoutBodyPart,
  { main: MuscleRegion[]; assist: MuscleRegion[]; assistLabels: string[] }
> = {
  CHEST: { main: ["chest"], assist: ["shoulders", "arms"], assistLabels: ["어깨", "삼두"] },
  BACK: { main: ["chest", "shoulders"], assist: ["arms"], assistLabels: ["이두", "후면 어깨"] },
  SHOULDER: { main: ["shoulders"], assist: ["arms", "chest"], assistLabels: ["삼두", "윗가슴"] },
  ARM: { main: ["arms"], assist: ["shoulders"], assistLabels: ["전완"] },
  LEG: { main: ["thighs"], assist: ["hips", "abs"], assistLabels: ["둔근", "코어"] },
  GLUTE: { main: ["hips"], assist: ["thighs"], assistLabels: ["햄스트링"] },
  ABS: { main: ["abs"], assist: ["hips"], assistLabels: ["허리"] },
  FULL_BODY: {
    main: ["thighs", "chest", "shoulders"],
    assist: ["abs", "arms", "hips"],
    assistLabels: ["코어"],
  },
  CARDIO: { main: ["thighs", "calves"], assist: ["abs"], assistLabels: ["심폐"] },
  OTHER: { main: [], assist: [], assistLabels: [] },
};

export function levelsForBodyPart(bodyPart: WorkoutBodyPart): MuscleLevels {
  const { main, assist } = BODY_PART_MUSCLES[bodyPart];
  const levels: MuscleLevels = {};
  for (const region of assist) levels[region] = 1;
  for (const region of main) levels[region] = 3;
  return levels;
}
