"use client";

import { Loader2, Play } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { formatDuration } from "@/lib/date";

import { startWorkout } from "./actions";

type ActiveSession = {
  id: string;
  /** 서버에서 계산한 경과 시간. 렌더 중 Date.now() 를 부르지 않기 위함 */
  elapsedSec: number;
  exerciseCount: number;
};

/**
 * 운동 시작 버튼.
 *
 * 홈에서 진행중 세션 배너를 이미 보여주므로 보통은 바로 시작된다.
 * 다른 기기에서 시작해 둔 세션이 있으면 서버가 conflict 를 돌려주고,
 * 그때만 "이어서 / 새로 시작" 을 묻는다.
 */
export function StartWorkoutButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [active, setActive] = useState<ActiveSession | null>(null);
  const [error, setError] = useState<string | null>(null);

  function run(mode: "ask" | "new") {
    setError(null);

    startTransition(async () => {
      const result = await startWorkout(mode);

      if (result.conflict) {
        setActive(result.activeSession);
      } else {
        setError(result.error);
      }
    });
  }

  const elapsed = active ? formatDuration(active.elapsedSec) : null;

  return (
    <>
      <Button
        size="lg"
        className="h-14 w-full rounded-2xl text-base font-bold"
        disabled={pending}
        onClick={() => run("ask")}
      >
        {pending ? (
          <Loader2 className="size-5 animate-spin" />
        ) : (
          <Play className="size-5 fill-current" />
        )}
        운동 시작하기
      </Button>

      {error ? (
        <p role="alert" className="mt-2 text-center text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <Drawer open={active !== null} onOpenChange={(open) => !open && setActive(null)}>
        <DrawerContent className="mx-auto max-w-md">
          <DrawerHeader className="text-left">
            <DrawerTitle>진행 중인 운동이 있어요</DrawerTitle>
            <DrawerDescription>
              {elapsed} 전에 시작했고
              {active?.exerciseCount
                ? ` 운동 ${active.exerciseCount}개를 기록했어요.`
                : " 아직 기록한 운동이 없어요."}
            </DrawerDescription>
          </DrawerHeader>

          <DrawerFooter>
            <Button
              size="lg"
              className="h-12 rounded-xl font-bold"
              onClick={() => active && router.push(`/workouts/${active.id}`)}
            >
              이어서 하기
            </Button>

            <Button
              size="lg"
              variant="outline"
              className="h-12 rounded-xl font-bold"
              disabled={pending}
              onClick={() => run("new")}
            >
              새로 시작하기
            </Button>

            <Button
              variant="ghost"
              className="h-11 rounded-xl"
              onClick={() => setActive(null)}
            >
              취소
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </>
  );
}
