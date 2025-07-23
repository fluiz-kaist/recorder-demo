// hooks/mutations/useHybridAuth.ts - 새로 생성 (기존 + 새 방식 지원)
import {
  useMutation,
  useQueryClient,
  UseMutationResult,
} from "@tanstack/react-query";
import {
  updateUserRelatedCache,
  updateAuthStatusCache,
} from "@/utils/queryCache";

interface AuthRequest {
  name: string;
  socialNumber: string;
}

interface AuthResponse {
  success: boolean;
  message: string;
  method?: "legacy" | "hash-based";
  user?: {
    name: string;
    userId: string;
    isExistingUser: boolean;
    existingData?: any;
  };
}

/**
 * 하이브리드 인증 뮤테이션 (기존 + 새 방식 동시 지원)
 * 새 방식 우선 시도 → 실패시 기존 방식으로 폴백
 */
export const useHybridAuthMutation = (): UseMutationResult<
  AuthResponse,
  Error,
  AuthRequest
> => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      name,
      socialNumber,
    }: AuthRequest): Promise<AuthResponse> => {
      console.log("🚀 하이브리드 인증 시작");

      try {
        // 1. 먼저 새로운 해시 기반 방식 시도
        console.log("🔄 해시 기반 인증 시도...");
        const hashResponse = await fetch("/api/auth/verifyAuthorizedUserV2", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ name, socialNumber }),
        });

        const hashData = await hashResponse.json();

        if (hashResponse.ok && hashData.success) {
          console.log("✅ 해시 기반 인증 성공!");
          return {
            ...hashData,
            method: "hash-based" as const,
          };
        }

        console.log("⚠️ 해시 기반 인증 실패, 기존 방식으로 폴백...");

        // 2. 폴백으로 기존 방식 시도
        const legacyResponse = await fetch("/api/auth/verifyAuthorizedUser", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ name, socialNumber }),
        });

        const legacyData = await legacyResponse.json();

        if (legacyResponse.ok && legacyData.success) {
          console.log("✅ 기존 방식 인증 성공!");
          return {
            ...legacyData,
            method: "legacy" as const,
          };
        }

        // 3. 두 방식 모두 실패
        console.error("❌ 모든 인증 방식 실패");
        throw new Error(
          hashData.message || legacyData.message || "인증에 실패했습니다."
        );
      } catch (error) {
        console.error("💥 하이브리드 인증 오류:", error);

        if (error instanceof Error) {
          throw error;
        }

        throw new Error("알 수 없는 오류가 발생했습니다.");
      }
    },
    onSuccess: (data) => {
      if (!data.user) return;

      console.log(`🎯 인증 성공 (${data.method} 방식):`, data.user.name);

      // 기존 사용자인지 확인
      if (data.user.isExistingUser) {
        // 기존 사용자 데이터로 캐시 업데이트
        updateAuthStatusCache(queryClient, true, data.user.userId);

        if (data.user.existingData) {
          updateUserRelatedCache(
            queryClient,
            data.user.userId,
            data.user.existingData
          );
        }

        console.log("✅ 기존 사용자 로그인 성공:", data.user.name);

        // 기존 사용자는 바로 메인으로 이동
        setTimeout(() => {
          window.location.href = "/main";
        }, 1000);
        return;
      }

      // 신규 사용자 처리
      const userInfo = {
        name: data.user.name,
        completedAt: null,
        scriptAssignments: [],
      };

      // 신규 사용자 캐시 업데이트
      updateAuthStatusCache(queryClient, true, data.user.userId);
      queryClient.setQueryData(["localUser"], userInfo);

      console.log("✅ 신규 사용자 인증 성공:", data.user.name);
    },
    onError: (error) => {
      console.error("❌ 하이브리드 인증 실패:", error);
    },
  });
};

/**
 * 새로운 해시 기반 방식만 사용하는 뮤테이션 (테스트용)
 */
export const useHashBasedAuthMutation = (): UseMutationResult<
  AuthResponse,
  Error,
  AuthRequest
> => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      name,
      socialNumber,
    }: AuthRequest): Promise<AuthResponse> => {
      console.log("🔒 해시 기반 인증만 사용");

      const response = await fetch("/api/auth/verifyAuthorizedUserV2", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name, socialNumber }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "해시 기반 인증에 실패했습니다.");
      }

      return { ...data, method: "hash-based" as const };
    },
    onSuccess: (data) => {
      console.log("🎉 해시 기반 인증 성공:", data.user?.name);
      // 성공 처리 로직 (위와 동일)
    },
    onError: (error) => {
      console.error("❌ 해시 기반 인증 실패:", error);
    },
  });
};
