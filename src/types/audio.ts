import { Timestamp, FieldValue } from "firebase/firestore";
// 현실적인 음성 학습 데이터 구조 - 텍스트 중심
// 오디오 포맷
export enum AudioFormat {
  WAV = "wav",
  MP3 = "mp3",
  M4A = "m4a",
  WEBM = "webm",
}

// 검증 상태 enum
export enum VerificationStatus {
  PENDING = "pending", // 검증 대기 중
  APPROVED = "approved", // 검증 통과
  REJECTED = "rejected", // 검증 반려
  NEEDS_RETRY = "needs_retry", // 재시도 필요
}

// 부적합 사유 enum
export enum RejectionReason {
  AUDIO_QUALITY_POOR = "audio_quality_poor", // 음질 불량
  INAUDIBLE_SPEECH = "inaudible_speech", // 들리지 않음
  OFF_TOPIC = "off_topic", // 주제 벗어남
  INCOMPLETE_RESPONSE = "incomplete_response", // 불완전한 응답
  INAPPROPRIATE_CONTENT = "inappropriate_content", // 부적절한 내용
  TECHNICAL_ISSUE = "technical_issue", // 기술적 문제
}

/**
 * 음성 녹음 데이터 - 검증 시스템 포함
 */
export interface AudioRecording {
  // === 기본 정보 ===
  id: string;
  userId: string;
  taskKey: string; // "건강-건강정보-1"
  taskType: "situational" | "formal";
  audioUrl: string;
  // 서버에서는 Timestamp, 클라이언트에서는 string으로 변환 가능
  fileName: string;
  verificationStatus: VerificationStatus;

  // === 녹음 세션 정보 ===
  recordingSession: {
    startedAt: string; // 녹음 시작 시각 (ISO string)
    endedAt: string; // 녹음 종료 시각 (ISO string)
    actualDuration: number; // 실제 녹음 길이 (초)
    sessionDuration: number; // 시작~종료까지 총 시간 (초)
  };

  uploadedAt: Timestamp | FieldValue; // 서버 업로드 시간 (serverTimestamp 타입)

  // === 텍스트 데이터 ===
  textData: {
    // 원본 vs 실제 발화 (즉시 확인 가능)
    originalScript: string; // 제시된 원본 스크립트
    sttTranscription: string; // STT로 변환된 텍스트
    manualTranscription?: string; // 수동 수정된 텍스트 (선택사항)

    // 스크립트 메타데이터 (이미 알고 있는 정보)
    domain: string; // service_name → domain ("건강", "교통" 등)
    intent: string; // task_name → intent ("건강정보입력(식사기록)" 등)
    category: string; // service_target → category ("건강정보", "고속버스" 등)
  };

  // === 화자 정보 ===
  speakerInfo: {
    gender: "남성" | "여성" | "불명";
    ageGroup: string; // "60-64세" 등
  };

  // === 검증 정보 ===
  verification?: {
    // 검증 기본 정보
    verifiedAt?: string; // 검증 완료 시간
    verifiedBy?: string; // 검증자 ID (자동인 경우 "system")
    verificationMethod: "auto" | "manual" | "hybrid"; // 검증 방식

    // 검증 결과
    isApproved: boolean; // 검증 통과 여부

    // 부적합 사유 (rejected인 경우)
    rejectionReasons?: RejectionReason[]; // 반려 사유들

    // 검증자 메모 및 추가 정보
    verifierNotes?: string; // 검증자 메모 ("음성이 너무 작음" 등)

    // 재시도 관련 정보
    retryCount?: number; // 몇 번째 재시도인가 (0부터 시작)
    needsHumanReview?: boolean; // 사람 검토 필요 여부
  };

  // === 품질 평가 (검증 및 분석용) ===
  qualityCheck: {
    // 파일 기본 정보
    duration: number; // 실제 녹음 길이 (초)
    fileSize: number; // 파일 크기 (bytes)
    audioFormat: AudioFormat; // 오디오 포맷
    // 기기 정보 (선택사항)
    deviceInfo?: string; // 녹음 기기 정보

    // 기본 품질 지표 (자동 검증용)
    volumeLevel: number; // 음량 레벨 (0-1, 너무 작으면 자동 reject)
    hasClipping: boolean; // 클리핑 발생 여부 (있으면 품질 경고)
    backgroundNoise: "low" | "medium" | "high"; // 배경 소음 수준 (높으면 reject)

    // STT 관련 품질 지표
    sttConfidence?: number; // STT 결과 신뢰도 (0-1, 낮으면 재검토)
    speechDetected?: boolean; // 실제 음성 감지 여부
  };
}

// audio mutation type
/**
 * 오디오 업로드 뮤테이션 요청 데이터 - FormData 전송용 평면 구조
 */
export interface AudioUploadMutationRequest {
  // === 기본 정보 ===
  userId: string;
  taskKey: string; // "건강-건강정보-1"
  taskType: "situational" | "formal";
  audioBlob: Blob; // 업로드할 오디오 파일

  // === 녹음 세션 정보 ===
  recordingStartedAt: string; // 녹음 시작 시각
  recordingEndedAt: string; // 녹음 종료 시각
  actualDuration: number; // 실제 녹음 길이 (초)
  sessionDuration: number; // 세션 총 시간 (초)

  // === 텍스트 데이터 (평면화) ===
  originalScript: string; // 제시된 원본 스크립트
  sttTranscription: string; // STT로 변환된 텍스트

  // 스크립트 메타데이터 (평면화)
  domain: string; // service_name → domain ("건강", "교통" 등)
  intent: string; // task_name → intent ("건강정보입력(식사기록)" 등)
  category: string; // service_target → category ("건강정보", "고속버스" 등)

  // === 화자 정보 (평면화) ===
  gender: "남성" | "여성" | "불명"; // 사용자 입력 그대로
  ageGroup: string; // "60-64세" 등

  // === 품질 평가 (즉시 측정 가능한 것만) ===
  audioFormat?: AudioFormat; // 오디오 포맷
  deviceInfo?: string; // 녹음 기기 정보 (navigator.userAgent)
}

/**
/**
 * 오디오 삭제 요청 데이터
 */
export interface AudioDeleteRequest {
  recordingId: string;
  userId: string;
}
