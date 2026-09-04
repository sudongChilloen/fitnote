import { User } from "lucide-react";

import { requireUser } from "@/app/lib/dal";
import { ComingSoon } from "@/components/layout/coming-soon";

export const metadata = { title: "내 정보 | FitNote" };

export default async function ProfilePage() {
  await requireUser();

  return (
    <ComingSoon
      icon={User}
      title="내 정보"
      description={"프로필, 신체 변화, PT 계약 현황을\n볼 수 있게 준비하고 있어요."}
    />
  );
}
