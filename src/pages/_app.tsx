// pages/_app.tsx - 간단하게 수정된 버전
import "@/styles/globals.css";
import { useState, useEffect, ReactElement, ReactNode } from "react";
import type { NextPage } from "next";
import type { AppProps } from "next/app";

import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { createQueryClient } from "@/utils/queryClient";
import { useFirebaseAuth } from "@/hooks/useFirebaseAuth";
import Layout from "@/components/Layout";
import { getEnv } from "@/utils/envConfig";

type NextPageWithLayout = NextPage & {
  getLayout?: (page: ReactElement) => ReactNode;
};

type AppPropsWithLayout = AppProps & {
  Component: NextPageWithLayout;
};

export default function App({ Component, pageProps }: AppPropsWithLayout) {
  // useState로 QueryClient 인스턴스 생성 (SSR 이슈 방지)
  const [queryClient] = useState(() => createQueryClient());
  const { isPreview, isDev } = getEnv();

  // 🆕 Firebase Auth 상태 관리
  const { user: firebaseUser, isLoading: firebaseLoading } = useFirebaseAuth();
  const isNotProd = isPreview || isDev;

  // 🆕 개발 환경에서 Firebase Auth 상태 로깅
  useEffect(() => {
    if (process.env.NODE_ENV === "development") {
      console.log("🔥 Firebase Auth 상태:", {
        isAuthenticated: !!firebaseUser,
        userId: firebaseUser?.uid || "null",
        isLoading: firebaseLoading,
      });
    }
  }, [firebaseUser, firebaseLoading]);
  // pages 컴포넌트에서 getLayout을 정의하지 않았다면 기본 Layout을 사용
  const getLayout = Component.getLayout ?? ((page) => <Layout>{page}</Layout>);

  return (
    <QueryClientProvider client={queryClient}>
      {/* 1. getLayout을 적용한 페이지 컴포넌트 */}
      {getLayout(<Component {...pageProps} />)}
      {
        <>
          {/* 개발 환경에서 Firebase 상태 표시 */}
          {isNotProd && firebaseLoading && (
            <div
              style={{
                position: "fixed",
                top: 0,
                right: 0,
                background: "rgba(0,0,0,0.8)",
                color: "white",
                padding: "5px 10px",
                fontSize: "12px",
                zIndex: 9999,
              }}
            >
              🔥 Firebase Auth 로딩 중...
            </div>
          )}

          {/* 개발 환경에서만 React Query DevTools 표시 */}
          {process.env.NODE_ENV === "development" && (
            <ReactQueryDevtools initialIsOpen={false} position="bottom" />
          )}
        </>
      }
    </QueryClientProvider>
  );
}
