// pages/_app.tsx - 최적화된 App 컴포넌트
import "@/styles/globals.css";
import { useState } from "react";
import type { AppProps } from "next/app";
import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { createQueryClient } from "@/utils/queryClient";

export default function App({ Component, pageProps }: AppProps) {
  // useState로 QueryClient 인스턴스 생성 (SSR 이슈 방지)
  const [queryClient] = useState(() => createQueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <Component {...pageProps} />

      {/* 개발 환경에서만 React Query DevTools 표시 */}
      {process.env.NODE_ENV === "development" && (
        <ReactQueryDevtools initialIsOpen={false} position="bottom" />
      )}
    </QueryClientProvider>
  );
}
