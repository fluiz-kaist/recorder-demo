// hooks/mutations/useAudioMutations.ts - 새로운 구조에 맞춘 오디오 뮤테이션

import {
  useMutation,
  useQueryClient,
  UseMutationResult,
} from "@tanstack/react-query";
import { AudioFormat } from "@/types/firebase";
import { AudioUploadResponse } from "@/types/api";
import { AudioUploadMutationRequest, AudioDeleteRequest } from "@/types/audio";

/**
 * 오디오 업로드 뮤테이션
 */
export const useUploadAudioMutation = (): UseMutationResult<
  AudioUploadResponse,
  Error,
  AudioUploadMutationRequest
> => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      userId,
      taskKey,
      taskType,
      audioBlob,
      recordingStartedAt,
      recordingEndedAt,
      actualDuration,
      sessionDuration,
      originalScript,
      domain,
      intent,
      category,
      gender,
      ageGroup,
      userName,
      sttTranscription,
      audioFormat = AudioFormat.WAV,
      deviceInfo,
    }: AudioUploadMutationRequest): Promise<AudioUploadResponse> => {
      const formData = new FormData();

      // 파일명 생성
      const fileName = `${userId}_${taskKey.replace(
        /[^a-zA-Z0-9]/g,
        "_"
      )}_${Date.now()}.${audioFormat}`;
      formData.append("audio", audioBlob, fileName);

      // 기본 메타데이터
      formData.append("userId", userId);
      formData.append("taskKey", taskKey);
      formData.append("taskType", taskType);
      formData.append("originalScript", originalScript);

      //음성 데이터 관련 데이터
      formData.append("recordingStartedAt", recordingStartedAt);
      formData.append("recordingEndedAt", recordingEndedAt);
      formData.append("actualDuration", actualDuration.toString());
      formData.append("sessionDuration", sessionDuration.toString());

      // 스크립트 메타데이터
      formData.append("domain", domain);
      formData.append("intent", intent);
      formData.append("category", category);

      // 화자 정보
      formData.append("gender", gender);
      formData.append("ageGroup", ageGroup);
      formData.append("userName", userName);

      //클라이언트에서 변환해서 보내는 stt
      formData.append("sttTranscription", sttTranscription);

      // 선택적 정보
      if (deviceInfo) formData.append("deviceInfo", deviceInfo);

      const response = await fetch("/api/audio/upload", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "오디오 업로드에 실패했습니다.");
      }

      return data as AudioUploadResponse;
    },
    onSuccess: (data, variables) => {
      // 관련 캐시 무효화
      queryClient.invalidateQueries({
        queryKey: ["audioRecordings", variables.userId],
      });
      queryClient.invalidateQueries({
        queryKey: [
          "audioRecordingByTaskKey",
          variables.taskKey,
          variables.userId,
        ],
      });
      queryClient.invalidateQueries({
        queryKey: ["userRecordingTasks", variables.userId],
      });

      console.log("오디오 업로드 완료:", {
        recordingId: data.recordingId,
        taskKey: variables.taskKey,
        audioUrl: data.audioUrl,
        fileSize: data.fileSize,
      });
    },
    onError: (error, variables) => {
      console.error("오디오 업로드 실패:", {
        error: error.message,
        userId: variables.userId,
        taskKey: variables.taskKey,
        taskType: variables.taskType,
      });
    },
  });
};

/**
 * 오디오 녹음 기록 삭제 뮤테이션
 */
export const useDeleteAudioMutation = (): UseMutationResult<
  { success: boolean; message?: string },
  Error,
  AudioDeleteRequest
> => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      recordingId,
      userId,
    }: AudioDeleteRequest): Promise<{ success: boolean; message?: string }> => {
      const response = await fetch(`/api/audio/recordings/${recordingId}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ userId }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "오디오 삭제에 실패했습니다.");
      }

      return data;
    },
    onSuccess: (data, variables) => {
      // 관련 캐시 무효화
      queryClient.invalidateQueries({
        queryKey: ["audioRecordings", variables.userId],
      });
      queryClient.invalidateQueries({
        queryKey: ["audioRecording", variables.recordingId],
      });
      queryClient.invalidateQueries({
        queryKey: ["userRecordingTasks", variables.userId],
      });

      console.log("오디오 삭제 완료:", variables.recordingId);
    },
    onError: (error) => {
      console.error("오디오 삭제 실패:", error);
    },
  });
};
