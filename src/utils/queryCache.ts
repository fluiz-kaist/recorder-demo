// utils/queryCache.ts - 쿼리 캐시 관리 공통 유틸리티
import { QueryClient } from "@tanstack/react-query";
import { User } from "@/types/firebase";

/**
 * 사용자 관련 모든 캐시 업데이트
 */
export const updateUserRelatedCache = (
  queryClient: QueryClient,
  userId: string,
  user: User
) => {
  // 서버 데이터 캐시 업데이트
  queryClient.setQueryData(["user", userId], user);

  // 로컬 사용자 정보로 변환하여 캐시 업데이트
  const localUserInfo = {
    name: user.userName || "",
    gender: user.gender || "",
    ageGroup: user.ageGroup || "",
    completedAt: user.completedAt,
    scriptAssignments: user.scriptAssignments || [],
  };
  queryClient.setQueryData(["localUser"], localUserInfo);

  // 기타 관련 캐시들
  queryClient.setQueryData(["currentUserId"], userId);
  queryClient.setQueryData(
    ["userCompletionStatus", userId],
    !!user.completedAt
  );

  if (user.scriptAssignments) {
    queryClient.setQueryData(
      ["userScriptAssignments", userId],
      user.scriptAssignments
    );
  }
};

/**
 * 인증 상태 캐시 업데이트
 */
export const updateAuthStatusCache = (
  queryClient: QueryClient,
  isAuthenticated: boolean,
  userId: string | null
) => {
  queryClient.setQueryData(["authStatus"], {
    isAuthenticated,
    userId,
  });
};

/**
 * 사용자 관련 모든 캐시 정리
 */
export const clearUserRelatedCache = (queryClient: QueryClient) => {
  queryClient.removeQueries({ queryKey: ["user"] });
  queryClient.removeQueries({ queryKey: ["localUser"] });
  queryClient.removeQueries({ queryKey: ["currentUserId"] });
  queryClient.removeQueries({ queryKey: ["authStatus"] });
  queryClient.removeQueries({ queryKey: ["userCompletionStatus"] });
  queryClient.removeQueries({ queryKey: ["userScriptAssignments"] });
};
