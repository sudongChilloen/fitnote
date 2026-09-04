import type { LucideIcon } from "lucide-react";

/** 아직 만들지 않은 탭. 하단 탭에서 눌렀을 때 빈 화면이 뜨지 않도록 둔다. */
export function ComingSoon({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <main className="flex min-h-[70dvh] flex-col items-center justify-center gap-3 px-8 text-center">
      <span className="flex size-14 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
        <Icon className="size-6" />
      </span>
      <h1 className="text-lg font-bold">{title}</h1>
      <p className="text-sm leading-6 whitespace-pre-line text-muted-foreground">{description}</p>
      <span className="mt-1 rounded-full bg-muted px-3 py-1 text-xs font-semibold text-muted-foreground">
        준비 중
      </span>
    </main>
  );
}
