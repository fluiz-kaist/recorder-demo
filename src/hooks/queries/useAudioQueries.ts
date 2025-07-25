// hooks/queries/useAudioQueries.ts - 새로운 구조에 맞춘 오디오 쿼리

import { useQuery, UseQueryResult } from "@tanstack/react-query";
import { useMemo } from "react";
import { AudioStatus, AudioFormat } from "@/types/firebase";
import { AudioRecording } from "@/types/audio";
import { useAuthStatusQuery } from "@/hooks/queries/useUserQueries";

/**
 * 사용자의 모든 오디오 녹음 기록 조회
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
    enabled: !!authToken?.isAuthenticated && !!targetUserId,
    staleTime: 2 * 60 * 1000, // 2분간 캐시 유지
    retry: 1,
  });
};

/**
 * taskKey로 특정 녹음 기록 조회
 */
export const useAudioRecordingByTaskKeyQuery = (
  taskKey: string,
  userId?: string
): UseQueryResult<AudioRecording | null, Error> => {
  const { data: authToken } = useAuthStatusQuery();
  const targetUserId = userId || authToken?.userId;

  return useQuery({
    queryKey: ["audioRecordingByTaskKey", taskKey, targetUserId],
    queryFn: async (): Promise<AudioRecording | null> => {
      const response = await fetch(
        `/api/audio/recordings/by-task?taskKey=${encodeURIComponent(
          taskKey
        )}&userId=${targetUserId}`
      );

      if (response.status === 404) {
        return null; // 녹음이 없는 경우
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "오디오 녹음 기록을 불러올 수 없습니다."
        );
      }

      return data.recording as AudioRecording;
    },
    enabled: !!authToken?.isAuthenticated && !!targetUserId && !!taskKey,
    staleTime: 2 * 60 * 1000,
    retry: 1,
  });
};

/**
 * 완료된 녹음 기록만 조회
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
};
