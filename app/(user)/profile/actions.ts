"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/app/lib/dal";
import { MembershipRole } from "@/generated/prisma/enums";
import {
  CenterError,
  createInvitation,
  getCurrentMembership,
  leaveCenter,
  redeemInvitation,
  revokeInvitation,
} from "@/server/centers/center.service";

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
    if (error instanceof CenterError) {
      return fail(error.message);
    }
    console.error("center action error:", error);
    return fail("처리하지 못했어요. 잠시 후 다시 시도해주세요.");
  }
}

function revalidate() {
  revalidatePath("/profile");
  revalidatePath("/home");
}

export async function joinCenter(
  _prev: CenterActionState | undefined,
  formData: FormData,
): Promise<CenterActionState> {
  const user = await requireUser();
  const code = String(formData.get("code") ?? "").trim();

  if (!code) {
    return fail("코드를 입력해주세요.");
  }

  return run(async () => {
    const { outcome, membership } = await redeemInvitation(user.id, code);

    revalidate();

    return {
      error: null,
      notice:
        outcome === "TRAINER_CHANGED"
          ? `담당 트레이너가 ${membership.assignedTrainerMembership?.user.name ?? ""} 님으로 바뀌었어요.`
          : `${membership.center.name}에 들어왔어요.`,
    };
  });
}

export async function issueInvitation(
  _prev: CenterActionState | undefined,
  formData: FormData,
): Promise<CenterActionState> {
  const user = await requireUser();
  const raw = String(formData.get("role") ?? "");

  if (raw !== MembershipRole.TRAINER && raw !== MembershipRole.MEMBER) {
    return fail("만들 수 없는 역할이에요.");
  }

  return run(async () => {
    const membership = await getCurrentMembership(user.id);

    if (!membership) {
      return fail("센터에 소속되어 있지 않아요.");
    }

    const invitation = await createInvitation({
      userId: user.id,
      membershipId: membership.id,
      role: raw,
    });

    revalidate();

    return { error: null, notice: `코드 ${invitation.code} 를 만들었어요.` };
  });
}

export async function revokeCode(
  _prev: CenterActionState | undefined,
  formData: FormData,
): Promise<CenterActionState> {
  const user = await requireUser();
  const invitationId = String(formData.get("invitationId") ?? "");

  return run(async () => {
    const membership = await getCurrentMembership(user.id);

    if (!membership) {
      return fail("센터에 소속되어 있지 않아요.");
    }

    await revokeInvitation(user.id, membership.id, invitationId);
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
