"use client";

import { useState, useTransition } from "react";

import { setPushPreferenceAction } from "@/app/(user)/notifications/actions";

type Category = { type: string; label: string; hint: string };

/** 푸시로 받을 알림 종류. 끄면 앱 안 알림 목록에는 그대로 쌓인다. */
export function PushPreferences({
  categories,
  disabled,
}: {
  categories: Category[];
  disabled: string[];
}) {
  const [off, setOff] = useState(() => new Set(disabled));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function toggle(type: string) {
    const next = !off.has(type);
    setError(null);

    // 먼저 바꿔 보이고, 실패하면 되돌린다.
    setOff((prev) => {
      const copy = new Set(prev);
      if (next) copy.add(type);
      else copy.delete(type);
      return copy;
    });

    startTransition(async () => {
      try {
        const result = await setPushPreferenceAction(type, !next);
        if (result.error) throw new Error(result.error);
      } catch {
        setOff((prev) => {
          const copy = new Set(prev);
          if (next) copy.delete(type);
          else copy.add(type);
          return copy;
        });
        setError("설정을 바꾸지 못했어요. 잠시 후 다시 시도해 주세요.");
      }
    });
  }

  return (
    <section className="mt-3 rounded-2xl border border-border bg-card p-4">
      <h2 className="text-sm font-bold">푸시로 받을 알림</h2>

      <ul className="mt-2 divide-y divide-border/70">
        {categories.map((category) => {
          const on = !off.has(category.type);

          return (
            <li
              key={category.type}
              className="flex items-center justify-between gap-3 py-2.5"
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold">{category.label}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {category.hint}
                </p>
              </div>

              <button
                type="button"
                role="switch"
                aria-checked={on}
                aria-label={`${category.label} 푸시`}
                disabled={pending}
                onClick={() => toggle(category.type)}
                className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-60 ${
                  on ? "bg-brand" : "bg-secondary"
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow transition-transform ${
                    on ? "translate-x-5" : ""
                  }`}
                />
              </button>
            </li>
          );
        })}
      </ul>

      {error ? <p className="mt-2 text-xs text-destructive">{error}</p> : null}
    </section>
  );
}
