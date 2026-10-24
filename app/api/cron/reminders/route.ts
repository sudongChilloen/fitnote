import { timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";

import { runDailyReminders } from "@/server/notifications/reminder.service";

/**
 * 하루 한 번 Vercel Cron 이 부른다 (vercel.json 의 crons).
 *
 * Vercel 은 CRON_SECRET 환경변수가 있으면 Authorization: Bearer <값> 을 붙여
 * 부른다. 이 주소는 로그인 없이 열려 있으므로, 값이 없거나 틀리면 아무것도
 * 하지 않는다. 값이 설정되지 않은 환경에서는 막혀 있는 쪽이 기본이다.
 */
function isAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const expected = Buffer.from(`Bearer ${secret}`);
  const received = Buffer.from(request.headers.get("authorization") ?? "");

  return (
    expected.length === received.length && timingSafeEqual(expected, received)
  );
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const result = await runDailyReminders();

  return NextResponse.json({ ok: true, ...result });
}
