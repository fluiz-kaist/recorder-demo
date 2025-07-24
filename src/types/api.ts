import { ScriptType, AudioFormat, User } from "@/types/firebase";

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

// complete-submission

// 요청 데이터 타입 정의
export interface CompleteSubmissionRequest {
  userId: string;
  scriptId: string;
  scriptType: string;
  audioUrl: string;
  filePath: string;
  sttText: string;

  // 🆕 사용자 정보 추가 (비정규화용)
  userGender: "남성" | "여성";
  userAgeGroup: string;
  userAuthorizedId: string;

  audioMetadata: {
    documentId: string;
    fileName: string;
    duration: number;
    uploadedAt: string;
    fileSize: number;
    scriptInfo?: any;
    fileCategory?: string;
    category: string;
    searchKey: string;
  };
}

// 응답 데이터 타입 정의
export interface CompleteSubmissionResponse {
  success: boolean;
  message?: string;
  error?: string;
}

/**
 * 사용자 등록 요청 데이터 타입(동의 후 )
 */
export interface RegisterUserRequest {
  userId: string;
  gender: "남성" | "여성";
  ageGroup: string;
  hasConsented: boolean;
  userName: string;
  authorizedUserId: string;
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
