import { FieldValue, Timestamp } from "firebase/firestore";
// import { ScriptType, TaskType } from "./firebase"; // 기존 firebase.ts에서 필요한 타입들 import
//화이트리스트 타입
export interface AuthorizedUserData {
  userHash: string;
  createdAt: string;
  isActive: boolean;
  name: string;
  userId?: string;
  lastLogin?: string;
  loginAttempts?: number;
  source?: string;
}

/**
 * 개별 녹음 작업의 상태를 나타내는 열거형
 * 하나의 Task = 스크립트 하나를 읽고 녹음하는 단위
 * (예: "건강-건강정보-1" 정형발화 녹음)
 * 각 Task는 독립적으로 상태가 관리되며, 다음과 같은 생명주기를 가짐
 */
export enum TaskStatus {
  NOT_STARTED = "not_started", // 아직 할당되지 않음
  ASSIGNED = "assigned", // 사용자에게 할당됨 (녹음 가능한 상태)
  RECORDING = "recording", // 사용자가 현재 녹음 중
  COMPLETED = "completed", // 녹음 및 파일 업로드 완료
  SUBMITTED = "submitted", // 품질 검토를 위해 제출됨
  APPROVED = "approved", // 품질 검토 통과하여 최종 승인됨
  REJECTED = "rejected", // 품질 미달로 반려됨 (재녹음 필요)
}

/**
 * 회차 상태를 나타내는 열거형
 * 참여 회차의 전체적인 진행 상태를 관리
 */
export enum RoundStatus {
  ASSIGNED = "assigned", // 회차 할당됨
  IN_PROGRESS = "in_progress", // 진행 중
  COMPLETED = "completed", // 모든 작업 완료
  SUBMITTED = "submitted", // 전체 제출 완료
  APPROVED = "approved", // 최종 승인됨
  REJECTED = "rejected", // 반려됨
}

/**
 * 진행 방식을 나타내는 열거형
 * 사용자가 작업을 수행하는 순서를 정의
 */
export enum ProgressMode {
  MIXED = "mixed", // 상황발화 -> 정형발화 -> 상황발화 -> 정형발화 순으로 번갈아가며
  SEPARATED = "separated", // 상황발화 전체 완료 후 정형발화 전체 수행
}

/**
 * 사용자 기본 프로필 정보
 * 계정 생성 시 설정되며 변경 빈도가 낮은 정보들
 * /users/{userId} 문서의 profile 섹션에 저장
 */
export interface UserProfile {
  // id?: string; // 사용자 고유 식별자 (Firebase Auth UID)
  userId: string; // 동의 후 user doc생성시 client에서 부여하는 id
  authorizedUserId: string; // 선동록한 정보 collection key용 (관리자 시스템 연동)
  userName: string; // 사용자 표시명
  gender: "남성" | "여성"; // 성별 (음성 분석용)
  ageGroup: string; // 연령대 (예: "55-59세", 음성 데이터 분석용)
  hasConsented: boolean; // 개인정보 수집 및 이용 동의 여부
  consentedAt?: Timestamp | FieldValue | string; // 동의한 시점
  createdAt: Timestamp | FieldValue | string; // 계정 생성 시간
  lastAccessAt: Timestamp | FieldValue | string; // 최종 접속 시간, 활동성 추적용
}

/**
 * 녹음 품질 정보
 * 각 작업의 녹음 파일에 대한 기술적 품질 지표
 */
export interface RecordingQuality {
  duration: number; // 녹음 길이 (초 단위)
  volumeLevel: number; // 평균 음량 레벨 (0.0 ~ 1.0)
  silenceRatio: number; // 무음 구간 비율 (0.0 ~ 1.0, 낮을수록 좋음)
  isValidRecording: boolean; // 기본 품질 기준 통과 여부 (자동 검증 결과)

  // 추적 데이터 기반 검증
  taskDurationSeconds?: number; // 실제 작업 소요 시간
  isSuspiciouslyFast?: boolean; // 비정상적으로 빠른 완료 여부
}

/**
 * 개별 녹음 작업 정보
 * 하나의 Task = 특정 스크립트에 대한 하나의 녹음 작업
 * 예: "건강-건강정보-1" 정형발화 녹음, "교통-택시-1" 상황발화 녹음 등
 * 각 Task는 독립적으로 진행 상태가 관리됨
 * /users/{userId}/rounds/{roundNumber} 문서에 저장
 */
export interface Task {
  taskKey: string; // 작업 고유 키 (예: "건강-건강정보-1", 스크립트 매핑용)
  taskType: "formal" | "situational"; // 작업 유형 (정형발화 또는 상황발화)
  status: TaskStatus; // 현재 작업 상태

  // 시간 추적 정보 (작업 생명주기 관리)
  assignedAt: Timestamp | FieldValue | string; // 작업 할당 시점

  startedAt?: Timestamp | FieldValue | string; // 녹음 시작 시점 (사용자가 녹음 버튼을 누른 시점)
  completedAt?: Timestamp | FieldValue | string; // 녹음 완료 시점
  submittedAt?: Timestamp | FieldValue | string; // 제출 시점 (검토 요청)
  approvedAt?: Timestamp | FieldValue | string; // 승인 시점 (최종 완료)
  rejectedAt?: Timestamp | FieldValue | string; // 반려 시점

  // 녹음 파일 정보
  recordingId?: string; // 녹음 파일 고유 ID (스토리지 참조용)
  audioRecordId?: string; // 오디오 레코드 ID (메타데이터 참조용)
  quality?: RecordingQuality; // 녹음 품질 정보 (완료 후 자동 분석)

  // 재작업 관리
  rejectionReason?: string; // 반려 사유 (관리자 또는 자동 검증 결과)
  retryCount?: number; // 재시도 횟수 (무한 재시도 방지용)

  // 추적 데이터 참조 (옵션)
  trackingDocId?: string; // taskTrackings 문서 ID 참조
  hasTrackingData?: boolean; // 추적 데이터 존재 여부
  estimatedDuration?: number; // 추적된 실제 소요 시간 (초)
}

/**
 * 회차별 진행률 정보
 * 참여 회차의 전체적인 진행 상황을 추적하고 통계를 제공
 */
export interface RoundProgress {
  totalTasks: number; // 해당 회차의 전체 작업 수 (상황발화 26개 + 정형발화 수)
  completedTasks: number; // 녹음 완료된 작업 수
  submittedTasks: number; // 제출된 작업 수 (검토 요청)
  approvedTasks: number; // 최종 승인된 작업 수

  // 작업 타입별 상세 진행률 (대시보드 및 분석용)
  byTaskType: {
    formal: {
      total: number; // 정형발화 총 작업 수
      completed: number; // 정형발화 완료 수
      submitted: number; // 정형발화 제출 수
      approved: number; // 정형발화 승인 수
    };
    situational: {
      total: number; // 상황발화 총 작업 수 (항상 26개)
      completed: number; // 상황발화 완료 수
      submitted: number; // 상황발화 제출 수
      approved: number; // 상황발화 승인 수
    };
  };

  // 현재 진행 위치 (mixed mode에서 다음 작업 결정용)
  currentTaskIndex?: number; // 전체 작업 목록에서의 현재 인덱스 (0부터 시작)
  currentTaskType?: "formal" | "situational"; // 현재 진행 중인 작업 타입
}

/**
 * 참여 회차 정보 (서브컬렉션 문서)
 * 사용자가 참여하는 각 회차별 작업 묶음을 관리
 * 한 회차 = [상황발화 a + 특정 정형발화 세트]로 구성
 * 예: 1회차 = [상황발화 a + 1세트 정형발화], 2회차 = [상황발화 a + 2세트 정형발화]
 *
 * Firebase 경로: /users/{userId}/rounds/{roundNumber}
 * 문서 ID: roundNumber (1, 2, 3...)
 */
export interface ParticipationRound {
  // 회차 기본 정보
  userId: string; // 참여 사용자 ID (부모 문서 참조용)
  roundNumber: number; // 참여 회차 번호 (1회차, 2회차, 3회차... 사용자별 순차 증가)
  formalSetId: number; // 정형발화 세트 ID (1, 2 - 스크립트 데이터의 set-id와 매핑)
  progressMode: ProgressMode; // 이 회차의 진행 방식 (사용자가 선택 가능)
  status: RoundStatus; // 회차 전체 상태

  // 회차 생명주기 시간 추적
  assignedAt: Timestamp | FieldValue | string; // 회차 할당 시점 (관리자가 회차를 배정한 시점)
  startedAt?: Timestamp | FieldValue | string; // 첫 번째 작업 시작 시점
  completedAt?: Timestamp | FieldValue | string; // 모든 녹음 완료 시점
  submittedAt?: Timestamp | FieldValue | string; // 전체 제출 완료 시점 (모든 작업 제출)
  approvedAt?: Timestamp | FieldValue | string; // 최종 승인 시점 (회차 전체 승인)

  // 작업 목록 (이 회차에 포함된 모든 작업들)
  tasks: {
    formal: Task[]; // 정형발화 작업 목록 (세트별로 개수 다름)
    situational: Task[]; // 상황발화 작업 목록 (항상 26개 고정)
  };

  // 진행률 정보 (실시간 계산 또는 캐시된 값)
  progress: RoundProgress;

  // 관리자 검토 정보
  adminNotes?: string; // 관리자 메모
  qualityScore?: number; // 전체 품질 점수 (0-100)
}

/**
 * 참여 회차 요약 정보
 * 사용자 메인 문서에 저장되는 각 회차의 요약 정보
 * 전체 목록 조회 시 서브컬렉션을 읽지 않고도 기본 정보 확인 가능
 */
export interface RoundSummary {
  roundNumber: number; // 회차 번호
  formalSetId: number; // 정형발화 세트 ID
  status: RoundStatus; // 회차 상태
  assignedAt: Timestamp | FieldValue | string; // 할당 시점
  completedAt?: Timestamp | FieldValue | string; // 완료 시점
  approvedAt?: Timestamp | FieldValue | string; // 승인 시점

  // 간단한 진행률 (캐시)
  progressSummary: {
    totalTasks: number;
    approvedTasks: number;
    approvalRate: number; // 승인율 (0-100)
  };
}

/**
 * 사용자 전체 통계 정보
 * 모든 참여 회차를 통합한 누적 통계 및 성과 지표
 */
export interface UserStatistics {
  // === 현재 회차 통계 (complete.ts에서 실시간 업데이트) ===
  current: {
    roundNumber: number; // 현재 진행 중인 회차 번호
    totalTasks: number; // 현재 회차의 전체 작업 수 (상황발화 + 정형발화)
    completedTasks: number; // 현재 회차에서 완료된 작업 수
    submittedTasks: number; // 현재 회차에서 제출된 작업 수
    approvedTasks: number; // 현재 회차에서 승인된 작업 수
    recordingTime: number; // 현재 회차의 총 녹음 시간 (초 단위)
    completedPercentage: number; // 현재 회차 완료율 (0-100)
    approvedPercentage: number; // 현재 회차 승인율 (0-100)
    lastUpdatedAt: Timestamp | FieldValue | string; // 현재 회차 통계 최종 업데이트 시점
  };

  // === 전체 누적 통계 (별도 배치 작업으로 계산, complete.ts에서는 건드리지 않음) ===
  overall?: {
    totalParticipationRounds: number; // 총 참여 회차 수 (완료된 회차만 카운트)
    totalTasksCompleted: number; // 모든 회차를 통틀어 완료된 총 작업 수
    totalTasksApproved: number; // 모든 회차를 통틀어 승인된 총 작업 수
    totalRecordingTime: number; // 총 녹음 시간 (초 단위, 모든 녹음 파일 합계)
    averageQualityScore: number; // 평균 품질 점수 (0-100, 모든 승인된 녹음의 품질 점수 평균)
    overallApprovalRate: number; // 전체 승인율 (0-100, 승인된 작업 / 제출된 작업 * 100)

    firstParticipationAt?: Timestamp | FieldValue | string; // 첫 참여 시점 (첫 번째 녹음 완료 시점)
    lastParticipationAt?: Timestamp | FieldValue | string; // 마지막 참여 시점 (가장 최근 녹음 완료 시점)

    // 행동 패턴 통계 (모든 회차의 작업 패턴 분석)
    averageTaskDuration?: number; // 평균 작업 소요 시간 (초)
    taskCompletionPattern?: {
      quickCompletions: number; // 빠른 완료 횟수 (5분 미만)
      normalCompletions: number; // 정상 완료 횟수 (5-30분)
      slowCompletions: number; // 느린 완료 횟수 (30분 이상)
    };
  };
}
/**
 * 현재 사용자 상태 정보
 * 자주 조회되는 상태 정보를 캐시하여 빠른 접근을 제공
 * UI에서 사용자의 현재 상황을 즉시 파악할 수 있도록 함
 */
export interface CurrentUserStatus {
  // 온보딩 및 기본 상태
  isOnboardingCompleted: boolean; // 초기 온보딩 프로세스 완료 여부
  isTutorialCompleted: boolean; // 튜토리얼 완료 여부 (첫 녹음 전 필수)

  // 참여 상태차 완료
  currentRoundNumber: number; // 현재 진행 중인 회차 번호 (0이면 아직 회차 할당 안됨)
  canStartRecording: boolean; // 현재 녹음 시작 가능 여부 (권한, 상태 등 종합 판단)
  canStartNextRound: boolean; // 다음 회차 시작 가능 여부 (현재 회 후)
  hasPendingApproval: boolean; // 승인 대기 중인 작업이 있는지 여부

  // 현재 회차 진행률 (빠른 UI 업데이트를 위한 캐시)
  currentRoundProgress: {
    completedPercentage: number; // 완료율 (0-100, UI 프로그레스 바용)
    submittedPercentage: number; // 제출율 (0-100, 검토 진행률)
    approvedPercentage: number; // 승인율 (0-100, 최종 완료율)
  };

  // 다음 작업 정보 (사용자가 다음에 할 일을 즉시 알 수 있도록)
  nextTask?: {
    taskKey: string; // 다음 작업의 키
    taskType: "formal" | "situational"; // 작업 타입
    taskIndex: number; // 전체 작업 목록에서의 위치
  } | null; // null이면 더 이상 할 작업 없음
}

/**
 * 사용자 설정 정보
 * 사용자가 커스터마이징할 수 있는 설정들
 * 녹음 및 진행 방식에 대한 개인 선호도 반영
 */
export interface UserSettings {
  // 녹음 관련 설정
  autoSubmitAfterRecording: boolean; // 녹음 완료 후 자동으로 제출할지 여부
  allowAutoApproval: boolean; // 품질 기준 통과 시 자동 승인 허용 여부
  requireManualReview: boolean; // 모든 녹음에 대해 수동 검토 필수 여부

  // 진행 방식 설정
  preferredProgressMode: ProgressMode; // 선호하는 작업 진행 방식
  maxAllowedRounds: number; // 이 사용자가 참여할 수 있는 최대 회차 수 (관리자 설정)
}

/**
 * 메인 User 인터페이스
 * Firebase Firestore에 저장되는 사용자 문서의 구조
 *
 * Firebase 경로: /users/{userId}
 *
 * 설계 원칙:
 * - 기본 정보와 요약 정보만 메인 문서에 저장
 * - 상세한 작업 정보는 서브컬렉션(/users/{userId}/rounds/{roundNumber})에 분리
 * - 자주 조회되는 정보는 currentStatus에 캐시
 * - 관리자 대시보드에서 빠른 조회 가능하도록 최적화
 */
export interface User {
  // 기본 프로필 정보 (변경 빈도 낮음)
  profile: UserProfile;

  // 사용자 설정 정보 (사용자가 변경 가능)
  settings: UserSettings;

  // 현재 상태 정보 (자주 업데이트되는 캐시 데이터)
  currentStatus: CurrentUserStatus;

  // 참여 회차 요약 목록 (서브컬렉션 대신 빠른 조회용)
  roundSummaries: RoundSummary[];

  // 전체 통계 정보 (모든 활동을 종합한 성과 지표)
  statistics: UserStatistics;

  // Firebase 메타데이터
  // userDoc 정렬용
  updatedAt: Timestamp | FieldValue | string; // 문서 최종 수정 시간 (Firebase 자동 관리)

  // 레거시 호환용 필드들 (기존 코드와의 호환성을 위해 유지, 점진적 제거 예정)
  completedAt?: Timestamp | FieldValue | string; // 온보딩 완료 시간 (구버전 호환용)
  recordingStatus?: {
    isTutorialCompleted: boolean;
    isAllRecordingCompleted: boolean;
    allRecordingCompletedAt?: Timestamp | FieldValue | string;
    progress: {
      totalAssigned: number;
      tutorialCompleted: number;
      mainSituationalCompleted: number;
      mainFormalCompleted: number;
      lastRecordedAt?: Timestamp | FieldValue | string;
    };
  };
}

/**
 * 작업 상세 로그 정보
 * 사용자의 각 작업에 대한 상세한 행동 패턴 추적
 * Task 인터페이스에 추가로 저장되는 정보
 */
export interface TaskActivityLog {
  // 스크립트 진입 및 이탈 추적
  scriptEnteredAt?: Timestamp | FieldValue | string; // 스크립트 화면 진입 시점
  scriptExitedAt?: Timestamp | FieldValue | string; // 스크립트 화면 이탈 시점
  scriptViewDuration?: number; // 스크립트 조회 시간 (초)

  // 녹음 세션 추적
  recordingSessions: RecordingSession[]; // 녹음 시도 세션들

  // 사용자 행동 패턴
  retryAttempts?: number; // 재시도 횟수 (녹음 버튼 클릭 횟수)
  hesitationTime?: number; // 스크립트 확인 후 녹음 시작까지의 시간 (초)
}

/**
 * 개별 녹음 세션 정보
 * 사용자가 녹음 버튼을 누를 때마다 생성되는 세션
 */
export interface RecordingSession {
  sessionId: string; // 세션 고유 ID (클라이언트에서 생성)
  startedAt: Timestamp | FieldValue | string; // 녹음 시작 시점
  endedAt?: Timestamp | FieldValue | string; // 녹음 종료 시점
  duration?: number; // 실제 녹음 시간 (초)

  // 녹음 결과
  wasSuccessful: boolean; // 성공적으로 완료되었는지
  cancelReason?: "user_cancel" | "technical_error" | "quality_issue"; // 취소/실패 사유

  // 기술적 정보
  audioFormat?: string; // 오디오 포맷
  fileSize?: number; // 파일 크기 (bytes)
  deviceInfo?: {
    userAgent: string;
    microphone?: string; // 마이크 정보 (가능한 경우)
  };
}

/**
 * 브라우저 메모리에서 추적할 임시 데이터
 * 사용자 세션 동안 메모리에 보관되다가 작업 완료 시 서버로 전송
 */
export interface TaskTrackingData {
  taskKey: string; // 추적 중인 작업 키
  userId: string; // 사용자 ID
  roundNumber: number; // 회차 번호

  // 스크립트 진입 정보
  scriptEnteredAt: number; // Date.now() 타임스탬프
  scriptExitedAt?: number; // 스크립트 이탈 시점

  // 현재 녹음 세션 (진행 중인 세션)
  currentRecordingSession?: {
    sessionId: string;
    startedAt: number; // Date.now() 타임스탬프
    recordingStartTime?: number; // 실제 녹음 시작 시점
  };

  // 완료된 녹음 세션들
  completedSessions: Array<{
    sessionId: string;
    startedAt: number;
    endedAt: number;
    duration: number;
    wasSuccessful: boolean;
    cancelReason?: string;
    audioFormat?: string;
    fileSize?: number;
  }>;

  // 기타 추적 정보
  retryCount: number; // 재시도 횟수
  totalTimeSpent: number; // 총 소요 시간 (초)
}

/**
 * 클라이언트에서 서버로 전송할 활동 로그 데이터
 * TaskTrackingData를 Firebase 형식으로 변환한 데이터
 */
export interface TaskActivitySubmission {
  taskKey: string;
  userId: string;
  roundNumber: number;

  // 변환된 활동 로그
  activityLog: TaskActivityLog;

  // 메타데이터
  submittedAt: string; // ISO 8601 형식
  clientTimezone: string; // 클라이언트 타임존
  sessionDuration: number; // 전체 세션 시간 (초)
}

/**
 * Task 인터페이스 확장
 * 기존 Task에 활동 로그 추가
 */
export interface TaskWithActivity extends Task {
  // 사용자 활동 상세 로그 (옵션)
  activityLog?: TaskActivityLog;
}

/**
 * 브라우저 메모리 관리를 위한 유틸리티 클래스 인터페이스
 */
export interface TaskTracker {
  // 스크립트 진입 추적
  startTracking(taskKey: string, userId: string, roundNumber: number): void;

  // 녹음 세션 시작
  startRecordingSession(): string; // sessionId 반환

  // 녹음 세션 종료
  endRecordingSession(
    sessionId: string,
    wasSuccessful: boolean,
    cancelReason?: string
  ): void;

  // 스크립트 이탈 추적
  stopTracking(): TaskActivitySubmission | null;

  // 현재 추적 데이터 가져오기
  getCurrentTrackingData(): TaskTrackingData | null;

  // 추적 데이터 초기화
  clearTracking(): void;
}
