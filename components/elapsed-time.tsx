"use client";

import { useEffect, useState } from "react";

import { formatDuration } from "@/lib/date";

/**
 * 경과 시간 표시.
 *
 * 서버에서 계산한 값을 초기값으로 받고 마운트 이후부터만 흘려보낸다.
 * 클라이언트에서 Date.now() 로 처음부터 계산하면 서버 렌더 결과와 달라져
 * 하이드레이션 불일치가 난다.
 */
export function ElapsedTime({ initialSeconds }: { initialSeconds: number }) {
  const [seconds, setSeconds] = useState(initialSeconds);

  useEffect(() => {
    const startedAt = Date.now();
    const timer = setInterval(() => {
      setSeconds(initialSeconds + Math.floor((Date.now() - startedAt) / 1000));
    }, 10_000);

    return () => clearInterval(timer);
  }, [initialSeconds]);

  return <span className="tabular-nums">{formatDuration(seconds)}</span>;
}
