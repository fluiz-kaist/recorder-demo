// utils/queryClient.ts - React Query 클라이언트 설정
import { QueryClient } from "@tanstack/react-query";

/**
 * React Query 클라이언트 기본 설정
 */
const defaultQueryClientOptions = {
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5분간 캐시 유지
      retry: 1, // 실패 시 1번만 재시도
      refetchOnWindowFocus: false, // 윈도우 포커스 시 재조회 안함
      refetchOnReconnect: true, // 네트워크 재연결 시 재조회
    },
    mutations: {
      retry: 1, // 뮤테이션 실패 시 1번만 재시도
    },
  },
};

/**
 * 새로운 QueryClient 인스턴스 생성 함수
 * Next.js SSR 환경에서 각 요청마다 새로운 인스턴스 생성을 위해 사용
 */
export const createQueryClient = (): QueryClient => {
  return new QueryClient(defaultQueryClientOptions);
};

/**
 * 전역 QueryClient 인스턴스 (서버 사이드에서 사용)
 * 클라이언트 사이드에서는 createQueryClient() 함수 사용 권장
 */
export const queryClient = new QueryClient(defaultQueryClientOptions);
