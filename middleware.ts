// middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const authToken = request.cookies.get("auth-token");
  const { pathname } = request.nextUrl;

  // 실제 사용하는 보호된 라우트로 수정
  const protectedRoutes = ["/main", "/script", "/profile", "/recording"];

  const isProtectedRoute = protectedRoutes.some((route) =>
    pathname.startsWith(route)
  );

  // 쿠키 없으면 홈으로 리다이렉트
  if (isProtectedRoute && !authToken) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  // 실제 메인 페이지로 리다이렉트
  if (pathname === "/login" && authToken) {
    return NextResponse.redirect(new URL("/main", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/main/:path*",
    "/script/:path*",
    "/profile/:path*",
    "/recording/:path*",
    "/login",
  ],
};
