"use client";

import { useEffect, useState, useTransition } from "react";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import {
  BODY_PART_OPTIONS,
  DIFFICULTY_OPTIONS,
  MOVEMENT_TYPE_OPTIONS,
} from "@/lib/exercise-labels";
import { cn } from "@/lib/utils";

const FILTER_GROUPS = [
  { key: "bodyPart", label: "부위", options: BODY_PART_OPTIONS },
  { key: "difficulty", label: "난이도", options: DIFFICULTY_OPTIONS },
  { key: "movementType", label: "동작", options: MOVEMENT_TYPE_OPTIONS },
] as const;

export function ExerciseFilters({ total }: { total: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const currentSearch = searchParams.get("search") ?? "";
  const [search, setSearch] = useState(currentSearch);
  const [syncedSearch, setSyncedSearch] = useState(currentSearch);

  // 뒤로가기 등 URL 이 외부에서 바뀌면 입력값을 맞춰준다.
  // effect 대신 렌더 중 조정하여 불필요한 재렌더를 피한다.
  if (syncedSearch !== currentSearch) {
    setSyncedSearch(currentSearch);
    setSearch(currentSearch);
  }

  function pushParams(mutate: (params: URLSearchParams) => void) {
    const params = new URLSearchParams(searchParams.toString());
    mutate(params);
    // 필터가 바뀌면 항상 첫 페이지부터 다시 본다.
    params.delete("page");

    const query = params.toString();
    startTransition(() => {
      router.replace(query ? `${pathname}?${query}` : pathname, {
        scroll: false,
      });
    });
  }

  // 입력이 멈춘 뒤에만 요청하도록 디바운스한다.
  useEffect(() => {
    if (search === currentSearch) {
      return;
    }

    const timer = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());

      if (search.trim()) {
        params.set("search", search.trim());
      } else {
        params.delete("search");
      }
      params.delete("page");

      const query = params.toString();
      startTransition(() => {
        router.replace(query ? `${pathname}?${query}` : pathname, {
          scroll: false,
        });
      });
    }, 300);

    return () => clearTimeout(timer);
  }, [search, currentSearch, pathname, router, searchParams]);

  function toggleFilter(key: string, value: string) {
    pushParams((params) => {
      if (params.get(key) === value) {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    });
  }

  const hasAnyCondition =
    Boolean(currentSearch) ||
    FILTER_GROUPS.some((group) => searchParams.get(group.key));

  return (
    <div className="flex flex-col gap-4">
      <input
        type="search"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="운동 이름으로 검색"
        aria-label="운동 검색"
        className="w-full rounded-xl border border-input bg-card px-4 py-3 text-sm outline-none focus:ring-3 focus:ring-ring/50"
      />

      {FILTER_GROUPS.map((group) => {
        const active = searchParams.get(group.key);

        return (
          <div key={group.key} className="flex flex-col gap-2">
            <p className="text-xs font-semibold text-muted-foreground">
              {group.label}
            </p>

            <div className="flex flex-wrap gap-2">
              {group.options.map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={active === value}
                  onClick={() => toggleFilter(group.key, value)}
                  className={cn(
                    "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                    active === value
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-secondary-foreground hover:bg-muted",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        );
      })}

      <div className="flex items-center justify-between border-t border-border pt-3">
        <p
          aria-live="polite"
          className={cn(
            "text-sm text-muted-foreground transition-opacity",
            isPending && "opacity-50",
          )}
        >
          총 <span className="font-bold text-foreground">{total}</span>개
        </p>

        {hasAnyCondition && (
          <button
            type="button"
            onClick={() => {
              setSearch("");
              startTransition(() => router.replace(pathname, { scroll: false }));
            }}
            className="text-xs font-semibold text-muted-foreground underline underline-offset-4 hover:text-foreground"
          >
            필터 초기화
          </button>
        )}
      </div>
    </div>
  );
}
