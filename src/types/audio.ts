// 현실적인 음성 학습 데이터 구조 - 텍스트 중심
// 오디오 포맷
enum AudioFormat {
  WAV = "wav",
  MP3 = "mp3",
  M4A = "m4a",
  WEBM = "webm",
}

enum AudioStatus {
  UPLOADING = "uploading", // 업로드 중
  PROCESSING = "processing", // 처리 중 (STT 등)
  COMPLETED = "completed", // 완료됨
  FAILED = "failed", // 실패
}

// 현실적인 음성 학습 데이터 구조 - 점진적 확장 가능
export interface AudioRecording {
  // 기본 정보
  id: string;
  userId: string;
  taskKey: string;
  taskType: "situational" | "formal";
  audioUrl: string;
  recordedAt: string;
  uploadedAt: string;
  fileName: string;
  status: string;

  // 🎯 핵심: 텍스트 비교 데이터
  textData: {
    // 원본 vs 실제 발화
    originalScript: string;
    sttTranscription: string;
    manualTranscription?: string;

    // 스크립트 메타데이터
    domain: string;
    intent: string;
    category: string;

    // 🔮 미래 확장용 (optional)
    deviations?: {
      wordChanges?: Array<{
        original: string;
        spoken: string;
        type: "substitution" | "insertion" | "deletion";
        position: number;
      }>;
      editDistance?: number;
      similarity?: number;
      isNaturalVariation?: boolean;
      hasSignificantDeviation?: boolean;
    };
  };

  // 🎯 화자 정보
  speakerInfo: {
    gender: "male" | "female";
    ageGroup: string;
    // 🔮 미래 확장용
    dialectRegion?: string;
    voiceCharacteristics?: string;
  };

  // 🎯 품질 평가
  qualityCheck: {
    // 현재 구현
    duration: number;
    fileSize: number;
    volumeLevel: number;
    hasClipping: boolean;
    backgroundNoise: "low" | "medium" | "high";
    audioFormat: AudioFormat;

    deviceInfo?: string;
    // 🔮 미래 확장용 (optional)
    isComplete?: boolean;
    hasRepeatedWords?: boolean;
    hasFalseStarts?: boolean;
    overallGrade?: "A" | "B" | "C";
    isUsableForTraining?: boolean;
    needsManualReview?: boolean;
    autoCheckConfidence?: number;
  };
}
