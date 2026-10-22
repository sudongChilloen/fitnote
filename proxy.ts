import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { SESSION_COOKIE_NAME, decrypt } from "@/app/lib/jwt";

/** 로그인 없이 접근 가능한 경로 */
const publicRoutes = ["/", "/login", "/signup"];

export default async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const isPublicRoute = publicRoutes.includes(path);

  // 쿠키만 확인하는 낙관적 검사. 실제 권한 검증은 DAL 에서 수행한다.
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = await decrypt(token);

  if (!isPublicRoute && !session) {
    return NextResponse.redirect(new URL("/login", request.nextUrl));
  }

  if (session && (path === "/login" || path === "/signup")) {
    // 역할별 첫 화면은 루트가 DB 를 보고 정한다. 여기서는 /home 으로 못 박지 않는다.
    return NextResponse.redirect(new URL("/", request.nextUrl));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.png$).*)"],
};
