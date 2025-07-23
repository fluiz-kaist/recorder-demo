// utils/auth.ts - 인증 관련 공통 유틸리티
/**
 * 쿠키에서 값 읽기 (클라이언트 사이드)
 */
export const getCookie = (name: string): string | null => {
  if (typeof window === "undefined") return null;

  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) {
    return parts.pop()?.split(";").shift() || null;
  }
  return null;
};

/**
 * 한국 시간 생성 함수
 */
export const getKoreanTime = (): string => {
  const now = new Date();
  const koreanTime = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return koreanTime.toISOString();
};

/**
 * 로그아웃 유틸리티 (쿠키 기반)
 */
export const logout = async (): Promise<void> => {
  try {
    // 서버에서 쿠키 삭제
    await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "include",
    });
  } catch (error) {
    console.error("로그아웃 API 오류:", error);
  }

  // 로컬 스토리지 정리 (민감하지 않은 정보만 저장했지만 정리)
  localStorage.removeItem("userInfo");
  sessionStorage.clear();

  // 페이지 새로고침으로 상태 초기화
  if (typeof window !== "undefined") {
    window.location.href = "/";
  }
};
