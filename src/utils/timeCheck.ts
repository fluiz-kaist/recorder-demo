// utils/timeCheck.ts
import { getEnv } from "@/utils/envConfig";
const { isDev, isPreview, isProduction } = getEnv();
export const isRecordingAvailable = (): boolean => {
  // timeCheck 기능이 명시적으로 비활성화된 경우 항상 true 반환
  if (process.env.NEXT_PUBLIC_ENABLE_TIME_CHECK === "false") {
    return true;
  }

  // 로컬에서 시간 제한 테스트를 원하는 경우
  if (
    (isDev || isPreview) &&
    process.env.NEXT_PUBLIC_TEST_TIME_RESTRICTION === "true"
  ) {
    return checkWorkingHours();
  }

  // 로컬 환경에서는 기본적으로 항상 true 반환
  if (isDev || isPreview) {
    return true;
  }

  // 운영 환경에서는 시간 체크
  return checkWorkingHours();
};

const checkWorkingHours = (): boolean => {
  const now = new Date();
  const currentDay = now.getDay(); // 0: 일요일, 1: 월요일, ..., 6: 토요일
  const currentHour = now.getHours();

  // 평일 체크 (월요일=1 ~ 금요일=5)
  const isWeekday = currentDay >= 1 && currentDay <= 5;

  // 오후 12시(12) ~ 오후 6시(18) 체크
  const isWorkingHours = currentHour >= 12 && currentHour < 18;

  return isWeekday && isWorkingHours;
};

export const getRecordingStatusMessage = (): string => {
  // 로컬 환경에서는 개발 모드 메시지 표시
  if (process.env.NODE_ENV === "development") {
    return "개발 모드: 언제든지 녹음 작업이 가능합니다.";
  }

  // timeCheck 기능이 명시적으로 비활성화된 경우
  if (process.env.NEXT_PUBLIC_ENABLE_TIME_CHECK === "false") {
    return "언제든지 녹음 작업이 가능합니다.";
  }

  // 운영 환경에서는 기본적으로 시간 기반 메시지 (기본값)
  return getProductionMessage();
};

const getProductionMessage = (): string => {
  const now = new Date();
  const currentDay = now.getDay();
  const currentHour = now.getHours();

  if (currentDay === 0 || currentDay === 6) {
    return "음성 녹음 작업은 평일에만 가능합니다.";
  }

  if (currentHour < 12) {
    return "음성 녹음 작업은 평일 오후 12시부터 6시 사이에 할 수 있습니다.";
  }

  if (currentHour >= 18) {
    return "음성 녹음 작업은 평일 오후 12시부터 6시 사이에 할 수 있습니다.";
  }

  return "음성 녹음 작업이 가능한 시간입니다.";
};

// 개발용 유틸리티 함수들
export const getDevelopmentInfo = () => {
  if (process.env.NODE_ENV !== "development") {
    return null;
  }

  const now = new Date();
  return {
    currentTime: now.toLocaleString("ko-KR"),
    currentDay: now.getDay(),
    currentHour: now.getHours(),
    isWeekday: now.getDay() >= 1 && now.getDay() <= 5,
    isWorkingHours: now.getHours() >= 12 && now.getHours() < 18,
    nodeEnv: process.env.NODE_ENV,
    timeCheckDisabled: process.env.NEXT_PUBLIC_ENABLE_TIME_CHECK === "false",
  };
};

// timeCheck 기능이 활성화되어 있는지 확인하는 헬퍼 함수
export const isTimeCheckEnabled = (): boolean => {
  // 로컬에서는 항상 false (UI에서 안내문구 숨김)
  if (process.env.NODE_ENV === "development") {
    return false;
  }

  // 명시적으로 비활성화된 경우만 false
  return process.env.NEXT_PUBLIC_ENABLE_TIME_CHECK !== "false";
};
