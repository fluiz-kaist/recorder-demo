// hooks/queries/useUserQueries.ts - localStorage 변경사항 반영

import { useQuery, UseQueryResult } from "@tanstack/react-query";
import { User } from "@/types/firebase";
import { getCookie } from "@/utils/auth";

/**
 * 🔄 최소한의 로컬 사용자 정보만 조회
 * localStorage에서는 id, userName, completedAt만 가져옴
 * main에서 로딩을 위해 사용함
 */
export const useLocalUserQuery = (): UseQueryResult<
  {
    id: string;
    userName?: string;
    completedAt?: string;
  } | null,
  Error
> => {
  const { data: fullUser, isLoading, isError, error } = useUserQuery();

  return useQuery({
    queryKey: ["minimalUserInfo"], // 🔄 queryKey를 'minimalUserInfo'로 변경했습니다.
    queryFn: async () => {
      if (fullUser) {
        console.log(
          "useLocalUserQuery (derived): useUserQuery 데이터에서 추출",
          {
            id: fullUser.id,
            userName: fullUser.userName,
          }
        );
        return {
          id: fullUser.id,
          userName: fullUser.userName,
        };
      }
      return null;
    },
    enabled: !!fullUser,
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });
};

/**
 * 🆕 전체 사용자 정보 조회 (서버에서)
 * 진행 상태 등 모든 정보 포함
 */
export const useUserQuery = (userId?: string): UseQueryResult<User, Error> => {
  const { data: authStatus } = useAuthStatusQuery();
  // const { data: localUser } = useLocalUserQuery();
  // const localUser = getUserFromLocal();

  return useQuery({
    queryKey: ["user", userId || authStatus?.userId],
    queryFn: async (): Promise<User> => {
      const targetUserId = userId || authStatus?.userId;

      if (!targetUserId) {
        throw new Error("사용자 ID가 없습니다.");
      }

      if (!authStatus?.isAuthenticated) {
        throw new Error("인증이 필요합니다.");
      }

      const response = await fetch(`/api/users/${targetUserId}`, {
        method: "GET",
        credentials: "include",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "사용자 정보를 불러올 수 없습니다.");
      }

      return data.user as User;
    },
    enabled:
      // !!localUser?.completedAt && // 온보딩 완료된 사용자만
      !!authStatus?.isAuthenticated && !!(userId || authStatus?.userId),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
};

/**
 * 🔄 튜토리얼 완료 여부 확인 (서버 데이터 기반)
 */
export const useIsTutorialCompleted = (): boolean => {
  const { data: fullUser } = useUserQuery();

  // 서버 데이터에서 확인 (localStorage에는 없음)
  return (
    fullUser?.currentStatus?.isTutorialCompleted ||
    fullUser?.recordingStatus?.isTutorialCompleted ||
    false
  );
};

/**
 * 🔄 현재 세트 번호 조회 (서버 데이터 기반)
 */
export const useCurrentSetNumber = (): number => {
  const { data: fullUser } = useUserQuery();

  return fullUser?.participation?.currentSetNumber || 1;
};

/**
 * 인증 상태 확인 쿼리 (기존 유지)
 */
export const useAuthStatusQuery = (): UseQueryResult<
  { isAuthenticated: boolean; userId: string | null },
  Error
> => {
  return useQuery({
    queryKey: ["authStatus"],
    queryFn: async (): Promise<{
      isAuthenticated: boolean;
      userId: string | null;
    }> => {
      const authToken = getCookie("auth-token");

      return {
        isAuthenticated: !!authToken,
        userId: authToken || null,
      };
    },
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnMount: true,
  });
};

/**
 * 사용자 등록(온보딩) 완료 상태 확인
 */
export const useUserCompletionStatusQuery = (
  userId?: string
): UseQueryResult<boolean, Error> => {
  const { data: authStatus } = useAuthStatusQuery();
  const { data: localUser } = useLocalUserQuery();

  return useQuery({
    queryKey: ["userCompletionStatus", userId || authStatus?.userId],
    queryFn: async (): Promise<boolean> => {
      const targetUserId = userId || authStatus?.userId;

      if (!targetUserId) {
        return false;
      }

      // 🔄 로컬에서 온보딩 완료 여부 확인 (localStorage에 있음)
      if (localUser?.completedAt) {
        return true;
      }

      if (!authStatus?.isAuthenticated) {
        return false;
      }

      try {
        const response = await fetch(`/api/users/${targetUserId}`, {
          method: "GET",
          credentials: "include",
        });

        const data = await response.json();

        if (!response.ok) {
          return false;
        }

        const user = data.user as User;
        return !!user.completedAt; // 온보딩 완료 여부
      } catch (error) {
        console.error("사용자 완료 상태 확인 오류:", error);
        return false;
      }
    },
    enabled: !!(userId || authStatus?.userId),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
};

/**
 * 🆕 전체 녹음 작업 완료 상태 확인 (서버 데이터 기반)
 */
export const useAllRecordingCompletionQuery = (
  userId?: string
): UseQueryResult<boolean, Error> => {
  const { data: authStatus } = useAuthStatusQuery();
  const { data: fullUser } = useUserQuery(userId);

  return useQuery({
    queryKey: ["allRecordingCompletion", userId || authStatus?.userId],
    queryFn: async (): Promise<boolean> => {
      // 🔄 서버 데이터에서 모든 녹음 완료 여부 확인
      if (fullUser?.currentStatus?.progress?.completedPercentage === 100) {
        return true;
      }

      // 레거시 구조도 확인
      if (fullUser?.recordingStatus?.isAllRecordingCompleted) {
        return true;
      }

      return false;
    },
    enabled: !!fullUser, // fullUser가 로드된 후에만 실행
    staleTime: 2 * 60 * 1000,
    retry: 1,
  });
};

/**
 * 인증 상태 확인 유틸리티
 */
export const useIsAuthenticated = (): boolean => {
  const { data: authStatus } = useAuthStatusQuery();
  return !!authStatus?.isAuthenticated;
};

// 🔄 삭제된 훅들 (더 이상 사용하지 않음)
// - useUserParticipationQuery: useUserQuery로 대체
// - useUserCurrentStatusQuery: useUserQuery로 대체
