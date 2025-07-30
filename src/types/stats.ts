import { AudioStatus, AudioFormat, ScriptType } from "@/types/firebase";
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

  // 🆕 스크립트 타입별 통계
  scriptTypeBreakdown: {
    [key in ScriptType]: number;
  };

  // 🆕 인구통계별 통계
  demographicBreakdown: {
    byGender: Record<"남성" | "여성", number>;
    byAgeGroup: Record<string, number>;
  };

  // 🆕 품질 관련 통계
  qualityStats: {
    averageScore?: number;
    approved: number;
    pending: number;
    rejected: number;
  };
}
