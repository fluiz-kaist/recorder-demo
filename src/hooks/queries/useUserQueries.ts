// hooks/queries/useUserQueries.ts - 쿠키 기반 사용자 데이터 조회 훅
import {
  useQuery,
  useMutation,
  useQueryClient,
  UseQueryResult,
} from "@tanstack/react-query";
import { User } from "@/types/firebase";

/**
 * 쿠키에서 값 읽기 (클라이언트 사이드)
 */
const getCookie = (name: string): string | null => {
  if (typeof window === "undefined") return null;

  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) {
    return parts.pop()?.split(";").shift() || null;
  }
  return null;
};

/**
 * 인증 상태 확인 쿼리 (쿠키 기반)
 * 미들웨어에서 이미 검증했으므로 클라이언트에서는 쿠키 존재만 확인
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
      // 서버 요청 없이 쿠키만 확인
      const authToken = getCookie("auth-token");

      return {
        isAuthenticated: !!authToken,
        userId: authToken || null, // 쿠키 값이 userId
      };
    },
    staleTime: Infinity, // 무한 캐시 (쿠키가 변경되지 않는 한)
    gcTime: Infinity,
    retry: false,
    refetchOnWindowFocus: false, // 포커스 시 재검증 안함
    refetchOnMount: true, // 새 탭에서만 한 번 확인
  });
};

/**
 * 사용자 정보 조회 쿼리 (쿠키 기반)
 */
export const useUserQuery = (userId?: string): UseQueryResult<User, Error> => {
  const { data: authStatus } = useAuthStatusQuery();
  const { data: localUser } = useLocalUserQuery();

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
        credentials: "include", // 쿠키 포함
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "사용자 정보를 불러올 수 없습니다.");
      }

      return data.user as User;
    },
    enabled:
      !!authStatus?.isAuthenticated &&
      !!(userId || authStatus?.userId) &&
      !!localUser?.completedAt,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
};

/**
 * 로컬 스토리지에서 사용자 정보 조회 (민감하지 않은 정보만)
 * 완료 상태, 스크립트 할당 정보 등만 저장
 */
export const useLocalUserQuery = (): UseQueryResult<
  (Pick<User, "completedAt" | "scriptAssignments"> & { name?: string }) | null,
  Error
> => {
  return useQuery({
    queryKey: ["localUser"],
    queryFn: async (): Promise<
      | (Pick<User, "completedAt" | "scriptAssignments"> & { name?: string })
      | null
    > => {
      if (typeof window === "undefined") return null;

      const existingUserInfo = localStorage.getItem("userInfo");

      if (!existingUserInfo) return null;

      try {
        const parsedInfo = JSON.parse(existingUserInfo);
        // 민감하지 않은 정보만 반환
        return {
          name: parsedInfo.name, // User 타입에 없지만 별도로 저장
          completedAt: parsedInfo.completedAt,
          scriptAssignments: parsedInfo.scriptAssignments || [],
        };
      } catch (error) {
        console.error("로컬 사용자 정보 파싱 오류:", error);
        localStorage.removeItem("userInfo");
        return null;
      }
    },
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });
};

/**
 * 현재 인증된 사용자 ID 조회 (쿠키 기반)
 */
export const useCurrentUserIdQuery = (): UseQueryResult<
  string | null,
  Error
> => {
  const { data: authStatus } = useAuthStatusQuery();

  return useQuery({
    queryKey: ["currentUserId"],
    queryFn: async (): Promise<string | null> => {
      return authStatus?.userId || null;
    },
    enabled: !!authStatus?.isAuthenticated,
    staleTime: Infinity,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });
};

/**
 * 사용자의 할당된 스크립트 정보 조회 (로컬 우선)
 */
export const useUserScriptAssignmentsQuery = (
  userId?: string
): UseQueryResult<User["scriptAssignments"], Error> => {
  const { data: authStatus } = useAuthStatusQuery();
  const { data: localUser } = useLocalUserQuery();

  return useQuery({
    queryKey: ["userScriptAssignments", userId || authStatus?.userId],
    queryFn: async (): Promise<User["scriptAssignments"]> => {
      const targetUserId = userId || authStatus?.userId;

      if (!targetUserId) {
        throw new Error("사용자 ID가 없습니다.");
      }

      // 로컬 우선 확인
      if (localUser && localUser.scriptAssignments) {
        return localUser.scriptAssignments;
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
        throw new Error(
          data.message || "스크립트 할당 정보를 불러올 수 없습니다."
        );
      }

      const user = data.user as User;
      return user.scriptAssignments || [];
    },
    enabled: !!authStatus?.isAuthenticated && !!(userId || authStatus?.userId),
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

/**
 * 사용자 등록 완료 상태 확인
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

      // 먼저 로컬에서 확인
      if (localUser && localUser.completedAt) {
        return true;
      }

      // 인증되지 않은 경우 서버 호출 안함
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
        return !!user.completedAt;
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
 * 사용자 인증 확인 뮤테이션 (쿠키 기반)
 */
export const useVerifyAuthorizedUserMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      name,
      socialNumber,
    }: {
      name: string;
      socialNumber: string;
    }) => {
      const response = await fetch("/api/auth/verifyAuthorizedUser", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include", // 쿠키 포함
        body: JSON.stringify({ name, socialNumber }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "인증에 실패했습니다.");
      }

      return data;
    },
    onSuccess: (data) => {
      // 기존 사용자인지 확인
      if (data.user.isExistingUser) {
        // 기존 사용자 데이터로 localStorage 업데이트
        const userInfo = {
          name: data.user.name,
          completedAt: data.user.existingData?.completedAt || null,
          scriptAssignments: data.user.existingData?.scriptAssignments || [],
        };

        localStorage.setItem("userInfo", JSON.stringify(userInfo));

        // 캐시 업데이트
        queryClient.setQueryData(["authStatus"], {
          isAuthenticated: true,
          userId: data.user.userId,
        });

        queryClient.setQueryData(["localUser"], userInfo);

        console.log("기존 사용자 로그인 성공:", data.user.name);

        // 기존 사용자는 바로 메인으로 이동
        window.location.href = "/main";
        return;
      }

      // 신규 사용자 처리
      const userInfo = {
        name: data.user.name,
        completedAt: null, // 초기에는 미완료
        scriptAssignments: [],
      };

      localStorage.setItem("userInfo", JSON.stringify(userInfo));

      // 인증 상태 캐시 업데이트
      queryClient.setQueryData(["authStatus"], {
        isAuthenticated: true,
        userId: data.user.userId,
      });

      // 로컬 사용자 정보도 직접 업데이트
      queryClient.setQueryData(["localUser"], userInfo);

      console.log("신규 사용자 인증 성공:", data.user.name);
    },
    onError: (error) => {
      console.error("인증 실패:", error);
    },
  });
};

/**
 * 로그아웃 유틸리티 (쿠키 기반)
 */
export const logout = async (): Promise<void> => {
  try {
    // 서버에서 쿠키 삭제
    await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "include",
    });
  } catch (error) {
    console.error("로그아웃 API 오류:", error);
  }

  // 로컬 스토리지 정리 (민감하지 않은 정보만 저장했지만 정리)
  localStorage.removeItem("userInfo");
  sessionStorage.clear();

  // 페이지 새로고침으로 상태 초기화
  if (typeof window !== "undefined") {
    window.location.href = "/";
  }
};
