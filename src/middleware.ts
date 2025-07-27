// middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyAdminToken } from "./lib/jwt-edge";

export async function middleware(request: NextRequest) {
  const authToken = request.cookies.get("auth-token");
  const adminToken = request.cookies.get("admin-token");
  const { pathname } = request.nextUrl;

  // 보호된 라우트 정의
  const protectedRoutes = [
    "/main",
    "/script",
    "/profile",
    "/recording",
    "/tutorial",
  ];
  const isProtectedRoute = protectedRoutes.some((route) =>
    pathname.startsWith(route)
  );

  // 관리자 라우트 정의
  const isAdminRoute = pathname.startsWith("/admin");
  const isAdminLoginPage = pathname === "/admin/login";

  console.log("🛡️[미들웨어]:", {
    pathname,
    isProtectedRoute,
    isAdminRoute,
    isAdminLoginPage,
    hasAuthToken: !!authToken,
    hasAdminToken: !!adminToken,
  });

  // 🔐 관리자 라우트 보호 로직 (JWT 검증)
  if (isAdminRoute) {
    // 1. /admin/login은 이미 유효한 관리자가 로그인되어 있으면 대시보드로 리다이렉트
    if (isAdminLoginPage && adminToken) {
      const decoded = await verifyAdminToken(adminToken.value);
      if (decoded) {
        console.log("✅ 이미 로그인된 관리자, 대시보드로 리다이렉트");
        return NextResponse.redirect(new URL("/admin/dashboard", request.url));
      }
    }

    // 2. /admin/login을 제외한 모든 /admin/* 경로는 유효한 JWT 토큰 필요
    if (!isAdminLoginPage) {
      if (!adminToken) {
        console.log("❌ 관리자 토큰 없음, 로그인 페이지로 리다이렉트");
        return NextResponse.redirect(new URL("/admin/login", request.url));
      }

      const decoded = await verifyAdminToken(adminToken.value);
      if (!decoded) {
        console.log("❌ 유효하지 않은 JWT 토큰, 로그인 페이지로 리다이렉트");
        // 잘못된 토큰 쿠키 삭제
        const response = NextResponse.redirect(
          new URL("/admin/login", request.url)
        );
        response.cookies.set("admin-token", "", {
          maxAge: 0,
          path: "/",
        });
        return response;
      }
    }

    // 3. 관리자 라우트는 여기서 처리 완료
    console.log("✅ 관리자 라우트 통과");
    return NextResponse.next();
  }

  // 👤 일반 사용자 라우트 보호 로직 (기존 로직)
  if (isProtectedRoute && !authToken) {
    console.log("❌ 미인증 사용자, index로 리다이렉트");
    return NextResponse.redirect(new URL("/", request.url));
  }

  if (pathname === "/" && authToken) {
    console.log("✅ 인증된 사용자, main으로 리다이렉트");
    return NextResponse.redirect(new URL("/main", request.url));
  }

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
    "/admin/:path*",
  ],
};
