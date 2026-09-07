"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireUser } from "@/app/lib/dal";
import {
  type SharingSetting,
  updateMySharing,
} from "@/server/sharing/sharing.service";

/**
 * 공유 설정 저장.
 *
 * 체크가 풀린 체크박스는 아예 전송되지 않으므로 has() 로 읽는다. 화면에 그려진
 * 네 칸을 매번 통째로 덮어쓰기 때문에, 두 탭에서 따로 켜고 끄면 나중에 누른
 * 쪽이 이긴다. 개수가 적고 본인만 고치는 값이라 이 정도로 둔다.
 */
export async function saveSharing(formData: FormData) {
  const user = await requireUser();

  const shareDiet = formData.has("shareDiet");

  const next: SharingSetting = {
    shareDiet,
    // 식단을 안 보여주면서 사진만 보여줄 수는 없다. 화면에서도 같이 잠그지만
    // 폼은 직접 만들어 보낼 수 있으니 여기서 한 번 더 맞춘다.
    shareDietPhoto: shareDiet && formData.has("shareDietPhoto"),
    sharePersonalWorkout: formData.has("sharePersonalWorkout"),
    shareBody: formData.has("shareBody"),
  };

  await updateMySharing(user.id, next);

  revalidatePath("/profile/sharing");
  revalidatePath("/profile");

  // 저장했다는 걸 알려주려면 주소를 바꿔야 한다. 자바스크립트 없이 폼만 보내면
  // 화면이 그대로 다시 그려질 뿐이라 뭐가 달라졌는지 알 수 없다.
  redirect("/profile/sharing?saved=1");
}
