// components/AdminRoute.tsx - 관리자 권한 보호 컴포넌트
import { useEffect } from "react";
import { useRouter } from "next/router";
import { useAdminAuth } from "@/hooks/queries/useAdminQueries";

interface AdminRouteProps {
  children: React.ReactNode;
}

export const AdminRoute = ({ children }: AdminRouteProps) => {
  const router = useRouter();
  const { data: authData, isLoading, isError } = useAdminAuth();

  useEffect(() => {
    if (!isLoading && (!authData?.isAdmin || isError)) {
      console.log("관리자 권한 없음 - 로그인 페이지로 이동");
      router.push("/admin/login");
    }
  }, [authData, isLoading, isError, router]);

  // 로딩 중
  if (isLoading) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100vh",
          fontSize: "16px",
          color: "#666",
        }}
      >
        권한 확인 중...
      </div>
    );
  }

  // 권한 없음
  if (!authData?.isAdmin || isError) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100vh",
          fontSize: "16px",
          color: "#999",
        }}
      >
        권한 확인 중...
      </div>
    );
  }

  // 권한 있음 - 자식 컴포넌트 렌더링
  return <>{children}</>;
};
