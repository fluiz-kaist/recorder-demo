// hooks/queries/useUserQueries.ts - 수정된 사용자 데이터 조회 훅
import {
  useQuery,
  useMutation,
  useQueryClient,
  UseQueryResult,
} from "@tanstack/react-query";
import { User } from "@/types/firebase";

/**
 * 임시 인증 토큰 타입
 */
interface TempAuthToken {
  isAuthorized: boolean;
  userId: string;
  expiresAt: number;
}

/**
 * 임시 토큰 검증 함수
 * 나중에 실제 JWT 토큰 검증으로 교체 예정
 */
const validateTempToken = (): TempAuthToken | null => {
  if (typeof window === "undefined") return null;

  try {
    const token = localStorage.getItem("tempAuthToken");
    if (!token) return null;

    const parsed = JSON.parse(token) as TempAuthToken;

    // 만료 시간 확인
    if (parsed.expiresAt < Date.now()) {
      localStorage.removeItem("tempAuthToken");
      return null;
    }

    return parsed;
  } catch (error) {
    console.error("토큰 검증 실패:", error);
    localStorage.removeItem("tempAuthToken");
    return null;
  }
};

/**
 * 임시 토큰 생성 함수 (개발용)
 * 실제 서비스에서는 서버에서 발급받는 토큰으로 교체
 */
export const createTempToken = (userId: string): void => {
  const token: TempAuthToken = {
    isAuthorized: true,
    userId,
    expiresAt: Date.now() + 24 * 60 * 60 * 1000, // 24시간
  };

  localStorage.setItem("tempAuthToken", JSON.stringify(token));
};

/**
 * 인증 상태 확인 쿼리
 * 로컬 스토리지에서 토큰 검증만 수행 (서버 호출 없음)
 */
export const useAuthStatusQuery = (): UseQueryResult<
  TempAuthToken | null,
  Error
> => {
  return useQuery({
    queryKey: ["authStatus"],
    queryFn: async (): Promise<TempAuthToken | null> => {
      const token = validateTempToken();

      // TODO: 나중에 실제 서버 검증으로 교체
      // const response = await fetch('/api/auth/verify-token', {
      //   method: 'POST',
      //   headers: { 'Authorization': `Bearer ${token}` }
      // });
      // if (!response.ok) {
      //   localStorage.removeItem('tempAuthToken');
      //   return null;
      // }

      return token;
    },
    staleTime: 10 * 60 * 1000, // 10분
    retry: false, // 인증 실패 시 재시도 안함
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });
};

/**
 * 사용자 정보 조회 쿼리
 * 인증된 사용자이고 등록 완료된 경우에만 조회
 */
export const useUserQuery = (userId?: string): UseQueryResult<User, Error> => {
  const { data: authToken } = useAuthStatusQuery();
  const { data: localUser } = useLocalUserQuery();

  return useQuery({
    queryKey: ["user", userId || authToken?.userId],
    queryFn: async (): Promise<User> => {
      const targetUserId = userId || authToken?.userId;

      if (!targetUserId) {
        throw new Error("사용자 ID가 없습니다.");
      }

      if (!authToken?.isAuthorized) {
        throw new Error("인증이 필요합니다.");
      }

      const response = await fetch(`/api/users/${targetUserId}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "사용자 정보를 불러올 수 없습니다.");
      }

      return data.user as User;
    },
    enabled:
      !!authToken?.isAuthorized &&
      !!(userId || authToken?.userId) &&
      !!localUser?.completedAt, // 로컬에 등록 완료된 사용자 정보가 있을 때만 실행
    staleTime: 5 * 60 * 1000, // 5분간 캐시 유지
    retry: 1,
  });
};

/**
 * 로컬 스토리지에서 사용자 정보 조회 (캐시된 데이터)
 * 서버 요청 없이 로컬에서 즉시 사용자 정보를 가져옴
 */
export const useLocalUserQuery = (): UseQueryResult<User | null, Error> => {
  return useQuery<User | null, Error>({
    // 제네릭 타입 명시
    queryKey: ["localUser"],
    queryFn: async (): Promise<User | null> => {
      if (typeof window === "undefined") return null;

      const existingUserInfo = localStorage.getItem("userInfo");

      if (!existingUserInfo) return null;

      try {
        const parsedInfo = JSON.parse(existingUserInfo) as User;
        return parsedInfo;
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
 * 현재 인증된 사용자 ID 조회
 */
export const useCurrentUserIdQuery = (): UseQueryResult<
  string | null,
  Error
> => {
  const { data: authToken } = useAuthStatusQuery();

  return useQuery({
    queryKey: ["currentUserId"],
    queryFn: async (): Promise<string | null> => {
      return authToken?.userId || null;
    },
    enabled: !!authToken,
    staleTime: Infinity,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });
};
/**
 * 사용자의 할당된 스크립트 정보 조회 (로컬 우선)
 * 로컬에 있으면 로컬에서, 없으면 서버에서 조회
 */
export const useUserScriptAssignmentsQuery = (
  userId?: string
): UseQueryResult<User["scriptAssignments"], Error> => {
  const { data: authToken } = useAuthStatusQuery();
  const { data: localUser } = useLocalUserQuery(); // 🔴 이미 있음

  return useQuery({
    queryKey: ["userScriptAssignments", userId || authToken?.userId],
    queryFn: async (): Promise<User["scriptAssignments"]> => {
      const targetUserId = userId || authToken?.userId;

      if (!targetUserId) {
        throw new Error("사용자 ID가 없습니다.");
      }

      // 🔴 로컬 우선 확인
      if (localUser && localUser.scriptAssignments) {
        return localUser.scriptAssignments;
      }

      if (!authToken?.isAuthorized) {
        throw new Error("인증이 필요합니다.");
      }

      const response = await fetch(`/api/users/${targetUserId}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "스크립트 할당 정보를 불러올 수 없습니다."
        );
      }

      const user = data.user as User;
      return user.scriptAssignments || [];
    },
    enabled: !!authToken?.isAuthorized && !!(userId || authToken?.userId),
    staleTime: 2 * 60 * 1000, // 2분간 캐시 유지
    retry: 1,
  });
};
/**
 * 인증 상태 확인 유틸리티
 */
export const useIsAuthenticated = (): boolean => {
  const { data: authToken } = useAuthStatusQuery();
  return !!authToken?.isAuthorized;
};

/**
 * 사용자 등록 완료 상태 확인
 * 로컬 또는 서버에서 사용자 완료 상태 확인
 */
export const useUserCompletionStatusQuery = (
  userId?: string
): UseQueryResult<boolean, Error> => {
  const { data: authToken } = useAuthStatusQuery();
  const { data: localUser } = useLocalUserQuery();

  return useQuery({
    queryKey: ["userCompletionStatus", userId || authToken?.userId],
    queryFn: async (): Promise<boolean> => {
      const targetUserId = userId || authToken?.userId;

      if (!targetUserId) {
        return false;
      }

      // 먼저 로컬에서 확인
      if (localUser && localUser.completedAt) {
        return true;
      }

      // 인증되지 않은 경우 서버 호출 안함
      if (!authToken?.isAuthorized) {
        return false;
      }

      try {
        const response = await fetch(`/api/users/${targetUserId}`);
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
    enabled: !!(userId || authToken?.userId),
    staleTime: 5 * 60 * 1000, // 5분간 캐시 유지
    retry: 1,
  });
};

/**
 * 사용자 인증 확인 뮤테이션
 * 이름과 주민번호로 승인된 사용자인지 확인
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
        body: JSON.stringify({ name, socialNumber }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "인증에 실패했습니다.");
      }

      return data;
    },
    onSuccess: (data) => {
      // 인증 성공 시 임시 토큰 생성
      createTempToken(data.userId);

      // 사용자 이름도 저장 (여기서 localStorage에 저장됨)
      localStorage.setItem("userName", data.name);

      // 인증 상태 캐시 업데이트
      queryClient.setQueryData(["authStatus"], {
        isAuthorized: true,
        userId: data.userId,
        expiresAt: Date.now() + 24 * 60 * 60 * 1000,
      });

      console.log("인증 성공:", data);
    },
    onError: (error) => {
      console.error("인증 실패:", error);
    },
  });
};

/**
 * 로그아웃 유틸리티
 */
export const logout = (): void => {
  localStorage.removeItem("tempAuthToken");
  localStorage.removeItem("userInfo");
  localStorage.removeItem("userId");
  localStorage.removeItem("userName");
  sessionStorage.clear();

  // 페이지 새로고침으로 상태 초기화
  if (typeof window !== "undefined") {
    window.location.reload();
  }
};
