"use client";

import {
  Bookmark,
  Check,
  Loader2,
  Plus,
  Search,
  X,
} from "lucide-react";
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

import {
  addExercisesToSession,
  toggleExerciseFavorite,
} from "../actions";

type ExerciseItem = {
  id: string;
  name: string;
  bodyPart: WorkoutBodyPart;
  difficulty: keyof typeof DIFFICULTY_LABEL;
};

/**
 * 운동 목록 필터.
 *
 * 검색 중에는 부위 필터보다 검색 결과를 우선한다.
 * 즐겨찾기는 검색과 함께 사용하지 않고 독립적인 빠른 필터로 사용한다.
 */
type Tab =
  | { kind: "all" }
  | { kind: "favorite" }
  | { kind: "part"; value: WorkoutBodyPart };

export function AddExerciseDrawer({
  sessionId,
  bodyPartCounts,
  favoriteIds,
  addedExerciseIds,
}: {
  sessionId: string;
  bodyPartCounts: Partial<Record<WorkoutBodyPart, number>>;
  favoriteIds: string[];
  /**
   * 현재 수업에 이미 담긴 운동.
   *
   * 같은 운동을 다시 추가하는 것을 막지는 않는다.
   * 서킷이나 동일 운동을 나눠 기록하는 경우가 있을 수 있기 때문이다.
   */
  addedExerciseIds: string[];
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

  /**
   * 검색어가 있으면 부위 필터를 무시한다.
   *
   * 예:
   * 하체 탭을 보고 있다가 "스쿼트"를 검색하면
   * 하체에 한정된 검색이 아니라 전체 운동에서 스쿼트를 찾는다.
   */
  const bodyPart =
    keyword || tab.kind !== "part" ? null : tab.value;

  const queryKey = keyword
    ? `search:${keyword}`
    : `part:${bodyPart ?? "all"}`;

  /**
   * 서버에서 받아온 결과.
   *
   * queryKey를 함께 저장해서 이전 검색 결과가
   * 새로운 검색 화면에 잠깐 노출되는 것을 방지한다.
   */
  const [result, setResult] = useState<{
    key: string;
    items: ExerciseItem[];
  }>({
    key: "",
    items: [],
  });

  const fetched =
    result.key === queryKey ? result.items : [];

  /**
   * 즐겨찾기는 별도 API를 호출하지 않고
   * 현재 받아온 운동 목록에서 즉시 필터링한다.
   */
  const items =
    !keyword && tab.kind === "favorite"
      ? fetched.filter((exercise) =>
          favorites.includes(exercise.id),
        )
      : fetched;

  useEffect(() => {
    if (!open) return;

    const controller = new AbortController();

    // 검색어를 입력할 때마다 즉시 요청하지 않고 250ms 기다린다.
    const timer = setTimeout(async () => {
      setLoading(true);

      try {
        const params = new URLSearchParams({
          limit: "100",
        });

        if (keyword) {
          params.set("search", keyword);
        } else if (bodyPart) {
          params.set("bodyPart", bodyPart);
        }

        const res = await fetch(
          `/api/exercises?${params}`,
          {
            signal: controller.signal,
          },
        );

        const body = await res.json();

        if (!controller.signal.aborted) {
          setResult({
            key: queryKey,
            items: res.ok
              ? (body.data ?? [])
              : [],
          });
        }
      } catch {
        // AbortController에 의한 취소는 정상 동작이다.
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
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
    const wasFavorite =
      favorites.includes(exerciseId);

    // 서버 응답을 기다리지 않고 UI를 먼저 변경한다.
    setFavorites((prev) =>
      wasFavorite
        ? prev.filter((id) => id !== exerciseId)
        : [...prev, exerciseId],
    );

    startTransition(async () => {
      const res =
        await toggleExerciseFavorite(exerciseId);

      // 실패하면 원래 상태로 되돌린다.
      if (res.error) {
        setFavorites((prev) =>
          wasFavorite
            ? [...prev, exerciseId]
            : prev.filter(
                (id) => id !== exerciseId,
              ),
        );
      }
    });
  }

  function submit() {
    if (selected.length === 0) return;

    setError(null);

    startTransition(async () => {
      const res = await addExercisesToSession(
        sessionId,
        selected,
      );

      if (res.error) {
        setError(res.error);
        return;
      }

      setOpen(false);
      reset();
    });
  }

  const tabs: {
    key: string;
    label: string;
    tab: Tab;
  }[] = [
    {
      key: "all",
      label: "전체",
      tab: { kind: "all" },
    },
    ...BODY_PART_OPTIONS.filter(
      ([value]) =>
        (bodyPartCounts[value] ?? 0) > 0,
    ).map(([value, label]) => ({
      key: value,
      label,
      tab: {
        kind: "part",
        value,
      } as Tab,
    })),
  ];

  const activeKey =
    tab.kind === "part"
      ? tab.value
      : tab.kind === "favorite"
        ? "favorite"
        : "all";

  const duplicateCount = selected.filter((id) =>
    addedExerciseIds.includes(id),
  ).length;

  return (
    <>
      {/* =====================================================
          ADD BUTTON
         ===================================================== */}

      <Button
        variant="outline"
        size="lg"
        className={cn(
          "h-12 w-full rounded-xl",
          "border-2 border-dashed",
          "font-bold",
          "transition-colors",
          "hover:bg-secondary",
        )}
        onClick={() => setOpen(true)}
      >
        <Plus className="size-4" />
        운동 추가
      </Button>

      {/* =====================================================
          DRAWER
         ===================================================== */}

      <Drawer
        open={open}
        onOpenChange={(next) => {
          setOpen(next);

          if (!next) {
            reset();
          }
        }}
      >
        <DrawerContent className="mx-auto flex h-[85dvh] max-w-md flex-col">
          {/* -------------------------------------------------
              HEADER
             ------------------------------------------------- */}

          <DrawerHeader className="pb-3 text-center">
            <DrawerTitle>
              운동 선택하기
            </DrawerTitle>
          </DrawerHeader>

          {/* -------------------------------------------------
              SEARCH
             ------------------------------------------------- */}

          <div className="px-4">
            <div className="relative">
              <Search
                className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />

              <input
                type="text"
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
                placeholder="운동 이름을 검색해보세요"
                aria-label="운동 검색"
                className={cn(
                  "h-11 w-full rounded-xl",
                  "bg-secondary",
                  "pr-10 pl-9",
                  "text-sm",
                  "outline-none",
                  "focus:ring-2 focus:ring-ring/40",
                )}
              />

              {keyword ? (
                <button
                  type="button"
                  aria-label="검색어 지우기"
                  onClick={() => setSearch("")}
                  className="absolute top-1/2 right-2 -translate-y-1/2 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
                >
                  <X
                    className="size-4"
                    aria-hidden
                  />
                </button>
              ) : null}
            </div>
          </div>

          {/* -------------------------------------------------
              FILTERS
             ------------------------------------------------- */}

          <div className="mt-3 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {/* 즐겨찾기 */}
            <button
              type="button"
              aria-label="즐겨찾기만 보기"
              aria-pressed={
                tab.kind === "favorite"
              }
              onClick={() =>
                setTab(
                  tab.kind === "favorite"
                    ? { kind: "all" }
                    : { kind: "favorite" },
                )
              }
              className={cn(
                "flex size-9 shrink-0 items-center justify-center rounded-full border transition-colors",
                tab.kind === "favorite"
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border text-muted-foreground hover:bg-secondary",
              )}
            >
              <Bookmark
                className="size-4"
                aria-hidden
              />
            </button>

            {/* 전체 / 부위 */}
            {tabs.map((item) => (
              <button
                key={item.key}
                type="button"
                aria-pressed={
                  activeKey === item.key
                }
                onClick={() =>
                  setTab(item.tab)
                }
                className={cn(
                  "shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition-colors",
                  activeKey === item.key
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border text-foreground hover:bg-secondary",
                )}
              >
                {item.label}
              </button>
            ))}
          </div>

          {/* -------------------------------------------------
              ERROR
             ------------------------------------------------- */}

          {error ? (
            <p
              role="alert"
              className="px-4 pt-3 text-sm text-destructive"
            >
              {error}
            </p>
          ) : null}

          {/* -------------------------------------------------
              RESULT LIST
             ------------------------------------------------- */}

          <div className="min-h-0 flex-1 overflow-y-auto px-4 pt-2">
            {loading && fetched.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-14">
                <Loader2 className="size-5 animate-spin text-muted-foreground" />

                <p className="mt-3 text-sm text-muted-foreground">
                  운동 목록을 불러오는 중…
                </p>
              </div>
            ) : items.length === 0 ? (
              <EmptyResult
                keyword={keyword}
                favoriteTab={
                  !keyword &&
                  tab.kind === "favorite"
                }
                onReset={() => {
                  setSearch("");
                  setTab({ kind: "all" });
                }}
              />
            ) : (
              <ul className="divide-y divide-border">
                {items.map((exercise) => {
                  const checked =
                    selected.includes(
                      exercise.id,
                    );

                  const favorite =
                    favorites.includes(
                      exercise.id,
                    );

                  const added =
                    addedExerciseIds.includes(
                      exercise.id,
                    );

                  return (
                    <li
                      key={exercise.id}
                      className="flex items-center gap-2 py-1"
                    >
                      {/* 운동 선택 */}
                      <button
                        type="button"
                        aria-pressed={checked}
                        onClick={() =>
                          toggle(exercise.id)
                        }
                        className="flex min-w-0 flex-1 items-center gap-3 rounded-xl py-2.5 text-left transition-colors hover:bg-secondary/60"
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
                          {checked ? (
                            <Check className="size-3.5" />
                          ) : null}
                        </span>

                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-1.5">
                            <span className="truncate text-sm font-semibold">
                              {exercise.name}
                            </span>

                            {added ? (
                              <span className="shrink-0 rounded-full bg-accent px-1.5 py-0.5 text-[0.65rem] font-bold text-brand-strong">
                                담김
                              </span>
                            ) : null}
                          </span>

                          <span className="block text-xs text-muted-foreground">
                            {
                              BODY_PART_LABEL[
                                exercise.bodyPart
                              ]
                            }

                            {" · "}

                            {
                              DIFFICULTY_LABEL[
                                exercise.difficulty
                              ]
                            }
                          </span>
                        </span>
                      </button>

                      {/* 즐겨찾기 */}
                      <button
                        type="button"
                        aria-label={
                          favorite
                            ? "즐겨찾기 해제"
                            : "즐겨찾기에 추가"
                        }
                        aria-pressed={favorite}
                        onClick={() =>
                          toggleBookmark(
                            exercise.id,
                          )
                        }
                        className="shrink-0 rounded-lg p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                      >
                        <Bookmark
                          className={cn(
                            "size-4",
                            favorite
                              ? "fill-brand text-brand-strong"
                              : "text-muted-foreground",
                          )}
                          aria-hidden
                        />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* -------------------------------------------------
              BOTTOM ACTION
             ------------------------------------------------- */}

          <div className="border-t border-border bg-card px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
            {duplicateCount > 0 ? (
              <p className="mb-2 text-center text-xs text-brand-strong">
                이미 담긴 운동{" "}
                {duplicateCount}개가 있어요.
                <br />
                그대로 추가하면 별도 기록으로 남아요.
              </p>
            ) : null}

            <Button
              size="lg"
              disabled={
                selected.length === 0 ||
                pending
              }
              onClick={submit}
              className="h-12 w-full rounded-xl font-bold"
            >
              {pending ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  추가하는 중…
                </>
              ) : selected.length === 0 ? (
                "운동을 선택해주세요"
              ) : (
                `${selected.length}개 운동 추가`
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
          <Bookmark
            className="size-5 text-muted-foreground"
            aria-hidden
          />
        ) : (
          <Search
            className="size-5 text-muted-foreground"
            aria-hidden
          />
        )}
      </span>

      {favoriteTab ? (
        <>
          <p className="text-sm font-semibold">
            즐겨찾기가 비어 있어요
          </p>

          <p className="text-xs text-muted-foreground">
            자주 하는 운동은 북마크해 두면
            빠르게 찾을 수 있어요.
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
            운동 이름이 떠오르지 않으면
            부위로 찾아보세요.
          </p>
        </>
      )}

      <Button
        variant="outline"
        size="sm"
        className="rounded-lg"
        onClick={onReset}
      >
        전체 운동 보기
      </Button>
    </div>
  );
}