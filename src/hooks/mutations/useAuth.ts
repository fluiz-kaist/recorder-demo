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
      console.log("🚀 사용자 인증 시작");

      try {
        // 1. 먼저 새로운 해시 기반 방식 시도
        console.log("🔄 사전에 신청한 사용자인지 확인 중...");
        const hashResponse = await fetch("/api/auth/verifyAuthorizedUserV2", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ name, socialNumber }),
        });

        const hashData = await hashResponse.json();

        if (hashResponse.ok && hashData.success) {
          console.log("✅ 신청한 사용자 확인 성공!");
          return {
            ...hashData,
            method: "hash-based" as const,
            socialNumber: socialNumber,
          };
        }

        console.log("⚠️ 등록된 사용자가 아닙니다");
        throw new Error(
          hashData.message || "등록 여부를 확인하는 데 실패했습니다."
        );
      } catch (error) {
        console.error("💥 등록된 사용자 확인 중 에러 발생:", error);

        if (error instanceof Error) {
          throw error;
        }

        throw new Error("알 수 없는 오류가 발생했습니다.");
      }
    },
    onSuccess: (data) => {
      if (!data.user) return;

      console.log(
        `🎯 등록된 사용자 확인 성공 (${data.method} 방식):`,
        data.user.name
      );
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

      console.log("로컬스토리지에 저장함");
      console.log("여기서 이게 뭐야?", data.user);

      console.log(`🎯 등록된 사용자 확인 성공: ${data.user.name}`);

      // 🔧 localStorage에만 저장, 페이지 이동/쿠키 생성 제거
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
    },
    onError: (error) => {
      console.error("❌ 하이브리드 인증 실패:", error);
    },
  });
};
