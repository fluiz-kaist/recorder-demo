// hooks/mutations/useScriptMutations.ts - 스크립트 관련 데이터 변경 훅
import {
  useMutation,
  useQueryClient,
  UseMutationResult,
} from "@tanstack/react-query";
import {
  ScriptType,
  UserScriptAssignment,
  FormalScript,
  QAScenarioScript,
  SituationalScript,
  User,
} from "@/types/firebase";

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
    qaScenario: QAScenarioScript[];
    situational: SituationalScript[];
  };
  assignments: UserScriptAssignment[];
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
        qaScenario: data.scripts.qaScenario || [],
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
 * 스크립트 할당 정보 새로고침 뮤테이션
 * 서버에서 최신 할당 정보를 다시 가져옴
 */
export const useRefreshScriptAssignmentsMutation = (): UseMutationResult<
  AssignScriptsResponse,
  Error,
  { userId: string }
> => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      userId,
    }: {
      userId: string;
    }): Promise<AssignScriptsResponse> => {
      const response = await fetch("/api/scripts/assign", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ userId }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "스크립트 할당 정보 새로고침에 실패했습니다."
        );
      }

      return data as AssignScriptsResponse;
    },
    onSuccess: (data, variables) => {
      // 스크립트 내용을 localStorage에 다시 저장
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

      // 직접 캐시 업데이트
      queryClient.setQueryData(["assignedScripts", variables.userId], data);

      // 로컬 스크립트 캐시 업데이트
      queryClient.setQueryData(["allLocalScripts"], {
        formal: data.scripts.formal || [],
        qaScenario: data.scripts.qaScenario || [],
        situational: data.scripts.situational || [],
      });

      Object.entries(data.scripts).forEach(([scriptType, scripts]) => {
        queryClient.setQueryData(["localScripts", scriptType], scripts);
      });

      console.log("스크립트 할당 정보 새로고침 완료:", data);
    },
    onError: (error) => {
      console.error("스크립트 할당 정보 새로고침 중 오류:", error);
    },
  });
};

/**
 * 로컬 스크립트 캐시 정리 뮤테이션
 * 테스트용 또는 로그아웃 시 사용
 */
export const useClearLocalScriptsMutation = (): UseMutationResult<
  void,
  Error,
  { scriptType?: ScriptType }
> => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      scriptType,
    }: {
      scriptType?: ScriptType;
    }): Promise<void> => {
      if (scriptType) {
        // 특정 타입만 정리
        localStorage.removeItem(`scriptContents_${scriptType}`);
      } else {
        // 모든 스크립트 정리
        localStorage.removeItem("scriptContents_formal");
        localStorage.removeItem("scriptContents_qaScenario");
        localStorage.removeItem("scriptContents_situational");
      }
    },
    onSuccess: (_, variables) => {
      // 로컬 스크립트 캐시를 null로 직접 설정
      if (variables.scriptType) {
        queryClient.setQueryData(["localScripts", variables.scriptType], null);
      } else {
        queryClient.setQueryData(["localScripts", ScriptType.FORMAL], null);
        queryClient.setQueryData(
          ["localScripts", ScriptType.QA_SCENARIO],
          null
        );
        queryClient.setQueryData(
          ["localScripts", ScriptType.SITUATIONAL],
          null
        );
        queryClient.setQueryData(["allLocalScripts"], null);
      }

      console.log("로컬 스크립트 캐시 정리 완료:", variables);
    },
    onError: (error) => {
      console.error("로컬 스크립트 캐시 정리 중 오류:", error);
    },
  });
};
