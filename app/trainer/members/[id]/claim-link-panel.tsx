"use client";

import { useState, useSyncExternalStore, useTransition } from "react";

import { issueClaimLinkAction } from "../actions";

// 서버에서 그릴 때는 주소를 모른다. 브라우저에서만 현재 주소를 읽는다.
const subscribeNothing = () => () => {};

/**
 * 아직 가입하지 않은 회원에게 보낼 가입 링크.
 *
 * 링크를 열면 이 회원의 이름이 적힌 이어받기 화면이 나온다. 코드는 회원마다
 * 하나이고, 새로 만들면 이전 링크는 닫힌다.
 */
export function ClaimLinkPanel({
  connectionId,
  initialCode,
  initialExpiresAt,
}: {
  connectionId: string;
  initialCode: string | null;
  initialExpiresAt: string | null;
}) {
  const [code, setCode] = useState(initialCode);
  const [expiresAt, setExpiresAt] = useState(initialExpiresAt);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();

  const origin = useSyncExternalStore(
    subscribeNothing,
    () => window.location.origin,
    () => "",
  );
  const link = code ? `${origin}/signup?code=${code}` : null;

  function issue() {
    setError(null);
    setCopied(false);

    startTransition(async () => {
      const result = await issueClaimLinkAction(connectionId);

      if (result.error) {
        setError(result.error);
        return;
      }

      setCode(result.code);
      setExpiresAt(result.expiresAt);
    });
  }

  async function copy() {
    if (!link) return;

    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      setError("복사하지 못했어요. 링크를 길게 눌러 직접 복사해 주세요.");
    }
  }

  return (
    <section className="mt-3 rounded-[1.375rem] border border-border p-4">
      <h2 className="text-[0.9375rem] font-bold">가입 링크</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        회원에게 이 링크를 보내면 가입하면서 지금까지의 기록을 이어받아요.
      </p>

      {link ? (
        <>
          <p className="mt-3 rounded-[0.875rem] bg-brand-muted px-3 py-2.5 font-mono text-primary text-xs break-all">
            {link}
          </p>
          {expiresAt ? (
            <p className="mt-1 text-xs text-muted-foreground tabular-nums">
              {new Date(expiresAt).toLocaleDateString("ko-KR", {
                timeZone: "Asia/Seoul",
                month: "long",
                day: "numeric",
              })}
              까지 쓸 수 있어요
            </p>
          ) : null}
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={copy}
              className="h-11 flex-1 rounded-full bg-primary font-bold text-primary-foreground"
            >
              {copied ? "복사했어요" : "링크 복사"}
            </button>
            <button
              type="button"
              onClick={issue}
              disabled={pending}
              className="h-11 shrink-0 rounded-full border border-border px-4 text-sm font-semibold disabled:opacity-50"
            >
              {pending ? "만드는 중" : "새로 만들기"}
            </button>
          </div>
        </>
      ) : (
        <button
          type="button"
          onClick={issue}
          disabled={pending}
          className="mt-3 h-11 w-full rounded-full border border-border font-semibold disabled:opacity-50"
        >
          {pending ? "만드는 중" : "가입 링크 만들기"}
        </button>
      )}

      {error ? <p className="mt-2 text-xs text-destructive">{error}</p> : null}
    </section>
  );
}
