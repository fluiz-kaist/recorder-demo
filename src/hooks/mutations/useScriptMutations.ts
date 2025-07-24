// mutations/useScriptMutations.ts - 스크립트 관련 뮤테이션들

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocalUserQuery } from "@/hooks/queries/useUserQueries";
import { ScriptDataManager } from "@/utils/scriptDataManager";

// 타입 정의
interface InitializeScriptsParams {
  userId: string;
  setNumber: number;
  setId?: number;
}

interface InitializeScriptsResponse {
  success: boolean;
  message?: string;
  participationSet?: any;
  scripts: {
    situational: any[];
    formal: any[];
  };
}

/**
 * 스크립트 초기화 뮤테이션
 * - API 호출을 통해 스크립트 할당/로드
 * - localStorage에 데이터 저장 (그리고 React Query 캐시 업데이트)
 */
export const useInitializeScriptsMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      userId,
      setNumber,
      setId = 1,
    }: InitializeScriptsParams) => {
      const response = await fetch("/api/scripts/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, setNumber, setId }),
      });

      if (!response.ok) {
        throw new Error(`API 호출 실패: ${response.status}`);
      }

      const data: InitializeScriptsResponse = await response.json();

      if (!data.success) {
        throw new Error(data.message || "스크립트 할당 실패");
      }

      // localStorage에 저장
      if (data.participationSet) {
        ScriptDataManager.saveScriptData(
          userId,
          data.participationSet.setNumber,
          data.participationSet.setId,
          data.scripts
        );
      }

      return data;
    },
    onSuccess: (data, variables) => {
      console.log("✅ 스크립트 초기화 완료:", {
        situational: data.scripts.situational.length,
        formal: data.scripts.formal.length,
        setNumber: variables.setNumber,
        setId: variables.setId,
      });

      // 관련 쿼리 무효화: scriptData 쿼리를 무효화하여 useScriptDataQuery가 localStorage에서 최신 데이터를 가져오도록 합니다.
      queryClient.invalidateQueries({
        queryKey: [
          "scriptData",
          variables.userId, // userId를 쿼리 키에 포함하는 것이 일관적입니다.
          variables.setNumber,
          variables.setId,
        ],
      });
      // 다른 관련 쿼리들도 무효화 (기존 로직 유지)
      queryClient.invalidateQueries({
        queryKey: [
          "serviceProgress",
          variables.userId,
          variables.setNumber,
          variables.setId,
        ],
      });
      queryClient.invalidateQueries({
        queryKey: ["allServices", variables.setNumber, variables.setId],
      });
      queryClient.invalidateQueries({
        queryKey: ["scriptStats", variables.setNumber, variables.setId],
      });
    },
    onError: (error) => {
      console.error("❌ 스크립트 초기화 실패:", error);
    },
  });
};
/**
 * 스크립트 데이터 삭제 뮤테이션
 */
export const useClearScriptDataMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      ScriptDataManager.clearData();
      return true;
    },
    onSuccess: () => {
      console.log("✅ 스크립트 데이터 삭제 완료");

      // 모든 스크립트 관련 쿼리 무효화 (기존 로직 유지)
      queryClient.invalidateQueries({ queryKey: ["scriptData"] });
      queryClient.invalidateQueries({ queryKey: ["serviceProgress"] });
      queryClient.invalidateQueries({ queryKey: ["serviceTasks"] });
      queryClient.invalidateQueries({ queryKey: ["allServices"] });
      queryClient.invalidateQueries({ queryKey: ["serviceStats"] });
      queryClient.invalidateQueries({ queryKey: ["scriptByTaskKey"] });
      queryClient.invalidateQueries({ queryKey: ["scriptStats"] });
    },
    onError: (error) => {
      console.error("❌ 스크립트 데이터 삭제 실패:", error);
    },
  });
};

/**
 * 스크립트 데이터 새로고침 뮤테이션
 * (강제로 다시 로드해야 할 때 사용)
 */
export const useRefreshScriptDataMutation = () => {
  const queryClient = useQueryClient();
  const { data: localUser } = useLocalUserQuery();

  return useMutation({
    mutationFn: async ({
      userId,
      setNumber,
      setId,
    }: {
      userId: string;
      setNumber: number;
      setId?: number;
    }) => {
      if (!userId) {
        // userId를 파라미터로 받았으니 이걸 사용합니다.
        throw new Error("사용자 정보가 없습니다.");
      }

      // 기존 데이터 삭제 (localStorage에서 직접 삭제)
      ScriptDataManager.clearData();

      // 새로 로드 (initializeScriptsMutation과 유사)
      const response = await fetch("/api/scripts/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: userId, // 파라미터로 받은 userId 사용
          setNumber,
          setId,
        }),
      });

      if (!response.ok) {
        throw new Error(`API 호출 실패: ${response.status}`);
      }

      const data: InitializeScriptsResponse = await response.json();

      if (!data.success) {
        throw new Error(data.message || "스크립트 새로고침 실패");
      }

      // localStorage에 저장
      if (data.participationSet) {
        ScriptDataManager.saveScriptData(
          userId, // 파라미터로 받은 userId 사용
          data.participationSet.setNumber,
          data.participationSet.setId,
          data.scripts
        );
      }

      return data;
    },
    onSuccess: (data, variables) => {
      console.log("✅ 스크립트 데이터 새로고침 완료");

      // 모든 관련 쿼리 무효화 (기존 로직 유지)
      queryClient.invalidateQueries({ queryKey: ["scriptData"] });
      queryClient.invalidateQueries({ queryKey: ["serviceProgress"] });
      queryClient.invalidateQueries({ queryKey: ["serviceTasks"] });
      queryClient.invalidateQueries({ queryKey: ["allServices"] });
      queryClient.invalidateQueries({ queryKey: ["serviceStats"] });
      queryClient.invalidateQueries({ queryKey: ["scriptByTaskKey"] });
      queryClient.invalidateQueries({ queryKey: ["scriptStats"] });
    },
    onError: (error) => {
      console.error("❌ 스크립트 데이터 새로고침 실패:", error);
    },
  });
};
