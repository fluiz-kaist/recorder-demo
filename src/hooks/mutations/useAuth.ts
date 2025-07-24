// hooks/mutations/useHybridAuth.ts - 새로 생성 (기존 + 새 방식 지원)
import { useMutation, UseMutationResult } from "@tanstack/react-query";

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
    userHash: string;
  };
}

/**
 * 하이브리드 인증 뮤테이션 (기존 + 새 방식 동시 지원)
 * 새 방식 우선 시도 → 실패시 기존 방식으로 폴백
 */
export const useAuthMutation = (): UseMutationResult<
  AuthResponse,
  Error,
  AuthRequest
> => {
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
            socialNumber: socialNumber,
          };
        }

        console.log("⚠️ 해시 기반 인증 실패");
        throw new Error(hashData.message || "해시 기반 인증에 실패했습니다.");
      } catch (error) {
        console.error("💥 해시 기반 인증 오류:", error);

        if (error instanceof Error) {
          throw error;
        }

        throw new Error("알 수 없는 오류가 발생했습니다.");
      }
    },
    onSuccess: (data) => {
      if (!data.user) return;

      console.log(`🎯 인증 성공 (${data.method} 방식):`, data.user.name);
      // 🟢 localStorage에 저장 (모든 사용자)
      localStorage.setItem(
        "pendingAuth",
        JSON.stringify({
          userId: data.user.userId,
          name: data.user.name,
          userHash: data.user.userHash,
          method: data.method,
          timestamp: Date.now(),
          isExistingUser: data.user.isExistingUser,
          existingData: data.user.existingData,
        })
      );

      // 기존 사용자는 바로 쿠키 생성하고 main으로 이동
      if (data.user.isExistingUser) {
        console.log("✅ 기존 사용자 - 바로 쿠키 생성하고 main으로 이동");
        // 바로 리다이렉트
        window.location.href = "/main";

        // 백그라운드에서 쿠키 생성 (응답 기다리지 않음)
        fetch("/api/auth/completeAuth", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            userId: data.user.userId,
            userHash: data.user.userHash,
          }),
        });

        return;
      }

      // 신규 사용자만 localStorage 저장
      localStorage.setItem(
        "pendingAuth",
        JSON.stringify({
          userId: data.user.userId,
          name: data.user.name,
          userHash: data.user.userHash,
          method: data.method,
          timestamp: Date.now(),
          isExistingUser: false, // 신규 사용자
        })
      );

      console.log("✅ 신규 사용자 - localStorage 저장 완료");
    },
    onError: (error) => {
      console.error("❌ 하이브리드 인증 실패:", error);
    },
  });
};
