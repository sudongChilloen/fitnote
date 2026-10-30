"use client";

import { useEffect, useState, useTransition } from "react";

import { Search } from "lucide-react";
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
    <div className="flex flex-col gap-3">
      <label className="flex h-11.5 items-center gap-2 rounded-full bg-surface px-4 text-muted-foreground focus-within:ring-3 focus-within:ring-ring/50">
        <Search className="size-4.5 shrink-0" aria-hidden />
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="운동 이름으로 검색"
          aria-label="운동 검색"
          className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none"
        />
      </label>

      {FILTER_GROUPS.map((group) => {
        const active = searchParams.get(group.key);

        return (
          <div key={group.key} className="flex flex-col gap-1.5">
            <p className="px-1 text-xs font-bold text-muted-foreground">
              {group.label}
            </p>

            <div className="flex flex-wrap gap-1.5">
              {group.options.map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={active === value}
                  onClick={() => toggleFilter(group.key, value)}
                  className={cn(
                    "h-8 rounded-full border px-3.25 text-xs font-bold transition-colors",
                    active === value
                      ? "border-ink bg-ink text-white"
                      : "border-border bg-card text-ink hover:bg-surface",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        );
      })}

      <div className="flex items-center justify-between px-1 pt-0.5">
        <p
          aria-live="polite"
          className={cn(
            "text-[0.8125rem] text-muted-foreground transition-opacity",
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
              // 즐겨찾기 탭은 필터가 아니라 보는 범위다. 초기화로 탭까지
              // 바뀌면 눌러 둔 곳이 말없이 옮겨간다.
              const params = new URLSearchParams();
              if (searchParams.get("favorite") === "1") {
                params.set("favorite", "1");
              }
              const query = params.toString();
              startTransition(() =>
                router.replace(query ? `${pathname}?${query}` : pathname, {
                  scroll: false,
                }),
              );
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
