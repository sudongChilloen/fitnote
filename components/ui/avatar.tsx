import { cn } from "@/lib/utils";

/**
 * 이름 첫 글자로 만드는 아바타.
 *
 * 같은 이름은 항상 같은 색이 나오도록 이름으로 색을 고른다.
 * 회원 목록에서 사람을 색으로도 구분할 수 있게 하려는 것이다.
 */
const PALETTES = [
  "bg-[#ffd9bd] text-[#6b2a05]",
  "bg-[#cfe0f5] text-[#16355e]",
  "bg-[#cdebd8] text-[#14432a]",
  "bg-[#e3d6f3] text-[#3b1d63]",
  "bg-[#f9d3d3] text-[#5c1a1a]",
  "bg-[#f3e7a8] text-[#4d4208]",
] as const;

export function Avatar({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  const trimmed = name.trim();
  const palette = PALETTES[(trimmed.charCodeAt(0) || 0) % PALETTES.length];

  return (
    <span
      aria-hidden
      className={cn(
        "flex size-11 shrink-0 items-center justify-center rounded-full text-base font-bold",
        palette,
        className,
      )}
    >
      {trimmed.slice(0, 1)}
    </span>
  );
}
