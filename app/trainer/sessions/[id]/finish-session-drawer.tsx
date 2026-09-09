"use client";

import { useState } from "react";

import { Check, RotateCcw, UserX, CalendarX } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";

import { finishSessionAction } from "./actions";

type Intent = "complete" | "no_show" | "cancel";

/**
 * 수업을 마무리하는 모달.
 *
 * 버튼 하나로 "수업 완료" 만 두면 회원이 안 온 날 갈 데가 없다. 그럼 계약
 * 상세를 뒤지거나, 귀찮아서 그냥 완료를 눌러 버린다. 후자가 더 자주 일어나고
 * 그러면 남은 횟수가 틀어진다.
 *
 * 그래서 수업이 끝나는 네 갈래를 여기 다 둔다. 겉에는 가장 흔한 "수업 마무리"
 * 하나만 보이고, 눌러야 나머지가 나온다 — 수업 사이 2분 동안 화면에 버튼 네
 * 개가 깔려 있으면 매번 읽어야 한다.
 *
 * 차감 여부는 상태에서 자동으로 정하지 않는다. 노쇼 정책은 트레이너마다 다르고,
 * 같은 트레이너도 상황에 따라 봐준다. 여기서 규칙을 정해 버리면 봐주고 싶을 때
 * 손쓸 방법이 없다.
 */
export function FinishSessionDrawer({
  ptSessionId,
  memberName,
  remaining,
}: {
  ptSessionId: string;
  memberName: string;
  remaining: number;
}) {
  const [intent, setIntent] = useState<Intent | null>(null);

  return (
    <>
      <Button
        type="button"
        size="lg"
        className="h-12 w-full rounded-xl text-sm font-bold"
        onClick={() => setIntent("complete")}
      >
        <Check className="size-4" aria-hidden />
        수업 마무리
      </Button>
      <p className="mt-2 text-center text-xs text-muted-foreground">
        했는지 · 안 왔는지 여기서 정해요. 남은 {remaining}회
      </p>

      <Drawer
        open={intent !== null}
        onOpenChange={(open) => !open && setIntent(null)}
      >
        <DrawerContent className="mx-auto max-w-md">
          <DrawerHeader className="text-left">
            <DrawerTitle>{memberName} 회원 수업</DrawerTitle>
            <DrawerDescription>
              어떻게 끝났는지 골라 주세요. 나중에 되돌릴 수 있어요.
            </DrawerDescription>
          </DrawerHeader>

          <div className="px-4 pb-2">
            <div
              role="radiogroup"
              aria-label="수업 마무리 방법"
              className="flex flex-col gap-2"
            >
              <Choice
                icon={Check}
                title="수업 했어요"
                detail={`PT 횟수가 한 회 깎여요. 남은 ${remaining}회 → ${Math.max(remaining - 1, 0)}회`}
                selected={intent === "complete"}
                onSelect={() => setIntent("complete")}
              />
              <Choice
                icon={UserX}
                title="회원이 안 왔어요"
                detail="차감할지 아래에서 고를 수 있어요."
                selected={intent === "no_show"}
                onSelect={() => setIntent("no_show")}
              />
              <Choice
                icon={CalendarX}
                title="수업을 취소했어요"
                detail="미리 연락받고 접은 수업이에요."
                selected={intent === "cancel"}
                onSelect={() => setIntent("cancel")}
              />
            </div>
          </div>

          <form action={finishSessionAction}>
            <input type="hidden" name="ptSessionId" value={ptSessionId} />
            <input type="hidden" name="intent" value={intent ?? "complete"} />

            {intent !== "complete" ? (
              <div className="flex flex-col gap-3 px-4 pt-3">
                {intent === "cancel" ? (
                  <label className="flex flex-col gap-1.5">
                    <span className="text-xs font-semibold text-muted-foreground">
                      누가 취소했나요
                    </span>
                    <select
                      name="cancelledBy"
                      defaultValue="MEMBER"
                      className="h-11 rounded-xl border border-border bg-background px-3 text-sm"
                    >
                      <option value="MEMBER">회원</option>
                      <option value="TRAINER">트레이너</option>
                    </select>
                  </label>
                ) : null}

                {/*
                  차감은 기본으로 꺼 둔다. 봐주는 쪽이 되돌리기 쉬워서다 — 안
                  깎았다가 나중에 깎는 건 되지만, 깎아 놓고 회원이 항의하면
                  그때는 이미 껄끄러운 대화가 시작된 뒤다.
                */}
                <label className="flex items-center gap-2.5 rounded-xl border border-border px-3.5 py-3">
                  <input
                    type="checkbox"
                    name="deduct"
                    className="size-4 accent-current"
                  />
                  <span className="text-sm font-semibold">
                    PT 횟수 차감하기
                  </span>
                </label>

                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-semibold text-muted-foreground">
                    메모 (선택)
                  </span>
                  <input
                    type="text"
                    name="reason"
                    maxLength={200}
                    placeholder="예: 당일 연락, 다음 주로 미룸"
                    className="h-11 rounded-xl border border-border bg-background px-3 text-sm"
                  />
                </label>
              </div>
            ) : null}

            <DrawerFooter>
              <Button
                type="submit"
                size="lg"
                className="h-12 rounded-xl font-bold"
              >
                {intent === "complete"
                  ? "완료로 저장"
                  : intent === "no_show"
                    ? "노쇼로 저장"
                    : "취소로 저장"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="h-11 rounded-xl"
                onClick={() => setIntent(null)}
              >
                닫기
              </Button>
            </DrawerFooter>
          </form>
        </DrawerContent>
      </Drawer>
    </>
  );
}

function Choice({
  icon: Icon,
  title,
  detail,
  selected,
  onSelect,
}: {
  icon: typeof Check;
  title: string;
  detail: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={
        selected
          ? "flex items-start gap-3 rounded-xl border-2 border-primary bg-accent px-3.5 py-3 text-left"
          : "flex items-start gap-3 rounded-xl border border-border px-3.5 py-3 text-left"
      }
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span className="min-w-0">
        <span className="block text-sm font-bold">{title}</span>
        <span className="mt-0.5 block text-xs text-muted-foreground">
          {detail}
        </span>
      </span>
    </button>
  );
}

/** 마무리한 수업을 다시 예정으로 되돌린다. */
export function ReopenSessionButton({ ptSessionId }: { ptSessionId: string }) {
  return (
    <form action={finishSessionAction}>
      <input type="hidden" name="ptSessionId" value={ptSessionId} />
      <input type="hidden" name="intent" value="reopen" />
      <button
        type="submit"
        className="flex h-10 w-full items-center justify-center gap-1.5 rounded-xl text-xs font-semibold text-muted-foreground"
      >
        <RotateCcw className="size-3.5" aria-hidden />
        예정으로 되돌리기
      </button>
    </form>
  );
}
