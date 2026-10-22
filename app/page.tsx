import { redirect } from "next/navigation";

import { getCurrentUser } from "@/app/lib/dal";

/**
 * 진입점.
 *
 * 아직 랜딩 페이지가 없으므로 로그인 여부와 역할에 따라 트레이너 홈, 회원 홈, 로그인으로 보낸다.
 * proxy 의 낙관적 검사와 달리 여기서는 DB 까지 확인한 결과를 쓴다.
 */
export default async function RootPage() {
  const user = await getCurrentUser();

  if (!user) redirect("/login");

  redirect(user.isTrainer ? "/trainer" : "/home");
}
