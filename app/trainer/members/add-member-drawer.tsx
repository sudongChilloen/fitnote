"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { UserPlus } from "lucide-react";

import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";

import { createMemberAction } from "./actions";

/**
 * 회원 추가.
 *
 * 이름 하나만 필수다. 전화번호까지 반드시 받게 하면, 번호를 모르는 회원 앞에서
 * 트레이너가 멈춘다. 트레이너가 지금 하려는 건 연락이 아니라 "이 사람 앞으로
 * 10회권" 을 적어 두는 것이다.
 *
 * 이 서랍도 DrawerTrigger 를 쓰지 않고 open 을 직접 쥔다. 이 프로젝트의
 * Drawer 는 base-ui 기반이라 asChild 를 받지 않는다.
 */
export function AddMemberDrawer() {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function submit(formData: FormData) {
    startTransition(async () => {
      const result = await createMemberAction(formData);

      if (result.error) {
        setError(result.error);
        return;
      }

      setOpen(false);
      setError(null);
      router.push(`/trainer/members/${result.connectionId}`);
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
        className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl bg-primary px-3 text-sm font-bold text-primary-foreground"
      >
        <UserPlus className="size-4" aria-hidden />
        회원 추가
      </button>

      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>회원 추가</DrawerTitle>
            <DrawerDescription>
              이름만 적으면 돼요. 회원이 나중에 가입하면 지금부터 쌓이는 기록을
              그대로 이어받아요.
            </DrawerDescription>
          </DrawerHeader>

          <form action={submit} className="flex flex-col gap-3 px-4 pb-6">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-bold">이름</span>
              <input
                name="name"
                required
                maxLength={20}
                autoComplete="off"
                placeholder="김수정"
                className="h-11 rounded-xl border border-border bg-background px-3 text-sm"
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-bold">
                연락처{" "}
                <span className="font-normal text-muted-foreground">
                  (선택)
                </span>
              </span>
              <input
                name="phone"
                type="tel"
                inputMode="tel"
                maxLength={20}
                autoComplete="off"
                placeholder="010-0000-0000"
                className="h-11 rounded-xl border border-border bg-background px-3 text-sm tabular-nums"
              />
            </label>

            {error ? (
              <p className="text-sm font-bold text-red-500">{error}</p>
            ) : null}

            <button
              type="submit"
              disabled={pending}
              className="mt-1 h-12 rounded-xl bg-primary text-sm font-bold text-primary-foreground disabled:opacity-50"
            >
              {pending ? "만드는 중..." : "만들기"}
            </button>
          </form>
        </DrawerContent>
      </Drawer>
    </>
  );
}
