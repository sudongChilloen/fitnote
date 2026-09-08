"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/app/lib/dal";
import { kstDateTimeToUtc, toKstDateKey } from "@/lib/date";
import { PTError, scheduleSession } from "@/server/pt/pt.service";
import { TrainerError } from "@/server/trainers/trainer.service";

/**
 * 일정 화면에서 바로 수업을 잡는다.
 *
 * 계약 상세의 폼과 하는 일은 같지만 돌아가는 곳이 다르다. 여기서 잡은 사람은
 * 일정을 보고 있었으므로 일정으로 돌아가야 하고, 방금 잡은 날이 보여야 한다.
 * 계약 상세로 튕기면 잡을 때마다 뒤로 두 번 눌러 돌아와야 한다.
 *
 * 결과를 redirect 가 아니라 값으로 돌려준다. 여는 순간 날짜가 채워지는 서랍
 * 안에서 쓰는 폼이라, 실패했을 때 주소로 나갔다 오면 서랍이 닫히고 고른
 * 회원도 시각도 처음부터 다시 넣어야 한다.
 */
export async function scheduleFromCalendarAction(formData: FormData) {
  const user = await requireUser();

  const contractId = String(formData.get("contractId") ?? "");
  const date = String(formData.get("date") ?? "");
  const time = String(formData.get("time") ?? "");

  if (!contractId) {
    return { error: "회원을 골라주세요.", dateKey: null };
  }

  const scheduledAt = date && time ? kstDateTimeToUtc(date, time) : null;

  if (!scheduledAt || Number.isNaN(scheduledAt.getTime())) {
    return { error: "날짜와 시각을 확인해주세요.", dateKey: null };
  }

  try {
    await scheduleSession(user.id, {
      contractId,
      scheduledAt,
      durationMinutes: Number(formData.get("durationMinutes")) || 60,
    });
  } catch (error) {
    if (error instanceof PTError || error instanceof TrainerError) {
      return { error: error.message, dateKey: null };
    }

    console.error("schedule from calendar error:", error);
    return { error: "잠시 후 다시 시도해주세요.", dateKey: null };
  }

  revalidatePath("/trainer/schedule");
  revalidatePath("/trainer");
  revalidatePath("/home");

  /*
    잡은 날을 돌려준다. 다른 날을 보다가 잡았으면 그 날로 옮겨 줘야 방금 만든
    수업이 눈에 보인다. 안 보이면 잡힌 건지 아닌지를 알 수 없다.
  */
  return { error: null, dateKey: toKstDateKey(scheduledAt) };
}
