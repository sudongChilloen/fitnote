"use client";

import { Bookmark, Check, Loader2, Plus, Search, X } from "lucide-react";
import { useEffect, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import type { WorkoutBodyPart } from "@/generated/prisma/enums";
import {
  BODY_PART_LABEL,
  BODY_PART_OPTIONS,
  DIFFICULTY_LABEL,
} from "@/lib/exercise-labels";
import { cn } from "@/lib/utils";

import { addExercisesToSession, toggleExerciseFavorite } from "../actions";

type ExerciseItem = {
  id: string;
  name: string;
  bodyPart: WorkoutBodyPart;
  difficulty: keyof typeof DIFFICULTY_LABEL;
};

/** "전체" 와 즐겨찾기는 부위 enum 이 아니므로 따로 표현한다. */
type Tab = { kind: "all" } | { kind: "favorite" } | { kind: "part"; value: WorkoutBodyPart };

export function AddExerciseDrawer({
  sessionId,
  bodyPartCounts,
  favoriteIds,
}: {
  sessionId: string;
  bodyPartCounts: Partial<Record<WorkoutBodyPart, number>>;
  favoriteIds: string[];
}) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>({ kind: "all" });
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [favorites, setFavorites] = useState<string[]>(favoriteIds);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [pending, startTransition] = useTransition();

  const keyword = search.trim();
  // 검색 중에는 부위 탭을 무시하고 전체에서 찾는다. 탭을 골라 둔 걸 잊고
  // 검색했다가 "결과 없음" 을 보는 일이 잦다.
  const bodyPart = keyword || tab.kind !== "part" ? null : tab.value;
  const queryKey = keyword ? `search:${keyword}` : `part:${bodyPart ?? "all"}`;

  // 받아온 조건을 함께 들고 있다가 조건이 맞을 때만 보여준다.
  // 탭을 바꾸는 순간 이전 목록이 남는 걸 막으려면 필요한데,
  // effect 안에서 setState 로 비우면 cascading render 로 잡힌다.
  const [result, setResult] = useState<{ key: string; items: ExerciseItem[] }>({
    key: "",
    items: [],
  });

  const fetched = result.key === queryKey ? result.items : [];

  // 즐겨찾기 탭은 서버를 다시 부르지 않고 받아온 목록에서 걸러낸다.
  const items =
    !keyword && tab.kind === "favorite"
      ? fetched.filter((exercise) => favorites.includes(exercise.id))
      : fetched;

  useEffect(() => {
    if (!open) return;

    const controller = new AbortController();
    // 타이핑마다 요청하지 않도록 잠깐 기다린다.
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ limit: "100" });
        if (keyword) params.set("search", keyword);
        else if (bodyPart) params.set("bodyPart", bodyPart);

        const res = await fetch(`/api/exercises?${params}`, {
          signal: controller.signal,
        });
        const body = await res.json();
        if (!controller.signal.aborted) {
          setResult({ key: queryKey, items: res.ok ? (body.data ?? []) : [] });
        }
      } catch {
        // abort 는 정상 흐름이라 무시한다.
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 250);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [open, keyword, bodyPart, queryKey]);

  function reset() {
    setSearch("");
    setTab({ kind: "all" });
    setSelected([]);
    setError(null);
  }

  function toggle(exerciseId: string) {
    setError(null);
    setSelected((prev) =>
      prev.includes(exerciseId)
        ? prev.filter((id) => id !== exerciseId)
        : [...prev, exerciseId],
    );
  }

  function toggleBookmark(exerciseId: string) {
    // 응답을 기다리면 별이 늦게 켜져 두 번 누르게 된다. 먼저 반영하고
    // 실패하면 되돌린다.
    const wasFavorite = favorites.includes(exerciseId);
    setFavorites((prev) =>
      wasFavorite ? prev.filter((id) => id !== exerciseId) : [...prev, exerciseId],
    );

    startTransition(async () => {
      const res = await toggleExerciseFavorite(exerciseId);
      if (res.error) {
        setFavorites((prev) =>
          wasFavorite
            ? [...prev, exerciseId]
            : prev.filter((id) => id !== exerciseId),
        );
      }
    });
  }

  function submit() {
    setError(null);
    startTransition(async () => {
      const res = await addExercisesToSession(sessionId, selected);

      if (res.error) {
        setError(res.error);
      } else {
        setOpen(false);
        reset();
      }
    });
  }

  const tabs: { key: string; label: string; tab: Tab }[] = [
    { key: "all", label: "전체", tab: { kind: "all" } },
    ...BODY_PART_OPTIONS.filter(([value]) => (bodyPartCounts[value] ?? 0) > 0).map(
      ([value, label]) => ({
        key: value,
        label,
        tab: { kind: "part", value } as Tab,
      }),
    ),
  ];

  const activeKey =
    tab.kind === "part" ? tab.value : tab.kind === "favorite" ? "favorite" : "all";

  return (
    <>
      <Button
        variant="outline"
        size="lg"
        className="h-12 w-full rounded-xl border-dashed font-bold"
        onClick={() => setOpen(true)}
      >
        <Plus className="size-4" />
        운동 추가
      </Button>

      <Drawer
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) reset();
        }}
      >
        {/*
          높이를 고정한다. 내용에 맡기면 검색 결과 수에 따라 드로어가
          늘었다 줄었다 하고, 결과가 0개일 때 납작하게 찌그러진다.
        */}
        <DrawerContent className="mx-auto flex h-[85dvh] max-w-md flex-col">
          <DrawerHeader className="pb-3 text-center">
            <DrawerTitle>운동 선택하기</DrawerTitle>
          </DrawerHeader>

          <div className="px-4">
            <div className="relative">
              <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="찾으시는 운동을 검색해보세요"
                aria-label="운동 검색"
                className="h-11 w-full rounded-xl bg-secondary pr-10 pl-9 text-sm outline-none focus:ring-2 focus:ring-ring/40"
              />
              {keyword ? (
                <button
                  type="button"
                  aria-label="검색어 지우기"
                  onClick={() => setSearch("")}
                  className="absolute top-1/2 right-2 -translate-y-1/2 rounded-lg p-1.5 text-muted-foreground"
                >
                  <X className="size-4" />
                </button>
              ) : null}
            </div>
          </div>

          {/* 부위는 한 줄 가로 스크롤. 목록을 한 번 더 파고들게 하지 않는다. */}
          <div className="mt-3 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <button
              type="button"
              aria-label="즐겨찾기만 보기"
              aria-pressed={tab.kind === "favorite"}
              onClick={() =>
                setTab(tab.kind === "favorite" ? { kind: "all" } : { kind: "favorite" })
              }
              className={cn(
                "flex size-9 shrink-0 items-center justify-center rounded-full border transition-colors",
                tab.kind === "favorite"
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border text-muted-foreground",
              )}
            >
              <Bookmark className="size-4" />
            </button>

            {tabs.map((item) => (
              <button
                key={item.key}
                type="button"
                aria-pressed={activeKey === item.key}
                onClick={() => setTab(item.tab)}
                className={cn(
                  "shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition-colors",
                  activeKey === item.key
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border text-foreground",
                )}
              >
                {item.label}
              </button>
            ))}
          </div>

          {error ? (
            <p role="alert" className="px-4 pt-3 text-sm text-destructive">
              {error}
            </p>
          ) : null}

          <div className="min-h-0 flex-1 overflow-y-auto px-4 pt-2">
            {loading && fetched.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                불러오는 중…
              </p>
            ) : items.length === 0 ? (
              <EmptyResult
                keyword={keyword}
                favoriteTab={!keyword && tab.kind === "favorite"}
                onReset={() => {
                  setSearch("");
                  setTab({ kind: "all" });
                }}
              />
            ) : (
              <ul className="divide-y divide-border">
                {items.map((exercise) => {
                  const checked = selected.includes(exercise.id);
                  const favorite = favorites.includes(exercise.id);

                  return (
                    <li key={exercise.id} className="flex items-center gap-3 py-1">
                      <button
                        type="button"
                        aria-pressed={checked}
                        onClick={() => toggle(exercise.id)}
                        className="flex min-w-0 flex-1 items-center gap-3 py-2.5 text-left"
                      >
                        <span
                          aria-hidden
                          className={cn(
                            "flex size-5 shrink-0 items-center justify-center rounded-md border transition-colors",
                            checked
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-input",
                          )}
                        >
                          {checked ? <Check className="size-3.5" /> : null}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold">
                            {exercise.name}
                          </span>
                          <span className="block text-xs text-muted-foreground">
                            {BODY_PART_LABEL[exercise.bodyPart]} ·{" "}
                            {DIFFICULTY_LABEL[exercise.difficulty]}
                          </span>
                        </span>
                      </button>

                      <button
                        type="button"
                        aria-label={
                          favorite ? "즐겨찾기 해제" : "즐겨찾기에 추가"
                        }
                        aria-pressed={favorite}
                        onClick={() => toggleBookmark(exercise.id)}
                        className="shrink-0 rounded-lg p-2"
                      >
                        <Bookmark
                          className={cn(
                            "size-4",
                            favorite
                              ? "fill-brand text-brand-strong"
                              : "text-muted-foreground",
                          )}
                        />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* 하단 고정. 목록을 끝까지 내리지 않아도 담을 수 있어야 한다. */}
          <div className="border-t border-border px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
            <Button
              size="lg"
              disabled={selected.length === 0 || pending}
              onClick={submit}
              className="h-12 w-full rounded-xl font-bold"
            >
              {pending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : selected.length === 0 ? (
                "운동을 선택해주세요"
              ) : (
                `${selected.length}개 추가`
              )}
            </Button>
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}

function EmptyResult({
  keyword,
  favoriteTab,
  onReset,
}: {
  keyword: string;
  favoriteTab: boolean;
  onReset: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-3 py-12 text-center">
      <span className="flex size-12 items-center justify-center rounded-2xl bg-secondary">
        {favoriteTab ? (
          <Bookmark className="size-5 text-muted-foreground" />
        ) : (
          <Search className="size-5 text-muted-foreground" />
        )}
      </span>

      {favoriteTab ? (
        <>
          <p className="text-sm font-semibold">즐겨찾기가 비어 있어요</p>
          <p className="text-xs text-muted-foreground">
            자주 하는 운동의 북마크를 눌러 두면 여기 모입니다.
          </p>
        </>
      ) : (
        <>
          <p className="text-sm font-semibold">
            {keyword
              ? `'${keyword}' 검색 결과가 없어요`
              : "표시할 운동이 없어요"}
          </p>
          <p className="text-xs text-muted-foreground">
            운동 이름이 떠오르지 않으면 부위로 찾아보세요.
          </p>
        </>
      )}

      <Button
        variant="outline"
        size="sm"
        className="rounded-lg"
        onClick={onReset}
      >
        전체 보기
      </Button>
    </div>
  );
}
