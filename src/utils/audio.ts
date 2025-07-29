import { AudioStatus } from "@/types/firebase";
/**
 * 오디오 관련 유틸리티 함수들
 */
export const audioUtils = {
    /**
     * 파일 크기를 읽기 쉬운 형태로 변환
     */
    formatFileSize: (bytes: number): string => {
      if (bytes === 0) return "0 Bytes";
      const k = 1024;
      const sizes = ["Bytes", "KB", "MB", "GB"];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
    },
  
    /**
     * 녹음 시간을 읽기 쉬운 형태로 변환
     */
    formatDuration: (seconds: number): string => {
      const minutes = Math.floor(seconds / 60);
      const remainingSeconds = Math.floor(seconds % 60);
      return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
    },
  
    /**
     * 오디오 상태에 따른 한글 이름 반환
     */
    getStatusName: (status: AudioStatus): string => {
      switch (status) {
        case AudioStatus.UPLOADING:
          return "업로드 중";
        case AudioStatus.PROCESSING:
          return "처리 중";
        case AudioStatus.COMPLETED:
          return "완료됨";
        case AudioStatus.FAILED:
          return "실패";
        default:
          return "알 수 없음";
      }
    },
  
    /**
     * 태스크 타입에 따른 한글 이름 반환
     */
    getTaskTypeName: (taskType: "situational" | "formal"): string => {
      switch (taskType) {
        case "situational":
          return "상황발화";
        case "formal":
          return "정형발화";
        default:
          return "알 수 없음";
      }
    },
  
    /**
     * 검증 상태에 따른 한글 이름 반환
     */
    getVerificationStatusName: (status: string): string => {
      switch (status) {
        case "pending":
          return "검토 대기";
        case "approved":
          return "승인됨";
        case "rejected":
          return "거부됨";
        default:
          return "알 수 없음";
      }
    },
  };
  