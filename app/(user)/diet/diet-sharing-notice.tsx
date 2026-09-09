import Link from "next/link";

import { Eye, EyeOff } from "lucide-react";

import { getMySharing } from "@/server/sharing/sharing.service";

/**
 * 이 식단이 트레이너에게 보이는지 알려준다.
 *
 * 공유 설정을 내 정보 안에 숨겨 두면 켰는지 껐는지 잊는다. 올리는 화면과 올린 뒤
 * 화면에서 매번 말해 주는 게 맞다 — 보여주려고 올렸는데 안 보이고 있었다면 그건
 * 회원 잘못이 아니라 화면 잘못이다.
 *
 * 센터에 속하지 않았으면 아무것도 그리지 않는다. 보여줄 상대가 없는데 "공유되지
 * 않아요" 라고 적으면 뭔가 잘못한 것처럼 읽힌다.
 */
export async function DietSharingNotice({ userId }: { userId: string }) {
  const mine = await getMySharing(userId);

  if (!mine) return null;

  const on = mine.setting.shareDiet;

  return (
    <p
      className={`flex items-start gap-2 rounded-xl px-4 py-3 text-xs ${
        on ? "bg-accent text-primary" : "bg-secondary text-muted-foreground"
      }`}
    >
      {on ? (
        <Eye className="mt-px size-3.5 shrink-0" aria-hidden />
      ) : (
        <EyeOff className="mt-px size-3.5 shrink-0" aria-hidden />
      )}

      <span>
        {on ? (
          <>
            {mine.trainerName
              ? `${mine.trainerName} 트레이너가 볼 수 있어요.`
              : "담당 트레이너가 정해지면 볼 수 있어요."}
            {mine.setting.shareDietPhoto ? "" : " 사진은 공유하지 않고 있어요."}
          </>
        ) : (
          "지금은 트레이너에게 보이지 않아요."
        )}{" "}
        <Link href="/profile/sharing" className="font-bold underline">
          공유 설정
        </Link>
      </span>
    </p>
  );
}
