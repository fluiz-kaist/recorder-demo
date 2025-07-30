// utils/localStorage.ts - 사용자 기본 정보만 관리

const USER_STORAGE_KEY = "userInfo";

/**
 * 로컬 사용자 데이터 삭제
 */
export const clearUserFromLocal = (): void => {
  if (typeof window === "undefined") return;

  try {
    localStorage.removeItem(USER_STORAGE_KEY);
    console.log("로컬 사용자 정보 삭제 완료");
  } catch (error) {
    console.error("로컬 사용자 정보 삭제 실패:", error);
  }
};

/**
 * 모든 로컬 데이터 정리
 * 사용자 정보 + ScriptDataManager의 데이터까지 함께 정리
 */
export const clearAllLocalData = (): void => {
  if (typeof window === "undefined") return;

  try {
    // 사용자 정보 삭제
    localStorage.removeItem(USER_STORAGE_KEY);

    // ScriptDataManager의 스크립트 데이터도 삭제
    localStorage.removeItem("voice-recording-scripts");

    // 세션 스토리지도 정리
    sessionStorage.clear();

    console.log("모든 로컬 데이터 정리 완료");
  } catch (error) {
    console.error("로컬 데이터 정리 실패:", error);
  }
};

// 레거시 호환용 별칭들
export const clearLocalUserData = clearAllLocalData;
