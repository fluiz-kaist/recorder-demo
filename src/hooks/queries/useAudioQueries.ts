// hooks/queries/useAudioQueries.ts - 오디오 관련 데이터 조회 훅
import { useQuery, UseQueryResult } from "@tanstack/react-query";
import { useMemo } from "react";
import {
  AudioRecording,
  AudioStats,
  ScriptType,
  AudioStatus,
  AudioFormat,
} from "@/types/firebase";
import { useAuthStatusQuery } from "@/hooks/queries/useUserQueries";

/**
 * 사용자의 모든 오디오 녹음 기록 조회
 * @param userId - 사용자 ID
 * @returns UseQueryResult<AudioRecording[], Error>
 */
export const useUserAudioRecordingsQuery = (
  userId?: string
): UseQueryResult<AudioRecording[], Error> => {
  const { data: authToken } = useAuthStatusQuery();
  const targetUserId = userId || authToken?.userId;

  return useQuery({
    queryKey: ["audioRecordings", targetUserId],
    queryFn: async (): Promise<AudioRecording[]> => {
      const response = await fetch(
        `/api/audio/recordings?userId=${targetUserId}`
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "오디오 녹음 기록을 불러올 수 없습니다."
        );
      }

      return data.recordings as AudioRecording[];
    },
    enabled: !!authToken?.isAuthorized && !!targetUserId,
    staleTime: 2 * 60 * 1000, // 2분간 캐시 유지
    retry: 1,
  });
};

/**
 * 특정 스크립트 타입의 오디오 녹음 기록 조회
 * @param scriptType - 스크립트 타입
 * @param userId - 사용자 ID
 * @returns UseQueryResult<AudioRecording[], Error>
 */
export const useAudioRecordingsByTypeQuery = (
  scriptType: ScriptType,
  userId?: string
): UseQueryResult<AudioRecording[], Error> => {
  const { data: authToken } = useAuthStatusQuery();
  const targetUserId = userId || authToken?.userId;

  return useQuery({
    queryKey: ["audioRecordings", scriptType, targetUserId],
    queryFn: async (): Promise<AudioRecording[]> => {
      const response = await fetch(
        `/api/audio/recordings?userId=${targetUserId}&scriptType=${scriptType}`
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "오디오 녹음 기록을 불러올 수 없습니다."
        );
      }

      return data.recordings as AudioRecording[];
    },
    enabled: !!authToken?.isAuthorized && !!targetUserId,
    staleTime: 2 * 60 * 1000, // 2분간 캐시 유지
    retry: 1,
  });
};

/**
 * 특정 오디오 녹음 기록 상세 조회
 * @param recordingId - 녹음 기록 ID
 * @returns UseQueryResult<AudioRecording, Error>
 */
export const useAudioRecordingDetailQuery = (
  recordingId: string
): UseQueryResult<AudioRecording, Error> => {
  const { data: authToken } = useAuthStatusQuery();

  return useQuery({
    queryKey: ["audioRecording", recordingId],
    queryFn: async (): Promise<AudioRecording> => {
      const response = await fetch(`/api/audio/recordings/${recordingId}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "오디오 녹음 정보를 불러올 수 없습니다."
        );
      }

      return data.recording as AudioRecording;
    },
    enabled: !!authToken?.isAuthorized && !!recordingId,
    staleTime: 5 * 60 * 1000, // 5분간 캐시 유지
    retry: 1,
  });
};

/**
 * 사용자의 오디오 통계 정보 계산 (클라이언트 계산)
 * @param userId - 사용자 ID
 * @returns AudioStats | null
 */
export const useUserAudioStats = (userId?: string): AudioStats | null => {
  const { data: recordings } = useUserAudioRecordingsQuery(userId);

  return useMemo(() => {
    if (!recordings || recordings.length === 0) return null;

    const totalRecordings = recordings.length;
    const totalDuration = recordings.reduce(
      (sum, recording) => sum + recording.duration,
      0
    );
    const averageDuration = totalDuration / totalRecordings;
    const totalFileSize = recordings.reduce(
      (sum, recording) => sum + recording.fileSize,
      0
    );

    // 상태별 분류
    const statusBreakdown = recordings.reduce((acc, recording) => {
      acc[recording.status] = (acc[recording.status] || 0) + 1;
      return acc;
    }, {} as { [key in AudioStatus]: number });

    // 포맷별 분류
    const formatBreakdown = recordings.reduce((acc, recording) => {
      acc[recording.audioFormat] = (acc[recording.audioFormat] || 0) + 1;
      return acc;
    }, {} as { [key in AudioFormat]: number });

    return {
      totalRecordings,
      totalDuration,
      averageDuration,
      totalFileSize,
      statusBreakdown,
      formatBreakdown,
    };
  }, [recordings]);
};

/**
 * 특정 스크립트의 오디오 녹음 기록 조회
 * @param scriptType - 스크립트 타입
 * @param scriptId - 스크립트 ID
 * @param userId - 사용자 ID
 * @returns AudioRecording | null
 */
export const useScriptAudioRecording = (
  scriptType: ScriptType,
  scriptId: number,
  userId?: string
): AudioRecording | null => {
  const { data: recordings } = useUserAudioRecordingsQuery(userId);

  return useMemo(() => {
    if (!recordings) return null;

    const recording = recordings.find(
      (r) => r.scriptType === scriptType && r.scriptId === scriptId
    );

    return recording || null;
  }, [recordings, scriptType, scriptId]);
};

/**
 * 완료된 오디오 녹음 기록만 조회
 * @param userId - 사용자 ID
 * @returns AudioRecording[]
 */
export const useCompletedAudioRecordings = (
  userId?: string
): AudioRecording[] => {
  const { data: recordings } = useUserAudioRecordingsQuery(userId);

  return useMemo(() => {
    if (!recordings) return [];

    return recordings.filter(
      (recording) => recording.status === AudioStatus.COMPLETED
    );
  }, [recordings]);
};

/**
 * 처리 중인 오디오 녹음 기록 조회
 * @param userId - 사용자 ID
 * @returns AudioRecording[]
 */
export const useProcessingAudioRecordings = (
  userId?: string
): AudioRecording[] => {
  const { data: recordings } = useUserAudioRecordingsQuery(userId);

  return useMemo(() => {
    if (!recordings) return [];

    return recordings.filter(
      (recording) =>
        recording.status === AudioStatus.PROCESSING ||
        recording.status === AudioStatus.UPLOADING
    );
  }, [recordings]);
};

/**
 * 오디오 품질별 분류
 * @param userId - 사용자 ID
 * @returns { high: AudioRecording[]; medium: AudioRecording[]; low: AudioRecording[] }
 */
export const useAudioRecordingsByQuality = (
  userId?: string
): {
  high: AudioRecording[];
  medium: AudioRecording[];
  low: AudioRecording[];
} => {
  const { data: recordings } = useUserAudioRecordingsQuery(userId);

  return useMemo(() => {
    if (!recordings) return { high: [], medium: [], low: [] };

    return recordings.reduce(
      (acc, recording) => {
        const quality = recording.quality || "medium";
        acc[quality].push(recording);
        return acc;
      },
      { high: [], medium: [], low: [] } as {
        high: AudioRecording[];
        medium: AudioRecording[];
        low: AudioRecording[];
      }
    );
  }, [recordings]);
};

/**
 * 최근 녹음 기록 조회 (최대 5개)
 * @param userId - 사용자 ID
 * @returns AudioRecording[]
 */
export const useRecentAudioRecordings = (userId?: string): AudioRecording[] => {
  const { data: recordings } = useUserAudioRecordingsQuery(userId);

  return useMemo(() => {
    if (!recordings) return [];

    return recordings
      .sort(
        (a, b) =>
          new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime()
      )
      .slice(0, 5);
  }, [recordings]);
};

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
   * 오디오 품질에 따른 한글 이름 반환
   */
  getQualityName: (quality?: string): string => {
    switch (quality) {
      case "high":
        return "고품질";
      case "medium":
        return "중품질";
      case "low":
        return "저품질";
      default:
        return "보통";
    }
  },
};
