"use client";

import { Loader2 } from "lucide-react";
import { useTransition } from "react";

import { Button } from "@/components/ui/button";

import { finishWorkout } from "../actions";

export function FinishWorkoutButton({
  sessionId,
  manual = false,
}: {
  sessionId: string;
  manual?: boolean;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      size="lg"
      className="h-12 w-full rounded-xl font-bold"
      disabled={pending}
      onClick={() => startTransition(() => finishWorkout(sessionId))}
    >
      {pending ? <Loader2 className="size-4 animate-spin" /> : null}
      {manual ? "기록 저장" : "운동 종료"}
    </Button>
  );
}
