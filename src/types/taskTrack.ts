import { FieldValue, Timestamp } from "firebase/firestore";

/**
 * 작업 추적 문서 타입
 * Firebase 컬렉션: /taskTrackings/{userId}_{roundNumber}_{taskType}_{taskKey}
 *
 * 예시 문서 ID:
 * - user123_1_formal_건강-건강정보-1
 * - user123_1_situational_건강-건강정보-1
 */
export interface TaskTracking {
  // 식별 정보
  userId: string; // 사용자 ID
  roundNumber: number; // 참여 회차 번호
  taskKey: string; // 작업 키 (예: "건강-건강정보-1")
  taskType: "formal" | "situational"; // 작업 타입

  // 페이지 세션 정보
  pageEnteredAt: string | FieldValue | Timestamp; // 페이지 진입 시점
  pageExitedAt?: string | FieldValue | Timestamp; // 페이지 이탈 시점
  totalDuration?: number; // 총 페이지 머무른 시간 (초)

  // 이탈 방식
  exitMethod?:
    | "next_button"
    | "browser_close"
    | "navigation"
    | "timeout"
    | "unknown";

  // 사용자 정보 (통계용 비정규화)
  userProfile: {
    ageGroup: string; // 연령대
    gender: "남성" | "여성"; // 성별
  };

  // 디바이스 및 환경 정보
  deviceInfo: {
    userAgent: string; // 브라우저 정보
    screenResolution?: string; // 화면 해상도
    timezone: string; // 타임존
  };

  // 추가 메타데이터
  submittedAt: string | FieldValue | Timestamp; // 서버 제출 시점
  clientTimestamp: number; // 클라이언트 타임스탬프 (Date.now())
}

/**
 * 로컬스토리지에 저장할 추적 데이터 타입
 * 브라우저 메모리에서 관리하다가 최종 제출시 TaskTracking으로 변환
 */
export interface LocalTaskTrackingData {
  // 식별 정보
  userId: string;
  roundNumber: number;
  taskKey: string;
  taskType: "formal" | "situational";

  // 세션 정보
  pageEnteredAt: number; // Date.now() 타임스탬프
  pageExitedAt?: number; // Date.now() 타임스탬프

  // 사용자 프로필 (초기화시 설정)
  userProfile: {
    ageGroup: string;
    gender: "남성" | "여성";
  };

  // 디바이스 정보 (초기화시 설정)
  deviceInfo: {
    userAgent: string;
    screenResolution?: string;
    timezone: string;
  };

  // 상태 정보
  isSubmitted: boolean; // 서버 제출 완료 여부
  exitMethod?: string; // 이탈 방식
}

/**
 * 로컬스토리지 관리를 위한 키 생성 함수 타입
 */
export type TaskTrackingStorageKey =
  `taskTracking_${string}_${number}_${string}_${string}`;

/**
 * 일괄 제출을 위한 데이터 타입
 * 여러 TaskTracking을 한번에 제출할 때 사용
 */
export interface TaskTrackingBatchSubmission {
  userId: string;
  submissions: TaskTracking[];
  submittedAt: string; // 일괄 제출 시점
  totalCount: number; // 제출된 항목 수
}

/**
 * 통계 조회용 쿼리 필터 타입
 */
export interface TaskTrackingFilter {
  userId?: string;
  roundNumber?: number;
  taskType?: "formal" | "situational";
  ageGroup?: string;
  gender?: "남성" | "여성";
  dateRange?: {
    start: string | Timestamp;
    end: string | Timestamp;
  };
  durationRange?: {
    min: number; // 최소 소요 시간 (초)
    max: number; // 최대 소요 시간 (초)
  };
}

/**
 * 통계 집계 결과 타입
 */
export interface TaskTrackingStats {
  totalCount: number; // 총 작업 수
  averageDuration: number; // 평균 소요 시간 (초)
  medianDuration: number; // 중간값 소요 시간 (초)

  // 연령대별 통계
  byAgeGroup: {
    [ageGroup: string]: {
      count: number;
      averageDuration: number;
    };
  };

  // 성별 통계
  byGender: {
    남성: { count: number; averageDuration: number };
    여성: { count: number; averageDuration: number };
  };

  // 작업 타입별 통계
  byTaskType: {
    formal: { count: number; averageDuration: number };
    situational: { count: number; averageDuration: number };
  };

  // 이탈 방식별 통계
  byExitMethod: {
    [method: string]: { count: number; percentage: number };
  };
}

/**
 * 로컬스토리지 관리 유틸리티 인터페이스
 */
export interface TaskTrackingManager {
  // 추적 시작
  startTracking(
    userId: string,
    roundNumber: number,
    taskKey: string,
    taskType: "formal" | "situational",
    userProfile: { ageGroup: string; gender: "남성" | "여성" }
  ): void;

  // 추적 종료
  endTracking(exitMethod: string): void;

  // 현재 추적 데이터 가져오기
  getCurrentTracking(): LocalTaskTrackingData | null;

  // 미제출 데이터 가져오기
  getPendingSubmissions(): LocalTaskTrackingData[];

  // 서버에 제출
  submitToServer(trackingData: LocalTaskTrackingData): Promise<void>;

  // 일괄 제출
  submitAllPending(): Promise<TaskTrackingBatchSubmission>;

  // 제출 완료 표시
  markAsSubmitted(trackingKey: TaskTrackingStorageKey): void;

  // 로컬 데이터 정리
  cleanupSubmittedData(): void;
}

/**
 * 문서 ID 생성 헬퍼 함수 타입
 */
export type CreateTrackingDocId = (
  userId: string,
  roundNumber: number,
  taskType: "formal" | "situational",
  taskKey: string
) => string;

/**
 * 품질 판정시 추적 데이터 조회용 타입
 */
export interface TaskWithTrackingReference {
  // Task의 기본 정보
  taskKey: string;
  taskType: "formal" | "situational";
  status: string;

  // 추적 데이터 참조
  trackingDocId: string; // taskTrackings 문서 ID
  hasTrackingData: boolean; // 추적 데이터 존재 여부
  estimatedDuration?: number; // 예상 소요 시간 (초, 추적 데이터에서 계산)
}

/**
 * 유틸리티 상수들
 */
export const TASK_TRACKING_CONSTANTS = {
  // 로컬스토리지 키 접두사
  STORAGE_PREFIX: "taskTracking_",

  // 최소/최대 허용 시간 (초)
  MIN_VALID_DURATION: 10, // 10초 미만은 비정상
  MAX_VALID_DURATION: 3600, // 1시간 초과는 비정상

  // 자동 제출 트리거
  MAX_PENDING_COUNT: 10, // 미제출 데이터 10개 초과시 자동 제출

  // 데이터 보존 기간
  CLEANUP_AFTER_DAYS: 7, // 7일 후 로컬 데이터 정리
} as const;
