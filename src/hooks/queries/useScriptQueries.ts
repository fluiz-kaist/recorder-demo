/* eslint-disable @typescript-eslint/no-explicit-any */
// hooks/queries/useScriptQueries.ts - 스크립트 조회 전용 훅
import { useQuery, UseQueryResult } from "@tanstack/react-query";
import { useMemo } from "react";
import {
  ScriptType,
  FormalScript,
  QAScenarioScript,
  SituationalScript,
  UserScriptAssignment,
} from "@/types/firebase";
import {
  useAuthStatusQuery,
  useUserScriptAssignmentsQuery,
} from "./useUserQueries";

/**
 * 할당된 스크립트 내용 조회 결과 타입
 */
interface AssignedScriptsResponse {
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
 * 사용자에게 할당된 스크립트 조회 (assign.ts 기반)
 * 이미 할당받은 스크립트가 있으면 그 내용을 반환
 * @param userId - 사용자 ID
 * @returns UseQueryResult<AssignedScriptsResponse, Error>
 */
export const useAssignedScriptsQuery = (
  userId?: string
): UseQueryResult<AssignedScriptsResponse, Error> => {
  const { data: authToken } = useAuthStatusQuery();
  const targetUserId = userId || authToken?.userId;

  return useQuery({
    queryKey: ["assignedScripts", targetUserId],
    queryFn: async (): Promise<AssignedScriptsResponse> => {
      const response = await fetch("/api/scripts/assign", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ userId: targetUserId }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "할당된 스크립트를 불러올 수 없습니다."
        );
      }

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

      return data as AssignedScriptsResponse;
    },
    enabled: !!authToken?.isAuthorized && !!targetUserId,
    staleTime: 10 * 60 * 1000, // 10분간 캐시 유지
    retry: 1,
  });
};

/**
 * 특정 스크립트 타입의 로컬 저장된 내용 조회
 * @param scriptType - 스크립트 타입
 * @returns UseQueryResult<FormalScript[] | QAScenarioScript[] | SituationalScript[] | null, Error>
 */
export const useLocalScriptsByTypeQuery = (
  scriptType: ScriptType
): UseQueryResult<
  FormalScript[] | QAScenarioScript[] | SituationalScript[] | null,
  Error
> => {
  return useQuery({
    queryKey: ["localScripts", scriptType],
    queryFn: async (): Promise<
      FormalScript[] | QAScenarioScript[] | SituationalScript[] | null
    > => {
      if (typeof window === "undefined") return null;

      const localScripts = localStorage.getItem(`scriptContents_${scriptType}`);

      if (!localScripts) return null;

      try {
        const parsedScripts = JSON.parse(localScripts);
        return parsedScripts;
      } catch (error) {
        console.error("로컬 스크립트 내용 파싱 오류:", error);
        localStorage.removeItem(`scriptContents_${scriptType}`);
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
 * 모든 타입의 로컬 저장된 스크립트 조회
 * @returns UseQueryResult<{ formal: FormalScript[]; qaScenario: QAScenarioScript[]; situational: SituationalScript[] } | null, Error>
 */
export const useAllLocalScriptsQuery = (): UseQueryResult<
  {
    formal: FormalScript[];
    qaScenario: QAScenarioScript[];
    situational: SituationalScript[];
  } | null,
  Error
> => {
  return useQuery({
    queryKey: ["allLocalScripts"],
    queryFn: async (): Promise<{
      formal: FormalScript[];
      qaScenario: QAScenarioScript[];
      situational: SituationalScript[];
    } | null> => {
      if (typeof window === "undefined") return null;

      const formal = localStorage.getItem("scriptContents_formal");
      const qaScenario = localStorage.getItem("scriptContents_qaScenario");
      const situational = localStorage.getItem("scriptContents_situational");

      if (!formal && !qaScenario && !situational) return null;

      try {
        return {
          formal: formal ? JSON.parse(formal) : [],
          qaScenario: qaScenario ? JSON.parse(qaScenario) : [],
          situational: situational ? JSON.parse(situational) : [],
        };
      } catch (error) {
        console.error("로컬 스크립트 파싱 오류:", error);
        localStorage.removeItem("scriptContents_formal");
        localStorage.removeItem("scriptContents_qaScenario");
        localStorage.removeItem("scriptContents_situational");
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
 * 특정 스크립트 타입의 사용자 진행률 계산 (클라이언트 계산)
 * @param scriptType - 스크립트 타입
 * @param userId - 사용자 ID
 * @returns { total: number; completed: number; progress: number } | null
 */
export const useScriptProgressByType = (
  scriptType: ScriptType,
  userId?: string
): { total: number; completed: number; progress: number } | null => {
  const { data: authToken } = useAuthStatusQuery();
  const targetUserId = userId || authToken?.userId;

  // 🔴 USER QUERY 의존: useUserScriptAssignmentsQuery 사용
  const { data: assignments } = useUserScriptAssignmentsQuery(targetUserId);

  return useMemo(() => {
    if (!assignments) return null;

    const typeAssignment = assignments.find(
      (assignment) => assignment.scriptType === scriptType
    );

    if (!typeAssignment) return null;

    // console.log("typeAssignment?", typeAssignment);

    const total =
      typeAssignment.assignedScriptIds.length +
      typeAssignment.completedScriptIds.length;
    const completed = typeAssignment.completedScriptIds.length;
    const progress = total > 0 ? Math.round((completed / total) * 100) : 0;
    // console.log(" total, completed, progress?", total, completed, progress);
    return { total, completed, progress };
  }, [assignments, scriptType]);
};

/**
 * 사용자의 전체 스크립트 진행률 계산 (클라이언트 계산)
 * @param userId - 사용자 ID
 * @returns { [scriptType: string]: { total: number; completed: number; progress: number } } | null
 */
export const useUserTotalProgress = (
  userId?: string
): {
  [scriptType: string]: { total: number; completed: number; progress: number };
} | null => {
  const { data: authToken } = useAuthStatusQuery();
  const targetUserId = userId || authToken?.userId;

  // 🔴 USER QUERY 의존: useUserScriptAssignmentsQuery 사용
  const { data: assignments } = useUserScriptAssignmentsQuery(targetUserId);

  return useMemo(() => {
    if (!assignments) return null;

    const progressByType: {
      [scriptType: string]: {
        total: number;
        completed: number;
        progress: number;
      };
    } = {};

    assignments.forEach((assignment) => {
      const total = assignment.assignedScriptIds.length;
      const completed = assignment.completedScriptIds.length;
      const progress = total > 0 ? Math.round((completed / total) * 100) : 0;

      progressByType[assignment.scriptType] = {
        total,
        completed,
        progress,
      };
    });

    return progressByType;
  }, [assignments]);
};

/**
 * 특정 스크립트 ID로 스크립트 내용 찾기
 * @param scriptType - 스크립트 타입
 * @param scriptId - 스크립트 ID
 * @returns FormalScript | QAScenarioScript | SituationalScript | null
 */
export const useScriptById = (
  scriptType: ScriptType,
  scriptId: number
): FormalScript | QAScenarioScript | SituationalScript | null => {
  const { data: localScripts } = useLocalScriptsByTypeQuery(scriptType);

  return useMemo(() => {
    if (!localScripts || !Array.isArray(localScripts)) return null;

    const script = localScripts.find((s) => s.id === scriptId);
    return script || null;
  }, [localScripts, scriptId]);
};

/**
 * 사용자의 다음 녹음할 스크립트 찾기
 * @param userId - 사용자 ID
 * @returns { scriptType: ScriptType; scriptId: number; scriptData: any } | null
 */
export const useNextScriptToRecord = (
  userId?: string
): {
  scriptType: ScriptType;
  scriptId: number;
  scriptData: FormalScript | QAScenarioScript | SituationalScript;
} | null => {
  const { data: authToken } = useAuthStatusQuery();
  const targetUserId = userId || authToken?.userId;

  // 🔴 USER QUERY 의존: useUserScriptAssignmentsQuery 사용
  const { data: assignments } = useUserScriptAssignmentsQuery(targetUserId);
  const { data: allLocalScripts } = useAllLocalScriptsQuery();

  return useMemo(() => {
    if (!assignments || !allLocalScripts) return null;

    // 각 타입별로 완료되지 않은 첫 번째 스크립트 찾기
    for (const assignment of assignments) {
      const uncompletedIds = assignment.assignedScriptIds.filter(
        (id) => !assignment.completedScriptIds.includes(id)
      );

      if (uncompletedIds.length > 0) {
        const nextScriptId = uncompletedIds[0];
        let scriptData:
          | FormalScript
          | QAScenarioScript
          | SituationalScript
          | undefined;

        // 타입별로 스크립트 데이터 찾기
        switch (assignment.scriptType) {
          case ScriptType.FORMAL:
            scriptData = allLocalScripts.formal.find(
              (s) => s.id === nextScriptId
            );
            break;
          case ScriptType.QA_SCENARIO:
            scriptData = allLocalScripts.qaScenario.find(
              (s) => s.id === nextScriptId
            );
            break;
          case ScriptType.SITUATIONAL:
            scriptData = allLocalScripts.situational.find(
              (s) => s.id === nextScriptId
            );
            break;
        }

        if (scriptData) {
          return {
            scriptType: assignment.scriptType,
            scriptId: nextScriptId,
            scriptData,
          };
        }
      }
    }

    return null;
  }, [assignments, allLocalScripts]);
};

/**
 * 스크립트 유틸리티 함수들
 */
export const scriptUtils = {
  /**
   * 스크립트 타입에 따른 한글 이름 반환
   */
  getTypeName: (scriptType: ScriptType): string => {
    switch (scriptType) {
      case ScriptType.FORMAL:
        return "정식 스크립트";
      case ScriptType.QA_SCENARIO:
        return "질의응답 시나리오";
      case ScriptType.SITUATIONAL:
        return "상황별 스크립트";
      default:
        return "알 수 없는 타입";
    }
  },

  /**
   * 스크립트 데이터에서 제목 추출
   */
  getScriptTitle: (
    script: FormalScript | QAScenarioScript | SituationalScript
  ): string => {
    // 타입 가드 사용
    if ("title" in script && script.title) {
      return script.title;
    }
    if ("situation" in script && script.situation) {
      return script.situation;
    }
    // 모든 타입에 id가 있다고 가정
    return `스크립트 ${(script as any).id}`;
  },

  /**
   * 스크립트 데이터에서 내용 추출
   */
  getScriptContent: (
    script: FormalScript | QAScenarioScript | SituationalScript
  ): string => {
    // 타입 가드 사용
    if ("formalSentence" in script && script.formalSentence) {
      return script.formalSentence;
    }
    if ("description" in script && script.description) {
      return script.description;
    }
    return "";
  },

  /**
   * 로컬 스토리지 정리
   */
  clearLocalScripts: (): void => {
    localStorage.removeItem("scriptContents_formal");
    localStorage.removeItem("scriptContents_qaScenario");
    localStorage.removeItem("scriptContents_situational");
  },

  /**
   * 특정 타입의 로컬 스크립트 정리
   */
  clearLocalScriptsByType: (scriptType: ScriptType): void => {
    localStorage.removeItem(`scriptContents_${scriptType}`);
  },
};
