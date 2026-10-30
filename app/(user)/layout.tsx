import { redirect } from "next/navigation";

import { requireUser } from "@/app/lib/dal";
import { BottomNav } from "@/components/layout/bottom-nav";

/**
 * 회원 화면 공통 셸.
 *
 * 모바일 우선이라 max-w-md 로 가운데 정렬하고, 하단 고정 탭에 가리지 않도록
 * 본문 아래쪽에 여백을 준다. (탭 높이 약 60px + 홈 인디케이터 안전 영역)
 *
 * 한 계정은 회원이거나 트레이너 중 하나다. 트레이너가 회원 화면 주소를 열면
 * 트레이너 화면으로 돌려보낸다. (반대 방향은 app/trainer/layout.tsx 가 막는다.)
 */
export default async function UserLayout({ children }: LayoutProps<"/">) {
  const user = await requireUser();

  if (user.isTrainer) {
    redirect("/trainer");
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <div
        className="mx-auto w-full max-w-md flex-1"
        style={{
          paddingBottom: "calc(5.5rem + env(safe-area-inset-bottom))",
        }}
      >
        {children}
      </div>

      <BottomNav />
    </div>
  );
}
