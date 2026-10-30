/**
 * 운동 기구 픽토그램 (v3).
 *
 * 사진 대신 민트 타일 위에 선 아이콘을 둬서 목록을 훑을 때 기구를 먼저 알아보게
 * 한다. 기구 이름에서 종류를 짐작한다 — 시드의 "레그프레스 머신", "케이블 머신"
 * 처럼 이름 끝에 종류가 붙어 있어서 따로 칸을 만들 필요가 없다.
 */
const PATHS = {
  barbell: "M2 12h20M5 8v8M8 6v12M16 6v12M19 8v8",
  dumbbell: "M6 9v6M9 7v10M15 7v10M18 9v6M9 12h6M3 11v2M21 11v2",
  machine: "M4 3v18M4 7h10l3 3v11M10 7v6h7",
  cable: "M6 3v18M18 3v18M6 6h12M12 6v8M9 14h6v4H9z",
  body: "M12 3a2 2 0 1 1 0 .1M7 21l3-7 2 2 2-2 3 7M8 10l4-2 4 2",
} as const;

export type EquipmentKind = keyof typeof PATHS;

export function equipmentKind(name: string | null | undefined): EquipmentKind {
  if (!name) return "body";
  if (name.includes("케이블")) return "cable";
  if (name.includes("머신") || name.includes("스미스")) return "machine";
  if (name.includes("덤벨") || name.includes("케틀벨")) return "dumbbell";
  if (name.includes("바벨") || name.includes("바")) return "barbell";
  return "body";
}

export function EquipmentIcon({
  name,
  className,
}: {
  name: string | null | undefined;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={className}
    >
      <path d={PATHS[equipmentKind(name)]} />
    </svg>
  );
}
