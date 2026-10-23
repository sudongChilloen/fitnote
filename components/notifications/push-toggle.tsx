"use client";

import { useEffect, useState, useTransition } from "react";

import { BellRing } from "lucide-react";

import {
  currentPushToken,
  dropPushToken,
  getPushSupport,
  requestPushToken,
  type PushSupport,
} from "@/lib/firebase-client";

import {
  registerPushTokenAction,
  unregisterPushTokenAction,
} from "@/app/(user)/notifications/actions";

type State = "loading" | PushSupport | "on" | "off" | "denied";

export function PushToggle() {
  const [state, setState] = useState<State>("loading");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let alive = true;

    (async () => {
      const support = await getPushSupport();
      if (!alive) return;

      if (support !== "supported") return setState(support);
      if (Notification.permission === "denied") return setState("denied");

      // 권한이 있어도 서버에 등록돼 있다고 단정하지 않고, 토큰이 있으면 켜진 것으로 본다.
      const token = await currentPushToken();
      if (alive) setState(token ? "on" : "off");
    })();

    return () => {
      alive = false;
    };
  }, []);

  if (state === "loading" || state === "unconfigured") return null;

  if (state === "unsupported") {
    return (
      <p className="mt-4 rounded-xl border border-dashed border-border px-3.5 py-2.5 text-xs text-muted-foreground">
        이 브라우저는 푸시 알림을 지원하지 않아요. iPhone은 홈 화면에 추가한
        앱에서만 받을 수 있어요.
      </p>
    );
  }

  if (state === "denied") {
    return (
      <p className="mt-4 rounded-xl border border-dashed border-border px-3.5 py-2.5 text-xs text-muted-foreground">
        브라우저에서 알림이 차단돼 있어요. 사이트 설정에서 알림을 허용해 주세요.
      </p>
    );
  }

  const on = state === "on";

  function toggle() {
    setMessage(null);

    startTransition(async () => {
      try {
        if (on) {
          const token = await currentPushToken();
          if (token) await unregisterPushTokenAction(token);
          await dropPushToken();
          setState("off");
          return;
        }

        const token = await requestPushToken();

        if (!token) {
          setState(Notification.permission === "denied" ? "denied" : "off");
          return;
        }

        const result = await registerPushTokenAction(
          token,
          "WEB",
          navigator.userAgent.slice(0, 80),
        );

        if (result.error) {
          setMessage(result.error);
          return;
        }

        setState("on");
      } catch {
        setMessage("푸시 설정에 실패했어요. 잠시 후 다시 시도해 주세요.");
      }
    });
  }

  return (
    <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4">
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-accent text-brand-strong">
          <BellRing className="size-4" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-bold">푸시 알림</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {message ?? (on ? "이 기기로 알림을 받고 있어요" : "앱을 닫아도 알림을 받아요")}
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        className="inline-flex h-9 shrink-0 items-center rounded-xl border border-border px-3 text-xs font-bold transition-colors hover:bg-secondary disabled:opacity-50"
      >
        {pending ? "처리 중" : on ? "끄기" : "켜기"}
      </button>
    </div>
  );
}
