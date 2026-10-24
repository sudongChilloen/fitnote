"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/app/lib/dal";
import { CenterError } from "@/server/centers/center.service";
import {
  ConnectionError,
  createTrainerInvitation,
  endConnection,
  redeemTrainerCode,
  revokeTrainerInvitation,
} from "@/server/trainers/connection.service";

export type CenterActionState = {
  error: string | null;
  notice: string | null;
};

function fail(error: string): CenterActionState {
  return { error, notice: null };
}

/** 서비스가 구분해 둔 실패만 그대로 보여주고, 나머지는 감춘다. */
async function run(
  fn: () => Promise<CenterActionState>,
): Promise<CenterActionState> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof CenterError || error instanceof ConnectionError) {
      return fail(error.message);
    }
    console.error("center action error:", error);
    return fail("처리하지 못했어요. 잠시 후 다시 시도해주세요.");
  }
}

function revalidate() {
  revalidatePath("/profile");
  revalidatePath("/home");
  revalidatePath("/journal");
}

/** 회원이 트레이너 코드를 넣어 연결한다. */
export async function redeemCode(
  _prev: CenterActionState | undefined,
  formData: FormData,
): Promise<CenterActionState> {
  const user = await requireUser();
  const code = String(formData.get("code") ?? "").trim();

  if (!code) {
    return fail("코드를 입력해주세요.");
  }

  return run(async () => {
    const { trainerName } = await redeemTrainerCode(user.id, code);
    revalidate();

    return {
      error: null,
      notice: `${trainerName} 트레이너와 연결됐어요.`,
    };
  });
}

/** 회원 연결 코드를 만든다. */
export async function issueTrainerCode(): Promise<CenterActionState> {
  const user = await requireUser();

  return run(async () => {
    const invitation = await createTrainerInvitation(user.id);
    revalidate();

    return { error: null, notice: `코드 ${invitation.code} 를 만들었어요.` };
  });
}

/** 트레이너와의 연결을 끝낸다. */
export async function disconnectTrainer(
  _prev: CenterActionState | undefined,
  formData: FormData,
): Promise<CenterActionState> {
  const user = await requireUser();
  const connectionId = String(formData.get("connectionId") ?? "");

  return run(async () => {
    await endConnection(user.id, connectionId);
    revalidate();

    return { error: null, notice: "연결을 끝냈어요." };
  });
}

export async function revokeCode(
  _prev: CenterActionState | undefined,
  formData: FormData,
): Promise<CenterActionState> {
  const user = await requireUser();
  const invitationId = String(formData.get("invitationId") ?? "");

  return run(async () => {
    await revokeTrainerInvitation(user.id, invitationId);
    revalidate();

    return { error: null, notice: "코드를 껐어요." };
  });
}
