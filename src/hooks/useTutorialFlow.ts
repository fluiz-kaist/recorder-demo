// hooks/useTutorialFlow.ts - 튜토리얼 플로우 전용 훅
import { useState } from "react";
import { useRouter } from "next/router";
import { useUpdateUserMutation } from "@/hooks/mutations/useUserMutations";
import { useAssignScriptsMutation } from "@/hooks/mutations/useScriptMutations";
import { useUserQuery } from "@/hooks/queries/useUserQueries";

export const useTutorialFlow = () => {
  const router = useRouter();
  const { data: user } = useUserQuery();
  const updateUserMutation = useUpdateUserMutation();
  const assignScriptsMutation = useAssignScriptsMutation();

  const [isCompleting, setIsCompleting] = useState(false);

  const completeTutorialAndAssignScripts = async () => {
    if (!user?.id || isCompleting) return;

    setIsCompleting(true);

    try {
      console.log("🎯 튜토리얼 완료 프로세스 시작");

      // 1. 튜토리얼 완료 상태 업데이트
      await updateUserMutation.mutateAsync({
        userId: user.id,
        updates: {
          currentStatus: {
            ...user.currentStatus,
            isTutorialCompleted: true,
            canStartRecording: true,
          },
        },
      });

      // 2. 스크립트 할당
      const assignResult = await assignScriptsMutation.mutateAsync({
        userId: user.id,
        currentSetNumber: user.participation?.currentSetNumber || 1,
      });

      console.log("✅ 튜토리얼 완료 및 스크립트 할당 성공");

      // 3. 메인 화면으로 이동
      router.push("/");

      return assignResult;
    } catch (error) {
      console.error("❌ 튜토리얼 완료 실패:", error);
      throw error;
    } finally {
      setIsCompleting(false);
    }
  };

  return {
    completeTutorialAndAssignScripts,
    isCompleting,
    isLoading: updateUserMutation.isPending || assignScriptsMutation.isPending,
    error: updateUserMutation.error || assignScriptsMutation.error,
  };
};
