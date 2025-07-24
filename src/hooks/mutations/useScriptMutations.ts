// mutations/useScriptMutations.ts - 스크립트 관련 뮤테이션들

import {
  useMutation,
  useQueryClient,
  UseMutationResult,
} from "@tanstack/react-query";
import { useLocalUserQuery } from "@/hooks/queries/useUserQueries";
import { ScriptDataManager } from "@/utils/scriptDataManager";
import {
  ScriptType,
  UserScriptAssignment,
  FormalScript,
  SituationalScript,
  User,
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
}

/**
 * 스크립트 할당 응답 데이터 타입 (assign.ts 기반)
 */
interface AssignScriptsResponse {
  success: boolean;
  message?: string;
  scripts: {
    formal: FormalScript[];
    situational: SituationalScript[];
  };
  assignments: UserScriptAssignment[];
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
/////////

/**
 * 스크립트 완료 처리 뮤테이션 (수정된 complete.ts 사용)
 * 오디오 업로드 후 호출하여 스크립트 완료 상태로 변경
 */
export const useCompleteScriptMutation = (): UseMutationResult<
  CompleteScriptResponse,
  Error,
  CompleteScriptRequest
> => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      userId,
      scriptId,
      scriptType,
      recordingId,
      audioUrl,
      sttText,
    }: CompleteScriptRequest): Promise<CompleteScriptResponse> => {
      const response = await fetch("/api/scripts/complete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId,
          scriptId,
          scriptType,
          recordingId,
          audioUrl,
          sttText,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "스크립트 완료 처리에 실패했습니다.");
      }

      return data as CompleteScriptResponse;
    },
    onSuccess: (data, variables) => {
      if (data.user) {
        // 업데이트된 사용자 정보로 직접 캐시 업데이트
        queryClient.setQueryData(["user", variables.userId], data.user);
        queryClient.setQueryData(["localUser"], data.user);

        // 사용자 스크립트 할당 정보도 직접 업데이트
        queryClient.setQueryData(
          ["userScriptAssignments", variables.userId],
          data.user.scriptAssignments
        );

        // localStorage의 사용자 정보도 업데이트
        localStorage.setItem("userInfo", JSON.stringify(data.user));
      }

      // assignedScripts 쿼리도 업데이트 (할당 정보 변경됨)
      const existingAssignedScripts =
        queryClient.getQueryData<AssignScriptsResponse>([
          "assignedScripts",
          variables.userId,
        ]);
      if (existingAssignedScripts && data.user) {
        const updatedAssignedScripts: AssignScriptsResponse = {
          ...existingAssignedScripts,
          assignments: data.user.scriptAssignments,
        };
        queryClient.setQueryData(
          ["assignedScripts", variables.userId],
          updatedAssignedScripts
        );
      }

      console.log("스크립트 완료 처리 완료:", variables);
    },
    onError: (error) => {
      console.error("스크립트 완료 처리 중 오류:", error);
    },
  });
};

/**
 * 스크립트 완료 응답 데이터 타입
 */
interface CompleteScriptResponse {
  success: boolean;
  message?: string;
  user?: User; // 업데이트된 사용자 정보
}

/**
 * 사용자에게 스크립트 할당 뮤테이션
 * assign.ts의 /api/scripts/assign 엔드포인트 사용
 */
export const useAssignScriptsMutation = (): UseMutationResult<
  AssignScriptsResponse,
  Error,
  AssignScriptsRequest
> => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      userId,
    }: AssignScriptsRequest): Promise<AssignScriptsResponse> => {
      console.log("요청1");
      const response = await fetch("/api/scripts/assign", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ userId }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "스크립트 할당에 실패했습니다.");
      }

      return data as AssignScriptsResponse;
    },
    onSuccess: (data, variables) => {
      // 스크립트 내용을 localStorage에 저장
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

      // 직접 캐시 업데이트 (무효화 대신)
      queryClient.setQueryData(["assignedScripts", variables.userId], data);

      // 로컬 스크립트 캐시도 직접 업데이트
      queryClient.setQueryData(["allLocalScripts"], {
        formal: data.scripts.formal || [],
        situational: data.scripts.situational || [],
      });

      // 개별 타입별 로컬 스크립트도 업데이트
      Object.entries(data.scripts).forEach(([scriptType, scripts]) => {
        queryClient.setQueryData(["localScripts", scriptType], scripts);
      });

      console.log("스크립트 할당 완료:", data);
    },
    onError: (error) => {
      console.error("스크립트 할당 중 오류:", error);
    },
  });
};
