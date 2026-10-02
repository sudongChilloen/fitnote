"use server";

import { randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/app/lib/dal";
import {
  JournalError,
  addJournalComment,
} from "@/server/journals/journal.service";

export type CommentState = {
  error: string | null;
  /**
   * 성공할 때마다 바뀌는 값.
   *
   * 입력칸의 key 로 써서 방금 쓴 글을 지운다. effect 로 지우면 렌더 중 상태를
   * 바꾸게 되고, 화살표 함수로 감싸 처리하면 서버 액션 참조가 아니게 되어
   * 자바스크립트 없이 폼을 낼 수 없다.
   */
  token: string | null;
};

export async function postComment(
  _prev: CommentState | undefined,
  formData: FormData,
): Promise<CommentState> {
  const user = await requireUser();
  const journalId = String(formData.get("journalId") ?? "");
  const content = String(formData.get("content") ?? "");

  try {
    await addJournalComment(user.id, journalId, content);
    revalidatePath(`/journal/${journalId}`);
    revalidatePath("/journal");

    // 트레이너 홈의 "답변 대기"는 최신 댓글의 작성자를 기준으로 계산한다.
    // 트레이너가 답변을 등록한 순간 해당 대기 항목도 함께 갱신되도록 한다.
    revalidatePath("/trainer");
    revalidatePath("/trainer/journals");
    revalidatePath(`/trainer/journals/${journalId}`);

    return { error: null, token: randomUUID() };
  } catch (error) {
    if (error instanceof JournalError) {
      return { error: error.message, token: null };
    }
    console.error("journal comment error:", error);
    return {
      error: "댓글을 남기지 못했어요. 잠시 후 다시 시도해주세요.",
      token: null,
    };
  }
}
