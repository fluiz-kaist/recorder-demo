// middleware.ts - Firebase Auth 기반으로 수정
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyAdminToken } from "./lib/jwt-edge";

// 🔥 Firebase Auth Token 검증 함수 (Edge Runtime용)
async function verifyFirebaseToken(token: string): Promise<boolean> {
  try {
    // Edge Runtime에서는 Firebase Admin SDK를 직접 사용할 수 없으므로
    // JWT 토큰의 기본적인 구조만 체크하거나 별도 검증 API 호출

    // 🔧 간단한 JWT 구조 체크
    const parts = token.split(".");
    if (parts.length !== 3) {
      return false;
    }

    // 🔧 토큰 만료 시간 체크 (옵션)
    try {
      const payload = JSON.parse(atob(parts[1]));
      const now = Math.floor(Date.now() / 1000);

      // exp (만료 시간) 체크
      if (payload.exp && payload.exp < now) {
        console.log("🔥 Firebase Token 만료됨");
        return false;
      }

      // aud (audience) 체크 - Firebase 프로젝트 ID
      const expectedProjectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
      if (expectedProjectId && payload.aud !== expectedProjectId) {
        console.log("🔥 Firebase Token 잘못된 프로젝트 ID");
        return false;
      }

      return true;
    } catch (parseError) {
      console.error("🔥 Firebase Token 파싱 오류:", parseError);
      return false;
    }
  } catch (error) {
    console.error("🔥 Firebase Token 검증 오류:", error);
    return false;
  }
}

export async function middleware(request: NextRequest) {
  // 🔥 Firebase Token 쿠키 확인
  const firebaseToken = request.cookies.get("firebase-token");
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

  // 🔥 Firebase Token 검증
  let isFirebaseAuthenticated = false;
  if (firebaseToken) {
    isFirebaseAuthenticated = await verifyFirebaseToken(firebaseToken.value);
  }

  // 🔥 통합 인증 상태 확인 (Firebase Token 우선, HTTP 쿠키 fallback)
  const isAuthenticated = isFirebaseAuthenticated 

  console.log("🛡️[미들웨어] Firebase Auth 기반:", {
    pathname,
    isProtectedRoute,
    isAdminRoute,
    isAdminLoginPage,
    hasFirebaseToken: !!firebaseToken,
    isFirebaseAuthenticated,
    isAuthenticated,
    hasAdminToken: !!adminToken,
  });

  // 🔐 관리자 라우트 보호 로직 (기존 유지)
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

  // 🔥 일반 사용자 라우트 보호 로직 (Firebase Auth 기반)
  if (isProtectedRoute && !isAuthenticated) {
    console.log(
      "❌ 미인증 사용자 (Firebase + HTTP 모두 없음), index로 리다이렉트"
    );
    return NextResponse.redirect(new URL("/", request.url));
  }

  // 🔥 Firebase Token이 만료된 경우 처리
  if (isProtectedRoute && !isFirebaseAuthenticated && firebaseToken) {
    console.log("⚠️ Firebase Token 만료됨, 쿠키 정리 후 index로 리다이렉트");
    const response = NextResponse.redirect(new URL("/", request.url));
    response.cookies.set("firebase-token", "", {
      maxAge: 0,
      path: "/",
    });
    return response;
  }

  // 🔥 인증된 사용자가 index에 접근하면 main으로 리다이렉트
  if (pathname === "/" && isAuthenticated) {
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
