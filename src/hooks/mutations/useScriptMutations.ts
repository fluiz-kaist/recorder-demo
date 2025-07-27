// mutations/useScriptMutations.ts - 스크립트 관련 뮤테이션들

import {
  useMutation,
  useQueryClient,
  UseMutationResult,
} from "@tanstack/react-query";
import { useMinimalUserQuery } from "@/hooks/queries/useUserQueries";
import { ScriptDataManager } from "@/utils/scriptDataManager";
import {
  ScriptType,
  FormalScript,
  SituationalScript,
  User,
  ParticipationSet,
} from "@/types/firebase";

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
 * 스크립트 할당 요청 데이터 타입
 */
interface AssignScriptsRequest {
  userId: string;
  currentSetNumber: number;
}

/**
 * 스크립트 할당 응답 데이터 타입 (assign.ts 기반)
 */
interface AssignScriptsResponse {
  success: boolean;
  message?: string;
  participationSet?: ParticipationSet;
  scripts: {
    formal: FormalScript[];
    situational: SituationalScript[];
  };
}
/**
 * 스크립트 완료 응답 데이터 타입
 */
interface CompleteScriptResponse {
  success: boolean;
  message?: string;
  user?: User; // 업데이트된 사용자 정보
}
/**
 * 스크립트 완료 요청 데이터 타입 (수정된 complete.ts 기반)
 */
interface CompleteScriptRequest {
  userId: string;
  scriptId: number;
  scriptType: ScriptType;
  recordingId: string; // 오디오 업로드 후 받은 recording ID
  audioUrl: string;
  sttText: string;
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

      console.log("✅ API 응답:", data);
      return data;
    },
    onSuccess: (data, variables) => {
      console.log("🎯 할당 성공, participationSet:", data.participationSet);
      console.log("✅ 스크립트 초기화 완료:", {
        situational: data.scripts.situational.length,
        formal: data.scripts.formal.length,
        setNumber: variables.setNumber,
        setId: variables.setId,
      });

      // 🔥 participationSet이 있으면 localStorage에 스크립트 저장
      if (data.participationSet && data.scripts) {
        // ScriptDataManager 사용
        ScriptDataManager.saveScriptData(
          variables.userId,
          data.participationSet.setNumber,
          data.participationSet.setId,
          data.scripts
        );
      }

      // 스크립트 내용을 localStorage에도 저장 (기존 로직 유지)
      if (data.success && data.scripts) {
        Object.entries(data.scripts).forEach(([scriptType, scripts]) => {
          if (Array.isArray(scripts) && scripts.length > 0) {
            localStorage.setItem(
              `scriptContents_${scriptType}`,
              JSON.stringify(scripts)
            );
          }
        });
      }

      // 🔥 사용자 쿼리 무효화 (participation.sets 업데이트됨)
      queryClient.invalidateQueries({
        queryKey: ["user"],
        exact: false,
      });

      // 다른 캐시들도 업데이트
      queryClient.setQueryData(["assignedScripts", variables.userId], data);
      queryClient.setQueryData(["allLocalScripts"], {
        formal: data.scripts.formal || [],
        situational: data.scripts.situational || [],
      });

      console.log("✅ 스크립트 할당 완료:", data);
    },
    onError: (error) => {
      console.error("❌ 스크립트 초기화 실패:", error);
    },
  });
};

/**
 * 사용자에게 스크립트 할당 뮤테이션
 * assign.ts의 /api/scripts/assign 엔드포인트 사용
 */
export const useAssignScriptsMutation = (): UseMutationResult<
  AssignScriptsResponse,
  Error,
  AssignScriptsRequest
> => {
  return useMutation({
    mutationFn: async ({
      userId,
      currentSetNumber,
    }: AssignScriptsRequest): Promise<AssignScriptsResponse> => {
      console.log("요청1");
      const setNumber = currentSetNumber;
      const setId = currentSetNumber;
      const response = await fetch("/api/scripts/assign", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ userId, setNumber, setId }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "스크립트 할당에 실패했습니다.");
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

      return data as AssignScriptsResponse;
    },
    onSuccess: (data, variables) => {
      console.log("스크립트 할당 완료:", data);
    },
    onError: (error) => {
      console.error("스크립트 할당 중 오류:", error);
    },
  });
};
