// old!

import { FieldValue, Timestamp } from "firebase/firestore";
export enum ScriptType {
  FORMAL = "formal", // 정식/공식 (이미지에서 보이는 것)
  SITUATIONAL = "situational", // 상황별 스크립트
  TUTORIAL = "tutorial",
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

export interface TutorialScript {
  id: number;
  category: string;
  type: string;
  title: string;
  description: string;
  explain: string;
}

// export interface FormalScript {
//   id: number;
//   category: string;
//   intent: string;
//   title: string;
//   formalSentence: string;
// }

// export interface SituationalScript {
//   id: number;
//   category: string;
//   intent: string;
//   title: string;
//   description: string;
// }

// 스크립트 단위 타입 (사용자 진행 상황 관리용)
export interface Script {
  id: number; // JSON 파일의 id (0, 1, 2...)
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

// 통계를 위한 타입
export interface ScriptUsage {
  [scriptId: number]: boolean; // "0": true, "1": false 형태
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

// // 유저 데이터 타입
// export interface User {
//   // 기본 식별 정보
//   id: string;
//   //선동록한 정보 collection key용
//   authorizedUserId: string;
//   userName?: string;

//   // 개인 정보 (온보딩에서 수집)
//   gender: "남성" | "여성";
//   ageGroup: string;
//   hasConsented: boolean;

//   // 시간 정보
//   createdAt: string; // 계정 생성 시간
//   completedAt?: string; // 온보딩 완료 시간
//   lastAccessAt: string; // 최종 접속 시간
//   // 🆕 녹음 작업 관련 진행 상태
//   recordingStatus: {
//     isTutorialCompleted: boolean; // 튜토리얼 완료 여부
//     isAllRecordingCompleted: boolean; // 전체 녹음 작업 완료 여부
//     allRecordingCompletedAt?: string; // 전체 녹음 완료 시점

//     // 진행 상황 요약 (쿼리 최적화용)
//     progress: {
//       totalAssigned: number; // 할당된 총 스크립트 수
//       tutorialCompleted: number; // 완료된 튜토리얼 수
//       mainSituationalCompleted: number; // 완료된 본 작업(상황)수
//       mainFormalCompeted: number; //완료된 본 작업(정형) 수
//       lastRecordedAt?: string; // 마지막 녹음 시점
//     };
//   };


//   // 기존 API 호환용 필드들
//   completedScripts?: {
//     [scriptType: string]: string[];
//   };
//   totalCompleted?: number;
// }

// types/firebase.ts - 실제 요구사항 반영

// 개별 녹음 작업 타입
export interface RecordingTask {
  taskKey: string; // "건강-건강정보-1"
  taskType: "situational" | "formal";
  setId?: number; // 정형발화만 세트 ID 보유
  recordingId?: string; // 실제 녹음 파일 ID
  audioRecordId?: string;

  // 녹음 상태
  status:
    | "not_started"
    | "recording"
    | "completed"
    | "submitted"
    | "approved"
    | "rejected";

  // 시간 정보
  assignedAt: string;
  startedAt?: string;
  completedAt?: string;
  submittedAt?: string;

  // 녹음 품질 정보
  quality?: {
    duration: number; // 초 단위
    volumeLevel: number; // 평균 음량
    silenceRatio: number; // 무음 비율
    isValidRecording: boolean; // 기본 품질 체크 통과 여부
  };

  // 승인/반려 정보
  approval?: {
    status: "pending" | "approved" | "rejected";
    checkedBy?: "auto" | string; // "auto" 또는 관리자 ID
    checkedAt?: string;
    reason?: string; // 반려 시 사유
    autoCheckResults?: {
      durationOk: boolean;
      volumeOk: boolean;
      silenceOk: boolean;
    };
  };
}

// 진행 방식 타입
export type ProgressMode = "mixed" | "separated";
// mixed: 상황발화 → 정형발화 → 상황발화 → 정형발화...
// separated: 상황발화 전체 → 정형발화 전체

// 참가 세트 정보
export interface ParticipationSet {
  setNumber: number; // 1, 2, 3...
  setId: number; // 정형발화 세트 ID (1, 2)

  // 진행 설정
  progressMode: ProgressMode;

  // 할당된 작업들
  tasks: {
    situational: RecordingTask[]; // 26개 고정
    formal: RecordingTask[]; // 세트별로 다름
  };

  // 진행 상태
  progress: {
    totalTasks: number; // 상황발화 26 + 정형발화 수
    completedTasks: number;
    submittedTasks: number;
    approvedTasks: number;

    // 타입별 진행상황
    situational: {
      total: number;
      completed: number;
      submitted: number;
      approved: number;
    };
    formal: {
      total: number;
      completed: number;
      submitted: number;
      approved: number;
    };

    // 현재 진행 지점 (mixed mode용)
    currentTaskIndex?: number;
    currentTaskType?: "situational" | "formal";
  };

  // 세트 상태
  status:
    | "assigned"
    | "in_progress"
    | "completed"
    | "submitted"
    | "approved"
    | "rejected";
  assignedAt: string;
  startedAt?: string;
  completedAt?: string; // 모든 녹음 완료
  submittedAt?: string; // 제출 완료
  approvedAt?: string; // 승인 완료

  // 최종 승인 정보
  finalApproval?: {
    status: "pending" | "approved" | "rejected";
    checkedBy?: string; // 관리자 ID
    checkedAt?: string;
    notes?: string;

    // 자동 체크 결과
    autoCheckSummary?: {
      totalTasks: number;
      autoApprovedTasks: number;
      manualReviewRequired: number;
      overallQualityScore: number; // 0-100
    };
  };
}

// 메인 User 타입
export interface User {
  // 기본 정보
  id: string;
  authorizedUserId: string;
  userName: string;
  gender: "남성" | "여성";
  ageGroup: string;
  hasConsented: boolean;

  // 시간 정보
  createdAt: string;
  completedAt?: string | FieldValue | Timestamp; // 온보딩 완료
  lastAccessAt: string;

  // 🎯 참가 관리
  participation: {
    // 현재 상태
    currentSetNumber: number; // 현재 진행 중인 세트
    totalCompletedSets: number; // 완료된 세트 수
    maxAllowedSets: number; // 최대 참가 가능 횟수

    // 진행 방식 설정 (사용자가 선택 가능)
    preferredMode: ProgressMode;

    // 세트별 데이터
    sets: ParticipationSet[];

    // 전체 통계
    stats: {
      totalRecordings: number;
      totalApprovedRecordings: number;
      averageQualityScore: number;
      firstParticipationAt?: string;
      lastParticipationAt?: string;
    };
  };

  // 🎯 현재 세트의 빠른 접근용 (쿼리 최적화)
  currentStatus: {
    isTutorialCompleted: boolean; // 튜토리얼 완료 여부
    canStartRecording: boolean; // 녹음 시작 가능 여부

    // 현재 진행 지점
    nextTask?: {
      taskKey: string;
      taskType: "situational" | "formal";
      index: number;
    } | null;

    // 현재 세트 진행률
    progress: {
      completedPercentage: number;
      submittedPercentage: number;
      approvedPercentage: number;
    };

    // 대기 상태
    pendingApproval: boolean; // 승인 대기 중
    canStartNextSet: boolean; // 다음 세트 시작 가능
  };

  // 설정
  settings?: {
    autoSubmitAfterRecording: boolean; // 녹음 완료 후 자동 제출
    requireManualReview: boolean; // 수동 검토 필요 여부
    allowAutoApproval: boolean; // 자동 승인 허용 여부
  };

  // 레거시 호환용 (기존 코드와의 호환성)
  recordingStatus?: {
    isTutorialCompleted: boolean;
    isAllRecordingCompleted: boolean;
    allRecordingCompletedAt?: string;
    progress: {
      totalAssigned: number;
      tutorialCompleted: number;
      mainSituationalCompleted: number;
      mainFormalCompleted: number;
      lastRecordedAt?: string;
    };
  };
}

// 상황발화 데이터 타입 (고정 26개)
export interface SituationalScript {
  service_name: string;
  service_target: string;
  task_name: string;
  task_key: string;
  main_content: string;
  detailed_instruction: string;
  id: number;
}

// 정형발화 데이터 타입 (세트별로 다름)
export interface FormalScript {
  service_name: string;
  formal_script: string;
  "set-id": number;
  service_target: string;
  task_name: string;
  task_key: string;
  id: string;
}

// 정형발화 세트 맵핑 타입
export interface FormalScriptSets {
  [taskKey: string]: FormalScript[]; // 기존: [taskKey: string]: { [setId: string]: FormalScript[] }
}
export interface SituationalScriptSets {
  [setId: string]: SituationalScript[];
}

// 스크립트 원본 데이터 유니온 타입
export type ScriptData = FormalScript | SituationalScript;
