// hooks/queries/useAudioQueries.ts - 클라이언트에서 직접 Firebase 조회

import { useQuery, UseQueryResult } from "@tanstack/react-query";
import { useMemo } from "react";
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  QueryConstraint,
} from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { AudioRecording } from "@/types/audio";
import { useAuthStatusQuery } from "@/hooks/queries/useUserQueries";

const audioCollectionName =
  process.env.NEXT_PUBLIC_DB_AUDIO_RECORDINGS_COLLECTION || "recording-temp";

/**
 * 사용자의 모든 오디오 녹음 기록 조회 (필터링 옵션 포함)
 */
export const useUserAudioRecordingsQuery = (
  userId?: string | null,
  options?: {
    taskType?: "situational" | "formal";
    domain?: string;
    limit?: number;
  }
): UseQueryResult<AudioRecording[], Error> => {
  const { data: authToken } = useAuthStatusQuery();
  const targetUserId = userId || authToken?.userId;

  return useQuery({
    queryKey: ["audioRecordings", targetUserId, options],
    queryFn: async (): Promise<AudioRecording[]> => {
      if (!targetUserId) {
        throw new Error("사용자 ID가 필요합니다.");
      }

      // 기본 쿼리 구성
      const queryConstraints: QueryConstraint[] = [
        where("userId", "==", targetUserId),
        orderBy("uploadedAt", "desc"), // recordedAt -> uploadedAt으로 수정 (실제 데이터 구조에 맞춤)
      ];

      // 필터 적용
      if (options?.taskType) {
        queryConstraints.push(where("taskType", "==", options.taskType));
      }

      if (options?.domain) {
        queryConstraints.push(where("textData.domain", "==", options.domain));
      }

      if (options?.limit && options.limit > 0) {
        queryConstraints.push(limit(options.limit));
      }

      const q = query(collection(db, audioCollectionName), ...queryConstraints);
      const querySnapshot = await getDocs(q);

      const recordings = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as AudioRecording[];

      return recordings;
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
      if (!targetUserId || !taskKey) {
        return null;
      }

      const q = query(
        collection(db, audioCollectionName),
        where("userId", "==", targetUserId),
        where("taskKey", "==", taskKey),
        orderBy("uploadedAt", "desc"),
        limit(1) // 가장 최근 녹음만 가져오기
      );

      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        return null;
      }

      const doc = querySnapshot.docs[0];
      return {
        id: doc.id,
        ...doc.data(),
      } as AudioRecording;
    },
    enabled: !!authToken?.isAuthenticated && !!targetUserId && !!taskKey,
    staleTime: 2 * 60 * 1000,
    retry: 1,
  });
};

/**
 * 사용자가 녹음한 태스크들의 요약 정보 조회
 */
export const useUserRecordingTasksQuery = (
  userId?: string | null
): UseQueryResult<
  Array<{
    taskKey: string;
    taskType: "situational" | "formal";
    domain: string;
    latestRecording: AudioRecording;
    recordingCount: number;
  }>,
  Error
> => {
  const { data: authToken } = useAuthStatusQuery();
  const targetUserId = userId || authToken?.userId;

  return useQuery({
    queryKey: ["userRecordingTasks", targetUserId],
    queryFn: async () => {
      if (!targetUserId) {
        throw new Error("사용자 ID가 필요합니다.");
      }

      const q = query(
        collection(db, audioCollectionName),
        where("userId", "==", targetUserId),
        orderBy("uploadedAt", "desc")
      );

      const querySnapshot = await getDocs(q);
      const recordings = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as AudioRecording[];

      // taskKey별로 그룹화
      const taskGroups = recordings.reduce((acc, recording) => {
        const key = recording.taskKey;
        if (!acc[key]) {
          acc[key] = [];
        }
        acc[key].push(recording);
        return acc;
      }, {} as Record<string, AudioRecording[]>);

      // 각 태스크의 요약 정보 생성
      return Object.entries(taskGroups).map(([taskKey, taskRecordings]) => {
        const latestRecording = taskRecordings[0]; // 이미 날짜순으로 정렬됨
        return {
          taskKey,
          taskType: latestRecording.taskType,
          domain: latestRecording.textData.domain,
          latestRecording,
          recordingCount: taskRecordings.length,
        };
      });
    },
    enabled: !!authToken?.isAuthenticated && !!targetUserId,
    staleTime: 5 * 60 * 1000, // 5분간 캐시 유지
    retry: 1,
  });
};

/**
 * 특정 녹음 ID로 단일 녹음 기록 조회
 */
export const useAudioRecordingQuery = (
  recordingId: string
): UseQueryResult<AudioRecording | null, Error> => {
  const { data: authToken } = useAuthStatusQuery();

  return useQuery({
    queryKey: ["audioRecording", recordingId],
    queryFn: async (): Promise<AudioRecording | null> => {
      if (!recordingId) {
        return null;
      }

      const q = query(
        collection(db, audioCollectionName),
        where("id", "==", recordingId),
        limit(1)
      );

      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        return null;
      }

      const doc = querySnapshot.docs[0];
      return {
        id: doc.id,
        ...doc.data(),
      } as AudioRecording;
    },
    enabled: !!authToken?.isAuthenticated && !!recordingId,
    staleTime: 10 * 60 * 1000, // 10분간 캐시 유지 (단일 레코드는 더 오래)
    retry: 1,
  });
};

/**
 * 도메인별 녹음 통계 조회
 */
export const useAudioRecordingStatsQuery = (
  userId?: string | null
): UseQueryResult<
  Array<{
    domain: string;
    totalRecordings: number;
    completedRecordings: number;
    averageDuration: number;
    totalDuration: number;
  }>,
  Error
> => {
  const { data: recordings } = useUserAudioRecordingsQuery(userId);

  return useMemo(() => {
    if (!recordings) {
      return {
        data: undefined,
        isLoading: true,
        error: null,
      } as any;
    }

    // 도메인별 통계 계산
    const domainStats = recordings.reduce((acc, recording) => {
      const domain = recording.textData.domain;
      if (!acc[domain]) {
        acc[domain] = {
          domain,
          totalRecordings: 0,
          completedRecordings: 0,
          totalDuration: 0,
          durations: [],
        };
      }

      acc[domain].totalRecordings++;
      acc[domain].totalDuration += recording.recordingSession.actualDuration;
      acc[domain].durations.push(recording.recordingSession.actualDuration);

      // 완료된 녹음 카운트 (verificationStatus가 APPROVED인 경우)
      if (recording.verificationStatus === "approved") {
        acc[domain].completedRecordings++;
      }

      return acc;
    }, {} as Record<string, any>);

    // 평균 계산 및 최종 형태로 변환
    const stats = Object.values(domainStats).map((stat: any) => ({
      domain: stat.domain,
      totalRecordings: stat.totalRecordings,
      completedRecordings: stat.completedRecordings,
      averageDuration: stat.totalDuration / stat.totalRecordings,
      totalDuration: stat.totalDuration,
    }));

    return {
      data: stats,
      isLoading: false,
      error: null,
    } as any;
  }, [recordings]);
};
