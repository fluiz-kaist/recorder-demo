// types/firebase.ts
///// upgrade ver

// 스크립트 종류 - Firebase 컬렉션명과 일치
export enum ScriptType {
  FORMAL = "formal", // 정식/공식 (이미지에서 보이는 것)
  QA_SCENARIO = "qaScenario", // 질의응답 시나리오
  SITUATIONAL = "situational", // 상황별 스크립트
}

// 스크립트 상태
export enum ScriptStatus {
  UNASSGINED = "Unassigned",
  ASSIGNED = "assigned", // 할당됨
  COMPLETED = "completed", // 완료됨
}

// 오디오 처리 상태
export enum AudioStatus {
  UPLOADING = "uploading", // 업로드 중
  PROCESSING = "processing", // 처리 중 (STT 등)
  COMPLETED = "completed", // 완료됨
  FAILED = "failed", // 실패
}

// 오디오 포맷
export enum AudioFormat {
  WAV = "wav",
  MP3 = "mp3",
  M4A = "m4a",
  WEBM = "webm",
}

export interface FormalScript {
  id: number;
  category: string;
  intent: string;
  title: string;
  formalSentence: string;
}

export interface QAScenarioScript {
  id: number;
  situation: string;
  description: string;
}

export interface SituationalScript {
  id: number;
  category: string;
  intent: string;
  title: string;
  description: string;
}

// 스크립트 원본 데이터 유니온 타입
export type ScriptData = FormalScript | QAScenarioScript | SituationalScript;

// 스크립트 단위 타입 (사용자 진행 상황 관리용)
export interface Script {
  id: string; // JSON 파일의 id (0, 1, 2...)
  type: ScriptType; // 스크립트 종류 (formal, qas, situ)
  assignedTo?: string; // 할당된 유저 ID
  assignedAt?: string; // 할당 시간 (ISO string, 한국 시간)
  status: ScriptStatus; // 완료 상태
  completedAt?: string; // 완료 시간 (ISO string, 한국 시간)
  recordingId?: string; // 녹음 기록 ID (audioRecordings 컬렉션 참조)
  // originalData?: ScriptData; // 원본 JSON 데이터 (옵셔널)
}

// 스크립트 복합 키 (타입 + ID로 전역 고유성 보장)
export type ScriptKey = `${ScriptType}_${number}`; // 예: "formal_0", "qas_1", "situ_2"

// ===== 오디오 관련 타입 =====

// 오디오 녹음 정보 (Firebase audioRecordings 컬렉션)
export interface AudioRecording {
  id: string; // 녹음 기록 고유 ID
  userId: string; // 녹음한 사용자 ID
  scriptId: number; // 스크립트 ID (0, 1, 2...)
  scriptType: ScriptType; // 스크립트 타입
  
  // 오디오 파일 정보
  audioUrl: string; // Firebase Storage URL
  fileName: string; // 저장된 파일명
  fileSize: number; // 파일 크기 (bytes)
  duration: number; // 녹음 시간 (초)
  audioFormat: AudioFormat; // 오디오 포맷
  
  // STT 및 분석 결과
  sttText: string; // Speech-to-Text 변환된 텍스트
  sttConfidence?: number; // STT 신뢰도 (0-1)
  
  // 시간 정보
  recordedAt: string; // 녹음 완료 시간 (ISO string)
  uploadedAt: string; // 업로드 완료 시간 (ISO string)
  processedAt?: string; // STT 처리 완료 시간 (ISO string)
  
  // 상태 정보
  status: AudioStatus; // 처리 상태
  
  // 메타데이터
  deviceInfo?: string; // 녹음 장치 정보
  browserInfo?: string; // 브라우저 정보
  quality?: 'high' | 'medium' | 'low'; // 음질 품질
}

// 오디오 업로드 요청 데이터
export interface AudioUploadRequest {
  userId: string;
  scriptId: number;
  scriptType: ScriptType;
  audioBlob: Blob;
  duration: number;
  audioFormat: AudioFormat;
  deviceInfo?: string;
  browserInfo?: string;
}

// 오디오 업로드 응답 데이터
export interface AudioUploadResponse {
  success: boolean;
  message?: string;
  recordingId: string;
  audioUrl: string;
  fileName: string;
  fileSize: number;
  sttText?: string; // STT 결과 (즉시 처리된 경우)
}

// STT 처리 결과
export interface STTResult {
  text: string;
  confidence: number;
  processedAt: string;
}

// 유저별 스크립트 할당 정보
// 주의: 각 스크립트 타입별로 독립적인 할당 정보를 관리함
// 예: formal의 0번과 qas의 0번은 서로 다른 스크립트임 (scriptType으로 구분)
export interface UserScriptAssignment {
  userId: string;
  scriptType: ScriptType;
  assignedScriptIds: number[]; // JSON 파일의 id 목록 [0, 1, 2]
  completedScriptIds: number[]; // 완료된 id 목록 [0, 2]
  assignedAt: string; // 할당 시간
}

// 유저 데이터 타입
export interface User {
  // 기본 식별 정보
  id: string;
  
  // 개인 정보 (온보딩에서 수집)
  gender: "남성" | "여성";
  ageGroup: string;
  hasConsented: boolean;
  
  // 시간 정보
  createdAt: string; // 계정 생성 시간
  completedAt?: string; // 온보딩 완료 시간
  lastAccessAt: string; // 최종 접속 시간
  
  // 스크립트 관련
  scriptAssignments: UserScriptAssignment[];
}

// 통계를 위한 타입
export interface ScriptUsage {
  [scriptId: number]: boolean; // "0": true, "1": false 형태
}

interface ScriptTypeStats {
  total: number; // 전체 스크립트 개수
  available: number; // 사용 가능한 개수 (status: "Unassigned")
  used: number; // 사용된 개수 (status: "assigned" or "completed")
}

export interface ScriptStats {
  formal: ScriptTypeStats;
  qaScenario: ScriptTypeStats;
  situational: ScriptTypeStats;
}

// 오디오 통계 타입
export interface AudioStats {
  totalRecordings: number; // 전체 녹음 개수
  totalDuration: number; // 전체 녹음 시간 (초)
  averageDuration: number; // 평균 녹음 시간 (초)
  totalFileSize: number; // 전체 파일 크기 (bytes)
  statusBreakdown: {
    [key in AudioStatus]: number; // 상태별 개수
  };
  formatBreakdown: {
    [key in AudioFormat]: number; // 포맷별 개수
  };
}

// 녹음 완료 후 관련 (스크립트 완료 처리용)
export interface CompleteScriptRequest {
  userId: string; // 사용자 ID
  scriptId: string; // 스크립트 ID (0, 1, 2...)
  scriptType: ScriptType; // "formal" | "qaScenario" | "situational"
  recordingId: string; // 오디오 녹음 기록 ID
  audioUrl: string; // 녹음된 오디오 파일 URL
  sttText: string; // Speech-to-Text 변환된 텍스트
}

// 스크립트 정보 (저장을 위해)
export interface ScriptInfo {
  scriptId: string;
  category: string;
  intent: string;
  title: string;
  description: string;
  type: string;
}

// 사용자 등록 요청
export interface RegisterUserRequest {
  userId: string;
  gender: "남성" | "여성";
  ageGroup: string;
  hasConsented: boolean;
}