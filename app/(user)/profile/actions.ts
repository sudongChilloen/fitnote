"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/app/lib/dal";
import {
  CenterError,
  getCurrentMembership,
  leaveCenter,
  redeemInvitation,
} from "@/server/centers/center.service";
import {
  ConnectionError,
  createTrainerInvitation,
  endConnection,
  redeemTrainerCode,
  revokeTrainerInvitation,
  startTrainerProfile,
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

/**
 * 코드 한 칸으로 두 가지를 받는다.
 *
 * 트레이너 코드는 TR 로 시작한다. 회원에게 "이건 트레이너 코드 칸, 저건 센터
 * 코드 칸" 이라고 설명하게 만들면 절반은 틀린 칸에 넣는다. 어디서 받았는지는
 * 코드 자체가 알고 있으니 서버가 가른다.
 */
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
    if (
      code
        .replace(/[^A-Za-z0-9]/g, "")
        .toUpperCase()
        .startsWith("TR")
    ) {
      const { trainerName } = await redeemTrainerCode(user.id, code);
      revalidate();

      return {
        error: null,
        notice: `${trainerName} 트레이너와 연결됐어요.`,
      };
    }

    const { membership } = await redeemInvitation(user.id, code);
    revalidate();

    return { error: null, notice: `${membership.center.name}에 들어왔어요.` };
  });
}

/** 트레이너로 시작한다. 센터도 초대 코드도 필요 없다. */
export async function becomeTrainer(): Promise<CenterActionState> {
  const user = await requireUser();

  return run(async () => {
    await startTrainerProfile(user.id);
    revalidate();

    return { error: null, notice: "트레이너로 시작했어요." };
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

/**
 * 인자를 받지 않는다. useActionState 는 (이전 상태, 폼) 을 넘기지만 여기서는
 * 쓸 값이 없다. 대신 감싸는 화살표 함수를 두면 서버 액션 참조가 아니게 되어
 * 자바스크립트가 없을 때 폼이 동작하지 않는다.
 */
export async function leaveMyCenter(): Promise<CenterActionState> {
  const user = await requireUser();

  return run(async () => {
    const membership = await getCurrentMembership(user.id);

    if (!membership) {
      return fail("소속된 센터가 없어요.");
    }

    await leaveCenter(user.id, membership.id);
    revalidate();

    return { error: null, notice: "센터에서 나왔어요." };
  });
}
