import { BottomNav } from "@/components/layout/bottom-nav";

/**
 * 회원 화면 공통 셸.
 *
 * 모바일 우선이라 max-w-md 로 가운데 정렬하고, 하단 고정 탭에 가리지 않도록
 * 본문 아래쪽에 여백을 준다. (탭 높이 약 60px + 홈 인디케이터 안전 영역)
 */
export default function UserLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-dvh flex-col">
      <div
        className="mx-auto w-full max-w-md flex-1"
        style={{
          paddingBottom: "calc(4.25rem + env(safe-area-inset-bottom))",
        }}
      >
        {children}
      </div>

      <BottomNav />
    </div>
  );
}
