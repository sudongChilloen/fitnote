"use client";

import { useState } from "react";

import { PushPreferences } from "./push-preferences";
import { PushToggle } from "./push-toggle";

/**
 * 푸시 켜기와 종류별 설정.
 *
 * 이 기기에서 푸시가 꺼져 있으면 종류별 스위치는 보여주지 않는다. 받을 수 없는
 * 알림의 종류를 고르게 하면 "켰는데 왜 안 와요" 가 된다. 고른 값은 그대로 남는다.
 */
export function PushSettings({
  categories,
  disabled,
}: {
  categories: { type: string; label: string; hint: string }[];
  disabled: string[];
}) {
  const [on, setOn] = useState(false);

  return (
    <>
      <PushToggle onChange={setOn} />
      {on ? <PushPreferences categories={categories} disabled={disabled} /> : null}
    </>
  );
}
