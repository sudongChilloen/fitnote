import type { WorkoutBodyPart } from "@/generated/prisma/enums";

/**
 * v3 팔레트의 쓰임새. (이름은 v2 그대로, 값은 globals.css에서 v3로 바뀜)
 *
 * 색마다 뜻을 정해 회원·트레이너 화면에 똑같이 쓴다.
 * 라임 = PT·주요 정보, 하늘 = 운동·진행, 노랑 = 식단·할 일,
 * 복숭아 = 주의, 라벤더 = 체성분·공지.
 */
export const PASTEL = {
  lime: "bg-pastel-lime text-pastel-lime-ink",
  sky: "bg-pastel-sky text-pastel-sky-ink",
  butter: "bg-pastel-butter text-pastel-butter-ink",
  peach: "bg-pastel-peach text-pastel-peach-ink",
  lav: "bg-pastel-lav text-pastel-lav-ink",
  gray: "bg-surface text-muted-foreground",
} as const;

/**
 * 운동 부위별 색. v3 에서는 부위마다 색을 달리하지 않는다 — 코랄은 "주의" 뜻이라
 * 가슴 운동에 쓰면 경고처럼 보인다. 모든 부위를 민트 타일로 두고, 부위 구분은
 * 글자와 아이콘이 맡는다.
 */
export const BODY_PART_PASTEL: Record<WorkoutBodyPart, string> = {
  LEG: PASTEL.lime,
  GLUTE: PASTEL.lime,
  BACK: PASTEL.lime,
  CHEST: PASTEL.lime,
  SHOULDER: PASTEL.lime,
  ARM: PASTEL.lime,
  ABS: PASTEL.lime,
  FULL_BODY: PASTEL.lime,
  CARDIO: PASTEL.lime,
  OTHER: PASTEL.gray,
};
