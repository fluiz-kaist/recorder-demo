// queries/useScriptQueries.ts - 스크립트 관련 쿼리들

import { useQuery, UseQueryResult } from "@tanstack/react-query";
import { useMinimalUserQuery } from "@/hooks/queries/useUserQueries";
import { ScriptDataManager } from "@/utils/scriptDataManager";
import { FormalScript, SituationalScript } from "@/types/firebase";
// 타입 정의
interface ServiceCompletion {
  situationalCompleted: number;
  formalCompleted: number;
  totalCompleted: number;
  status: "not-started" | "in-progress" | "completed";
  progress: number;
}

interface TaskInfo {
  taskKey: string;
  situational?: any;
  formal?: any;
  situationalCompleted: boolean;
  formalCompleted: boolean;
}

/**
 * 현재 저장된 스크립트 데이터 조회
 * 이 쿼리는 ScriptDataManager를 통해 localStorage에서 데이터를 조회합니다.
 * 스크립트 데이터가 로드되면 React Query 캐시에 저장됩니다.
 */
export const useScriptDataQuery = (setNumber: number, setId: number = 1) => {
  const { data: minimalUserInfo } = useMinimalUserQuery();

  return useQuery({
    queryKey: ["scriptData", minimalUserInfo?.id, setNumber, setId],
    queryFn: async () => {
      // localStorage에서 스크립트 데이터를 직접 가져옵니다.
      // 이 함수는 서버 호출이 아니라 로컬 스토리지 읽기입니다.
      const scriptData = ScriptDataManager.getScriptData();

      // 요청한 세트와 다르면 null 반환
      if (
        scriptData &&
        (scriptData.setNumber !== setNumber || scriptData.setId !== setId)
      ) {
        return null;
      }

      return scriptData;
    },
    // localUser.id가 있을 때만 쿼리를 실행합니다.
    enabled: !!minimalUserInfo?.id,
    // 스크립트 데이터는 자주 변하지 않으므로, 꽤 긴 staleTime을 설정합니다.
    staleTime: 1000 * 60 * 5, // 5분간 캐시 유지
    // 데이터가 없으면 refetch 하지 않도록 설정
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
};

/**
 * 모든 서비스 목록 조회
 */
export const useAllServicesQuery = (setNumber: number, setId: number = 1) => {
  console.log("저기?-1");
  const scriptDataQuery = useScriptDataQuery(setNumber, setId);

  return useQuery({
    queryKey: ["allServices", setNumber, setId],
    queryFn: (): string[] => {
      const scriptData = scriptDataQuery.data;
      return scriptData
        ? Object.keys(scriptData.indexes.taskKeysByService)
        : [];
    },
    enabled: !!scriptDataQuery.data,
    staleTime: 10 * 60 * 1000, // 10분간 캐시
  });
};

/**
 * 특정 서비스의 통계 조회
 */
export const useServiceStatsQuery = (
  serviceName: string,
  setNumber: number,
  setId: number = 1
) => {
  console.log("저기?-2");
  const scriptDataQuery = useScriptDataQuery(setNumber, setId);

  return useQuery({
    queryKey: ["serviceStats", serviceName, setNumber, setId],
    queryFn: () => {
      const scriptData = scriptDataQuery.data;
      return scriptData?.indexes.serviceStats[serviceName] || null;
    },
    enabled: !!scriptDataQuery.data && !!serviceName,
    staleTime: 10 * 60 * 1000, // 10분간 캐시
  });
};

/**
 * 특정 태스크의 스크립트 조회
 */
export const useScriptByTaskKeyQuery = (
  taskKey: string,
  type: "situational" | "formal",
  setNumber: number,
  setId: number = 1
) => {
  console.log("저기?-3");
  const scriptDataQuery = useScriptDataQuery(setNumber, setId);

  return useQuery({
    queryKey: ["scriptByTaskKey", taskKey, type, setNumber, setId],
    queryFn: () => {
      const scriptData = scriptDataQuery.data;
      if (!scriptData) return null;

      if (type === "situational") {
        return scriptData.indexes.situationalByTaskKey[taskKey] || null;
      } else {
        return scriptData.indexes.formalByTaskKey[taskKey] || null;
      }
    },
    enabled: !!scriptDataQuery.data && !!taskKey,
    staleTime: 10 * 60 * 1000, // 10분간 캐시
  });
};

/**
 * 전체 스크립트 통계 조회
 */
export const useScriptStatsQuery = (setNumber: number, setId: number = 1) => {
  console.log("저기?-4");
  const scriptDataQuery = useScriptDataQuery(setNumber, setId);

  return useQuery({
    queryKey: ["scriptStats", setNumber, setId],
    queryFn: () => {
      const scriptData = scriptDataQuery.data;
      if (!scriptData) return null;

      return {
        totalSituational: scriptData.situationalScripts.length,
        totalFormal: scriptData.formalScripts.length,
        totalScripts:
          scriptData.situationalScripts.length +
          scriptData.formalScripts.length,
        setNumber: scriptData.setNumber,
        setId: scriptData.setId,
        loadedAt: scriptData.loadedAt,
        userId: scriptData.userId,
      };
    },
    enabled: !!scriptDataQuery.data,
    staleTime: 10 * 60 * 1000, // 10분간 캐시
  });
};
/**
 * 모든 타입의 로컬 저장된 스크립트 조회
 * @returns UseQueryResult<{ formal: FormalScript[];SituationalScript[] } | null, Error>
 */
export const useAllLocalScriptsQuery = (): UseQueryResult<
  {
    formal: FormalScript[];
    situational: SituationalScript[];
  } | null,
  Error
> => {
  return useQuery({
    queryKey: ["allLocalScripts"],
    queryFn: async (): Promise<{
      formal: FormalScript[];
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
 * 특정 서비스의 모든 상황발화 스크립트 조회
 */
export const useSituationalScriptsByServiceQuery = (
  serviceName: string,
  setNumber: number,
  setId: number = 1
) => {
  console.log("저기?-5");
  const scriptDataQuery = useScriptDataQuery(setNumber, setId);

  return useQuery({
    queryKey: ["situationalScriptsByService", serviceName, setNumber, setId],
    queryFn: (): SituationalScript[] => {
      const scriptData = scriptDataQuery.data;
      if (!scriptData) return [];

      // 전체 상황발화 스크립트에서 해당 서비스명으로 필터링
      return scriptData.situationalScripts.filter(
        (script) => script.service_name === serviceName
      );
    },
    enabled: !!scriptDataQuery.data && !!serviceName,
    staleTime: 10 * 60 * 1000, // 10분간 캐시
  });
};

/**
 * 특정 서비스의 모든 정형발화 스크립트 조회
 */
export const useFormalScriptsByServiceQuery = (
  serviceName: string,
  setNumber: number,
  setId: number = 1
) => {
  console.log("저기?-6");
  const scriptDataQuery = useScriptDataQuery(setNumber, setId);

  return useQuery({
    queryKey: ["formalScriptsByService", serviceName, setNumber, setId],
    queryFn: (): FormalScript[] => {
      const scriptData = scriptDataQuery.data;
      if (!scriptData) return [];

      // 전체 정형발화 스크립트에서 해당 서비스명으로 필터링
      return scriptData.formalScripts.filter(
        (script) => script.service_name === serviceName
      );
    },
    enabled: !!scriptDataQuery.data && !!serviceName,
    staleTime: 10 * 60 * 1000, // 10분간 캐시
  });
};

/**
 * 특정 서비스의 모든 스크립트 조회 (상황발화 + 정형발화)
 */
export const useAllScriptsByServiceQuery = (
  serviceName: string,
  setNumber: number,
  setId: number = 1
) => {
  console.log("저기?-7");
  const scriptDataQuery = useScriptDataQuery(setNumber, setId);

  return useQuery({
    queryKey: ["allScriptsByService", serviceName, setNumber, setId],
    queryFn: (): {
      situational: SituationalScript[];
      formal: FormalScript[];
    } => {
      const scriptData = scriptDataQuery.data;
      if (!scriptData) return { situational: [], formal: [] };

      return {
        situational: scriptData.situationalScripts.filter(
          (script) => script.service_name === serviceName
        ),
        formal: scriptData.formalScripts.filter(
          (script) => script.service_name === serviceName
        ),
      };
    },
    enabled: !!scriptDataQuery.data && !!serviceName,
    staleTime: 10 * 60 * 1000, // 10분간 캐시
  });
};
