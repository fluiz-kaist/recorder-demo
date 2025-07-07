// hooks/mutations/useAdminMutations.ts - 관리자용 데이터 변경 훅
import {
  useMutation,
  useQueryClient,
  UseMutationResult,
} from "@tanstack/react-query";

/**
 * 스크립트 초기화 뮤테이션
 * 모든 스크립트 할당을 초기화하고 사용자들의 scriptAssignments를 리셋
 */
export const useInitScriptsMutation = (): UseMutationResult<
  { success: boolean; message: string },
  Error,
  void
> => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (): Promise<{ success: boolean; message: string }> => {
      const response = await fetch("/api/admin/init-scripts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "스크립트 초기화에 실패했습니다.");
      }

      return data;
    },
    onSuccess: () => {
      // 관련 캐시 무효화
      queryClient.invalidateQueries({ queryKey: ["adminStats"] });
      queryClient.invalidateQueries({ queryKey: ["allUsers"] });
      queryClient.invalidateQueries({ queryKey: ["scriptStats"] });
      queryClient.invalidateQueries({ queryKey: ["assignedScripts"] });
      queryClient.invalidateQueries({ queryKey: ["userScriptAssignments"] });

      // 로컬 스크립트 캐시도 정리
      queryClient.removeQueries({ queryKey: ["localScripts"] });
      queryClient.removeQueries({ queryKey: ["allLocalScripts"] });

      console.log("스크립트 초기화 완료");
    },
    onError: (error) => {
      console.error("스크립트 초기화 실패:", error);
    },
  });
};

/**
 * 사용자 삭제 뮤테이션
 * 사용자와 관련된 모든 데이터 (녹음, 스크립트 할당 등) 삭제
 */
export const useDeleteUserMutation = (): UseMutationResult<
  { success: boolean; message: string },
  Error,
  string
> => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (
      userId: string
    ): Promise<{ success: boolean; message: string }> => {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "사용자 삭제에 실패했습니다.");
      }

      return data;
    },
    onSuccess: (_, userId) => {
      // 관련 캐시 무효화
      queryClient.invalidateQueries({ queryKey: ["adminStats"] });
      queryClient.invalidateQueries({ queryKey: ["allUsers"] });
      queryClient.invalidateQueries({ queryKey: ["scriptStats"] });

      // 특정 사용자 관련 캐시 제거
      queryClient.removeQueries({ queryKey: ["user", userId] });
      queryClient.removeQueries({ queryKey: ["userDetail", userId] });
      queryClient.removeQueries({
        queryKey: ["userScriptAssignments", userId],
      });
      queryClient.removeQueries({ queryKey: ["audioRecordings", userId] });

      console.log("사용자 삭제 완료:", userId);
    },
    onError: (error) => {
      console.error("사용자 삭제 실패:", error);
    },
  });
};

/**
 * 전체 데이터 초기화 뮤테이션
 * 모든 사용자, 녹음, 스크립트 할당 데이터 삭제 (위험한 작업)
 */
export const useClearAllDataMutation = (): UseMutationResult<
  { success: boolean; message: string },
  Error,
  void
> => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (): Promise<{ success: boolean; message: string }> => {
      const response = await fetch("/api/admin/clear-all-data", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "전체 데이터 삭제에 실패했습니다.");
      }

      return data;
    },
    onSuccess: () => {
      // 모든 캐시 정리
      queryClient.clear();

      // 로컬 스토리지도 정리
      localStorage.removeItem("userInfo");
      localStorage.removeItem("userId");
      localStorage.removeItem("tempAuthToken");
      localStorage.removeItem("scriptContents_formal");
      localStorage.removeItem("scriptContents_qaScenario");
      localStorage.removeItem("scriptContents_situational");

      console.log("전체 데이터 삭제 완료");
    },
    onError: (error) => {
      console.error("전체 데이터 삭제 실패:", error);
    },
  });
};

/**
 * 사용자 스크립트 재할당 뮤테이션
 * 특정 사용자에게 새로운 스크립트 할당
 */
export const useReassignUserScriptsMutation = (): UseMutationResult<
  { success: boolean; message: string },
  Error,
  { userId: string; scriptTypes?: string[] }
> => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      userId,
      scriptTypes,
    }: {
      userId: string;
      scriptTypes?: string[];
    }): Promise<{ success: boolean; message: string }> => {
      const response = await fetch("/api/admin/reassign-scripts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ userId, scriptTypes }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "스크립트 재할당에 실패했습니다.");
      }

      return data;
    },
    onSuccess: (_, variables) => {
      // 관련 캐시 무효화
      queryClient.invalidateQueries({ queryKey: ["allUsers"] });
      queryClient.invalidateQueries({
        queryKey: ["userDetail", variables.userId],
      });
      queryClient.invalidateQueries({
        queryKey: ["userScriptAssignments", variables.userId],
      });
      queryClient.invalidateQueries({
        queryKey: ["assignedScripts", variables.userId],
      });
      queryClient.invalidateQueries({ queryKey: ["scriptStats"] });

      console.log("스크립트 재할당 완료:", variables.userId);
    },
    onError: (error) => {
      console.error("스크립트 재할당 실패:", error);
    },
  });
};

/**
 * 시스템 상태 리셋 뮤테이션
 * 서버 캐시 정리 및 시스템 초기화
 */
export const useResetSystemMutation = (): UseMutationResult<
  { success: boolean; message: string },
  Error,
  void
> => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (): Promise<{ success: boolean; message: string }> => {
      const response = await fetch("/api/admin/reset-system", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "시스템 리셋에 실패했습니다.");
      }

      return data;
    },
    onSuccess: () => {
      // 모든 캐시 무효화
      queryClient.invalidateQueries();

      console.log("시스템 리셋 완료");
    },
    onError: (error) => {
      console.error("시스템 리셋 실패:", error);
    },
  });
};
