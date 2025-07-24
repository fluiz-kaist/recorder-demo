// hooks/useScriptUtils.ts - 스크립트 관련 유틸리티 훅들

import { useMinimalUserQuery } from "@/hooks/queries/useUserQueries";
import { useScriptDataQuery } from "@/hooks/queries/useScriptQueries";
import { useInitializeScriptsMutation } from "@/hooks/mutations/useScriptMutations";
import { useQueryClient } from "@tanstack/react-query";
/**
 * 스크립트 로더 - 필요시 자동으로 스크립트를 로드
 * 이 훅은 스크립트 데이터의 존재 여부를 확인하고, 없으면 로딩을 트리거합니다.
 */
export const useScriptLoader = (setNumber: number, setId: number = 1) => {
  const { data: minimalUserInfo } = useMinimalUserQuery();

  // scriptDataQuery를 사용하여 현재 캐시된 스크립트 데이터 상태를 확인합니다.
  const {
    data: scriptData,
    isLoading: isScriptDataLoading,
    error: scriptDataError,
    isFetched: isScriptDataFetched,
    isSuccess: isScriptDataSuccess,
  } = useScriptDataQuery(setNumber, setId);

  const initializeScriptsMutation = useInitializeScriptsMutation();

  // 스크립트를 서버에서 로드하는 비동기 함수
  const loadScriptsFromServer = async () => {
    if (!minimalUserInfo?.id) {
      console.error("사용자 정보가 없어 스크립트를 로드할 수 없습니다.");
      throw new Error("사용자 정보가 없습니다.");
    }

    // 이미 스크립트 데이터가 캐시에 존재하고, 해당 setNumber와 setId에 맞으면 새로 로드하지 않습니다.
    if (
      scriptData &&
      scriptData.setNumber === setNumber &&
      scriptData.setId === setId
    ) {
      console.log("✅ 스크립트가 이미 로드되어 있습니다.");
      return scriptData;
    }

    console.log(
      `스크립트 로드 시작 (userId: ${minimalUserInfo.id}, setNumber: ${setNumber}, setId: ${setId})`
    );

    try {
      const result = await initializeScriptsMutation.mutateAsync({
        userId: minimalUserInfo.id,
        setNumber,
        setId,
      });
      console.log("✅ 스크립트 로드 완료 및 캐시 업데이트");
      return result;
    } catch (error) {
      console.error("스크립트 로드 실패:", error);
      throw error;
    }
  };

  const isSetLoaded =
    !!scriptData &&
    scriptData.setNumber === setNumber &&
    scriptData.setId === setId;

  return {
    loadScriptsFromServer,
    isSetLoaded,
    scriptData,
    // 로딩 상태를 더 명확하게 전달합니다.
    isLoading: initializeScriptsMutation.isPending || isScriptDataLoading,
    error: initializeScriptsMutation.error || scriptDataError,
    // 초기 로딩 후 데이터가 성공적으로 페치되었는지 확인하는 플래그
    isReady: isScriptDataSuccess && isSetLoaded,
  };
};

/**
 * 특정 서비스에 특화된 유틸리티 훅
 */
export const useServiceUtils = (
  serviceName: string,
  setNumber: number,
  setId: number = 1
) => {
  const scriptDataQuery = useScriptDataQuery(setNumber, setId);

  const getServiceTaskKeys = () => {
    return scriptDataQuery.data?.indexes.taskKeysByService[serviceName] || [];
  };

  const getServiceStats = () => {
    return scriptDataQuery.data?.indexes.serviceStats[serviceName] || null;
  };

  const getScriptByTaskKey = (
    taskKey: string,
    type: "situational" | "formal"
  ) => {
    const scriptData = scriptDataQuery.data;
    if (!scriptData) return null;

    if (type === "situational") {
      return scriptData.indexes.situationalByTaskKey[taskKey] || null;
    } else {
      return scriptData.indexes.formalByTaskKey[taskKey] || null;
    }
  };

  const isServiceAvailable = () => {
    return (
      !!scriptDataQuery.data &&
      !!scriptDataQuery.data.indexes.serviceStats[serviceName]
    );
  };

  return {
    getServiceTaskKeys,
    getServiceStats,
    getScriptByTaskKey,
    isServiceAvailable,
    isLoading: scriptDataQuery.isLoading,
    error: scriptDataQuery.error,
  };
};

/**
 * 스크립트 상태 체크 유틸리티
 */
export const useScriptStatus = (setNumber: number, setId: number = 1) => {
  const scriptDataQuery = useScriptDataQuery(setNumber, setId);

  const isScriptDataLoaded = () => {
    return !!scriptDataQuery.data;
  };

  const isCorrectSet = (targetSetNumber: number, targetSetId: number = 1) => {
    const data = scriptDataQuery.data;
    return data?.setNumber === targetSetNumber && data?.setId === targetSetId;
  };

  const getLoadedSetInfo = () => {
    const data = scriptDataQuery.data;
    if (!data) return null;

    return {
      setNumber: data.setNumber,
      setId: data.setId,
      loadedAt: data.loadedAt,
      userId: data.userId,
    };
  };

  const getTotalCounts = () => {
    const data = scriptDataQuery.data;
    if (!data) return null;

    return {
      situationalCount: data.situationalScripts.length,
      formalCount: data.formalScripts.length,
      totalCount: data.situationalScripts.length + data.formalScripts.length,
      serviceCount: Object.keys(data.indexes.serviceStats).length,
    };
  };

  return {
    isScriptDataLoaded,
    isCorrectSet,
    getLoadedSetInfo,
    getTotalCounts,
    isLoading: scriptDataQuery.isLoading,
    error: scriptDataQuery.error,
  };
};
