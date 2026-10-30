"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Plus, UserPlus } from "lucide-react";

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
        className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-ink pr-3.5 pl-2.5 text-[0.8125rem] font-bold text-white transition-transform active:scale-[0.98]"
      >
        <span className="flex size-5.5 items-center justify-center rounded-full bg-brand text-ink">
          <Plus className="size-3.5" strokeWidth={3} aria-hidden />
        </span>
        회원 추가
      </button>

      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent>
          <DrawerHeader>
            <div className="mb-2 flex size-11 items-center justify-center rounded-full bg-brand-muted text-primary">
              <UserPlus className="size-5" aria-hidden />
            </div>

            <DrawerTitle className="text-lg font-extrabold">
              회원 추가
            </DrawerTitle>

            <DrawerDescription className="text-sm leading-relaxed">
              이름만 입력해도 회원을 등록할 수 있어요. 나중에 회원이 가입하면
              지금까지 쌓인 기록을 이어받아요.
            </DrawerDescription>
          </DrawerHeader>

          <form action={submit} className="flex flex-col gap-5 px-4 pb-7">
            <label className="flex flex-col gap-2">
              <span className="text-sm font-bold">
                이름 <span className="text-destructive">*</span>
              </span>

              <input
                name="name"
                required
                maxLength={20}
                autoComplete="off"
                placeholder="회원 이름 입력"
                className="h-12 rounded-2xl border border-border bg-background px-3.5 text-sm tabular-nums outline-none transition-shadow placeholder:text-muted-foreground/70 focus:border-primary focus:ring-2 focus:ring-primary/15"
              />

              <span className="text-xs leading-relaxed text-muted-foreground">
                회원을 구분할 수 있는 이름을 입력해 주세요.
              </span>
            </label>

            <label className="flex flex-col gap-2">
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
                className="h-12 rounded-2xl border border-border bg-background px-3.5 text-sm tabular-nums outline-none transition-shadow placeholder:text-muted-foreground/70 focus:border-primary focus:ring-2 focus:ring-primary/15"
              />

              <span className="text-xs leading-relaxed text-muted-foreground">
                지금 연락처를 몰라도 나중에 등록할 수 있어요.
              </span>
            </label>

            {error ? (
              <p
                role="alert"
                className="rounded-[0.875rem] bg-status-urgent-bg px-3.5 py-3 text-sm font-semibold text-status-urgent"
              >
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={pending}
              className="mt-1 inline-flex h-12 w-full items-center justify-center rounded-full bg-primary px-4 text-sm font-bold text-primary-foreground shadow-sm transition-colors hover:brightness-95 active:brightness-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {pending ? "등록하는 중..." : "회원 등록하기"}
            </button>
          </form>
        </DrawerContent>
      </Drawer>
    </>
  );
}
