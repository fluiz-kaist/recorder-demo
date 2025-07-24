// middleware.ts - 간단 버전
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const authToken = request.cookies.get("auth-token");
  const { pathname } = request.nextUrl;

  // 보호된 라우트 정의
  const protectedRoutes = ["/main", "/script", "/profile", "/recording", "/tutorial"];
  const isProtectedRoute = protectedRoutes.some((route) =>
    pathname.startsWith(route)
  );

  console.log("🛡️[미들웨어]:", {
    pathname,
    isProtectedRoute,
    hasAuthToken: !!authToken,
  });

  // 1. 보호된 라우트에 쿠키 없이 접근 → index로 리다이렉트
  if (isProtectedRoute && !authToken) {
    console.log("❌ 미인증 사용자, index로 리다이렉트");
    return NextResponse.redirect(new URL("/", request.url));
  }

  // 2. index 페이지에 완전 인증된 사용자(쿠키 있음)가 접근 → main으로 리다이렉트
  if (pathname === "/" && authToken) {
    console.log("✅ 인증된 사용자, main으로 리다이렉트");
    return NextResponse.redirect(new URL("/main", request.url));
  }

  // 3. 그 외에는 통과
  console.log("✅ 통과");
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/",
    "/main/:path*",
    "/script/:path*", 
    "/profile/:path*",
    "/recording/:path*",
    "/tutorial/:path*",
  ],
};