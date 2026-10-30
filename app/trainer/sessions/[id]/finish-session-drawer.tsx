"use client";

import { useState } from "react";

import { Check, RotateCcw, UserX, CalendarX } from "lucide-react";

import { Button } from "@/components/ui/button";

import { finishSessionAction } from "./actions";

type Intent = "complete" | "no_show" | "cancel";

/**
 * 수업 마무리 (v3: 화면 안에 펼쳐 둔 카드).
 *
 * 버튼 하나로 "수업 완료" 만 두면 회원이 안 온 날 갈 데가 없다. 그럼 계약
 * 상세를 뒤지거나, 귀찮아서 그냥 완료를 눌러 버린다. 후자가 더 자주 일어나고
 * 그러면 남은 횟수가 틀어진다. 그래서 끝나는 갈래를 카드 안에 다 보여 준다.
 *
 * 화면 아래에 고정하지 않고 수업 기록 맨 끝에 둔다. 기록을 다 적고 내려오면
 * 자연스럽게 닿는 자리고, 기록을 적는 동안 버튼이 손가락을 가리지 않는다.
 *
 * 차감 여부는 상태에서 자동으로 정하지 않는다. 노쇼 정책은 트레이너마다 다르고,
 * 같은 트레이너도 상황에 따라 봐준다.
 */
export function FinishSessionPanel({
  ptSessionId,
  remaining,
  summary,
}: {
  ptSessionId: string;
  remaining: number;
  /** "3개 운동 · 10세트 저장됨" 처럼 지금까지 적은 것 */
  summary?: string;
}) {
  const [intent, setIntent] = useState<Intent>("complete");

  return (
    <section className="rounded-3xl border-[1.5px] border-primary p-4">
      <h2 className="text-[1.0625rem] font-extrabold">수업 마무리</h2>
      <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">
        {summary ? `${summary} · ` : ""}출석 결과에 따라 남은 횟수가 바뀌어요
      </p>

      <div
        role="radiogroup"
        aria-label="수업 마무리 방법"
        className="mt-3 flex flex-col gap-1.5"
      >
        <Choice
          icon={Check}
          title="수업 했어요"
          detail={`남은 ${remaining}회 → ${Math.max(remaining - 1, 0)}회`}
          tag="1회 차감"
          selected={intent === "complete"}
          onSelect={() => setIntent("complete")}
        />
        <Choice
          icon={UserX}
          title="회원이 안 왔어요"
          detail="차감할지 아래에서 고를 수 있어요"
          tag="노쇼"
          warn
          selected={intent === "no_show"}
          onSelect={() => setIntent("no_show")}
        />
        <Choice
          icon={CalendarX}
          title="수업을 취소했어요"
          detail="미리 연락받고 접은 수업이에요"
          tag="취소"
          selected={intent === "cancel"}
          onSelect={() => setIntent("cancel")}
        />
      </div>

      <form action={finishSessionAction}>
        <input type="hidden" name="ptSessionId" value={ptSessionId} />
        <input type="hidden" name="intent" value={intent} />

        {intent !== "complete" ? (
          <div className="flex flex-col gap-2.5 pt-3">
            {intent === "cancel" ? (
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-bold text-muted-foreground">
                  누가 취소했나요
                </span>
                <select
                  name="cancelledBy"
                  defaultValue="MEMBER"
                  className="h-11 rounded-[0.875rem] border border-border bg-background px-3 text-sm"
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
            <label className="flex items-center gap-2.5 rounded-[0.875rem] bg-[#f7f8f7] px-3.5 py-3">
              <input type="checkbox" name="deduct" className="size-4 accent-primary" />
              <span className="text-sm font-semibold">PT 횟수 차감하기</span>
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-bold text-muted-foreground">
                메모 (선택)
              </span>
              <input
                type="text"
                name="reason"
                maxLength={200}
                placeholder="예: 당일 연락, 다음 주로 미룸"
                className="h-11 rounded-[0.875rem] border border-border bg-background px-3 text-sm"
              />
            </label>
          </div>
        ) : null}

        <Button
          type="submit"
          size="lg"
          className="mt-3 h-12.5 w-full rounded-full bg-primary text-[0.9375rem] font-extrabold text-white hover:bg-primary/90"
        >
          {intent === "complete"
            ? "완료로 저장"
            : intent === "no_show"
              ? "노쇼로 저장"
              : "취소로 저장"}
        </Button>
      </form>
    </section>
  );
}

function Choice({
  icon: Icon,
  title,
  detail,
  tag,
  warn = false,
  selected,
  onSelect,
}: {
  icon: typeof Check;
  title: string;
  detail: string;
  tag: string;
  warn?: boolean;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      // 선택 여부와 상관없이 크기·모서리를 같게 둔다. 고를 때마다 칸이
      // 줄었다 늘었다 하면 손가락 아래서 버튼이 움직인다.
      className={
        selected
          ? "flex items-center gap-2.5 rounded-2xl border-[1.5px] border-primary bg-[#f3faf6] p-3 text-left"
          : "flex items-center gap-2.5 rounded-2xl border-[1.5px] border-border bg-card p-3 text-left transition-colors hover:bg-surface"
      }
    >
      <span
        aria-hidden
        className={
          selected
            ? "flex size-5 shrink-0 items-center justify-center rounded-full border-2 border-primary"
            : "flex size-5 shrink-0 items-center justify-center rounded-full border-2 border-input"
        }
      >
        {selected ? <span className="size-2.5 rounded-full bg-primary" /> : null}
      </span>
      <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold">{title}</span>
        <span className="block truncate text-xs text-muted-foreground">{detail}</span>
      </span>
      <span
        className={
          warn
            ? "shrink-0 text-xs font-bold text-status-urgent"
            : "shrink-0 text-xs font-bold text-primary"
        }
      >
        {tag}
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
        className="flex h-10 w-full items-center justify-center gap-1.5 rounded-full text-xs font-semibold text-muted-foreground"
      >
        <RotateCcw className="size-3.5" aria-hidden />
        예정으로 되돌리기
      </button>
    </form>
  );
}
