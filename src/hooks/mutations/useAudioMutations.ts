// hooks/mutations/useAudioMutations.ts - 오디오 관련 데이터 변경 훅
import {
  useMutation,
  useQueryClient,
  UseMutationResult,
} from "@tanstack/react-query";
import {
//   AudioUploadRequest,
  AudioUploadResponse,
  AudioRecording,
  ScriptType,
  AudioFormat,
} from "@/types/firebase";

/**
 * 오디오 업로드 뮤테이션 요청 데이터 (클라이언트용)
 */
interface AudioUploadMutationRequest {
  userId: string;
  scriptId: number;
  scriptType: ScriptType;
  audioBlob: Blob;
  duration: number;
  audioFormat?: AudioFormat;
  deviceInfo?: string;
  browserInfo?: string;
}

/**
 * 오디오 삭제 요청 데이터
 */
interface AudioDeleteRequest {
  recordingId: string;
  userId: string;
}

/**
 * STT 재처리 요청 데이터
 */
interface STTReprocessRequest {
  recordingId: string;
  userId: string;
}

/**
 * 오디오 업로드 뮤테이션
 * Firebase Storage에 오디오 파일 업로드 후 Firestore에 메타데이터 저장
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
      scriptId,
      scriptType,
      audioBlob,
      duration,
      audioFormat = AudioFormat.WAV,
      deviceInfo,
      browserInfo,
    }: AudioUploadMutationRequest): Promise<AudioUploadResponse> => {
      // FormData 생성
      const formData = new FormData();

      // 파일명 생성
      const fileName = `${userId}_${scriptType}_${scriptId}_${Date.now()}.${audioFormat}`;
      formData.append("audio", audioBlob, fileName);

      // 메타데이터 추가
      formData.append("userId", userId);
      formData.append("scriptId", scriptId.toString());
      formData.append("scriptType", scriptType);
      formData.append("duration", duration.toString());

      if (deviceInfo) formData.append("deviceInfo", deviceInfo);
      if (browserInfo) formData.append("browserInfo", browserInfo);

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
      // 사용자의 오디오 녹음 기록 캐시 무효화 (새로운 녹음 추가됨)
      queryClient.invalidateQueries({
        queryKey: ["audioRecordings", variables.userId],
      });
      queryClient.invalidateQueries({
        queryKey: ["audioRecordings", variables.scriptType, variables.userId],
      });

      console.log("오디오 업로드 완료:", {
        recordingId: data.recordingId,
        audioUrl: data.audioUrl,
        fileSize: data.fileSize,
      });
    },
    onError: (error, variables) => {
      console.error("오디오 업로드 실패:", {
        error: error.message,
        userId: variables.userId,
        scriptId: variables.scriptId,
        scriptType: variables.scriptType,
      });
    },
  });
};

/**
 * 오디오 녹음 기록 삭제 뮤테이션
 * Storage 파일과 Firestore 기록 모두 삭제
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
      // 관련 캐시에서 해당 녹음 기록 제거
      queryClient.invalidateQueries({
        queryKey: ["audioRecordings", variables.userId],
      });
      queryClient.invalidateQueries({
        queryKey: ["audioRecording", variables.recordingId],
      });

      console.log("오디오 삭제 완료:", variables.recordingId);
    },
    onError: (error) => {
      console.error("오디오 삭제 실패:", error);
    },
  });
};

/**
 * STT 재처리 뮤테이션
 * 기존 오디오 파일에 대해 STT를 다시 수행
 */
export const useReprocessSTTMutation = (): UseMutationResult<
  { success: boolean; sttText: string; confidence: number },
  Error,
  STTReprocessRequest
> => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      recordingId,
      userId,
    }: STTReprocessRequest): Promise<{
      success: boolean;
      sttText: string;
      confidence: number;
    }> => {
      const response = await fetch(`/api/audio/stt/reprocess`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ recordingId, userId }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "STT 재처리에 실패했습니다.");
      }

      return data;
    },
    onSuccess: (data, variables) => {
      // 해당 녹음 기록의 캐시 업데이트
      const existingRecording = queryClient.getQueryData<AudioRecording>([
        "audioRecording",
        variables.recordingId,
      ]);

      if (existingRecording) {
        const updatedRecording: AudioRecording = {
          ...existingRecording,
          sttText: data.sttText,
          sttConfidence: data.confidence,
          processedAt: new Date().toISOString(),
        };

        queryClient.setQueryData(
          ["audioRecording", variables.recordingId],
          updatedRecording
        );
      }

      // 사용자 녹음 목록도 무효화
      queryClient.invalidateQueries({
        queryKey: ["audioRecordings", variables.userId],
      });

      console.log("STT 재처리 완료:", {
        recordingId: variables.recordingId,
        sttText: data.sttText,
        confidence: data.confidence,
      });
    },
    onError: (error) => {
      console.error("STT 재처리 실패:", error);
    },
  });
};

/**
 * 오디오 메타데이터 업데이트 뮤테이션
 * 녹음 기록의 메타데이터만 업데이트 (파일은 그대로)
 */
export const useUpdateAudioMetadataMutation = (): UseMutationResult<
  AudioRecording,
  Error,
  { recordingId: string; updates: Partial<AudioRecording> }
> => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      recordingId,
      updates,
    }: {
      recordingId: string;
      updates: Partial<AudioRecording>;
    }): Promise<AudioRecording> => {
      const response = await fetch(`/api/audio/recordings/${recordingId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updates),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "오디오 메타데이터 업데이트에 실패했습니다."
        );
      }

      return data.recording as AudioRecording;
    },
    onSuccess: (updatedRecording, variables) => {
      // 캐시 직접 업데이트
      queryClient.setQueryData(
        ["audioRecording", variables.recordingId],
        updatedRecording
      );

      // 사용자 녹음 목록에서도 해당 기록 업데이트
      queryClient.invalidateQueries({
        queryKey: ["audioRecordings", updatedRecording.userId],
      });

      console.log("오디오 메타데이터 업데이트 완료:", variables.recordingId);
    },
    onError: (error) => {
      console.error("오디오 메타데이터 업데이트 실패:", error);
    },
  });
};

/**
 * 오디오 캐시 정리 뮤테이션
 * 로컬 캐시된 오디오 관련 데이터 정리
 */
// export const useClearAudioCacheMutation = (): UseMutationResult<
//   void,
//   Error,
//   { userId?: string; recordingId?: string }
// > => {
//   const queryClient = useQueryClient();

//   return useMutation({
//     mutationFn: async ({
//       userId,
//       recordingId,
//     }: {
//       userId?: string;
//       recordingId?: string;
//     }): Promise<void> => {
//       // 실제 서버 작업은 없고 캐시만 정리
//       await new Promise((resolve) => setTimeout(resolve, 100));
//     },
//     onSuccess: (_, variables) => {
//       if (variables.recordingId) {
//         // 특정 녹음 기록 캐시만 정리
//         queryClient.removeQueries({
//           queryKey: ["audioRecording", variables.recordingId],
//         });
//       } else if (variables.userId) {
//         // 특정 사용자의 오디오 캐시만 정리
//         queryClient.removeQueries({
//           queryKey: ["audioRecordings", variables.userId],
//         });
//         // 스크립트 타입별 캐시도 정리
//         Object.values(ScriptType).forEach((type) => {
//           queryClient.removeQueries({
//             queryKey: ["audioRecordings", type, variables.userId],
//           });
//         });
//       } else {
//         // 모든 오디오 관련 캐시 정리
//         queryClient.removeQueries({ queryKey: ["audioRecordings"] });
//         queryClient.removeQueries({ queryKey: ["audioRecording"] });
//       }

//       console.log("오디오 캐시 정리 완료:", variables);
//     },
//     onError: (error) => {
//       console.error("오디오 캐시 정리 실패:", error);
//     },
//   });
// };

/**
 * 일괄 오디오 업로드 뮤테이션
 * 여러 오디오 파일을 순차적으로 업로드
 */
export const useBatchUploadAudioMutation = (): UseMutationResult<
  AudioUploadResponse[],
  Error,
  AudioUploadMutationRequest[]
> => {
  const queryClient = useQueryClient();
  const uploadAudioMutation = useUploadAudioMutation();

  return useMutation({
    mutationFn: async (
      requests: AudioUploadMutationRequest[]
    ): Promise<AudioUploadResponse[]> => {
      const results: AudioUploadResponse[] = [];

      // 순차적으로 업로드 (동시 업로드는 서버 부하 고려)
      for (const request of requests) {
        try {
          const result = await uploadAudioMutation.mutateAsync(request);
          results.push(result);
        } catch (error) {
          console.error("개별 오디오 업로드 실패:", error);
          throw error; // 하나라도 실패하면 전체 실패
        }
      }

      return results;
    },
    onSuccess: (results, variables) => {
      // 모든 관련 사용자의 캐시 무효화
      const userIds = [...new Set(variables.map((req) => req.userId))];
      userIds.forEach((userId) => {
        queryClient.invalidateQueries({
          queryKey: ["audioRecordings", userId],
        });
      });

      console.log("일괄 오디오 업로드 완료:", {
        uploadCount: results.length,
        totalSize: results.reduce((sum, result) => sum + result.fileSize, 0),
      });
    },
    onError: (error) => {
      console.error("일괄 오디오 업로드 실패:", error);
    },
  });
};
