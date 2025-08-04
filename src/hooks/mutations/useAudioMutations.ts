// hooks/mutations/useAudioMutations.ts
//  클라이언트에서 직접 Firebase 업로드

import {
  useMutation,
  useQueryClient,
  UseMutationResult,
} from "@tanstack/react-query";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { storage, db } from "@/lib/firebase/config";
import { AudioFormat } from "@/types/firebase";
import { VerificationStatus } from "@/types/audio";
import { AudioUploadResponse } from "@/types/api";
import { AudioUploadMutationRequest, AudioRecording } from "@/types/audio";

const audioCollectionName =
  process.env.NEXT_PUBLIC_DB_AUDIO_RECORDINGS_COLLECTION || "recording-temp";

/**
 * 품질 등급 계산 함수
 */
const calculateQualityGrade = (qualityCheck: {
  volumeLevel: number;
  backgroundNoise: "low" | "medium" | "high";
  hasClipping: boolean;
  duration: number;
}): "high" | "medium" | "low" => {
  const { volumeLevel, backgroundNoise, hasClipping, duration } = qualityCheck;

  if (
    volumeLevel >= 0.7 &&
    backgroundNoise === "low" &&
    !hasClipping &&
    duration >= 3
  ) {
    return "high";
  }

  if (
    volumeLevel < 0.4 ||
    backgroundNoise === "high" ||
    hasClipping ||
    duration < 2
  ) {
    return "low";
  }

  return "medium";
};

/**
 * 클라이언트에서 음성 품질 분석
 */
const analyzeAudioQuality = async (
  audioBlob: Blob,
  duration: number,
  audioFormat: AudioFormat
): Promise<{
  volumeLevel: number;
  hasClipping: boolean;
  backgroundNoise: "low" | "medium" | "high";
  qualityGrade: "high" | "medium" | "low";
}> => {
  const fileSize = audioBlob.size;

  // 포맷별 예상 비트레이트
  const expectedBitrates = {
    [AudioFormat.WAV]: 1411,
    [AudioFormat.MP3]: 128,
    [AudioFormat.M4A]: 128,
    [AudioFormat.WEBM]: 128,
  };

  const expectedBitrate = expectedBitrates[audioFormat] || 128;
  const expectedFileSize = (expectedBitrate * 1000 * duration) / 8;
  const actualBitrate = (fileSize * 8) / (duration * 1000);

  const volumeLevel = Math.min(actualBitrate / expectedBitrate, 1);
  const hasClipping = volumeLevel > 0.98 || fileSize > expectedFileSize * 1.5;

  let backgroundNoise: "low" | "medium" | "high" = "low";
  if (fileSize > expectedFileSize * 2) {
    backgroundNoise = "high";
  } else if (volumeLevel < 0.3) {
    backgroundNoise = "high";
  } else if (volumeLevel < 0.6 || fileSize > expectedFileSize * 1.3) {
    backgroundNoise = "medium";
  }

  if (duration < 1) {
    backgroundNoise = "high";
  }

  const qualityResult = {
    volumeLevel: Math.round(volumeLevel * 100) / 100,
    hasClipping,
    backgroundNoise,
  };

  const qualityGrade = calculateQualityGrade({
    ...qualityResult,
    duration,
  });

  return {
    ...qualityResult,
    qualityGrade,
  };
};

/**
 * 클라이언트에서 직접 Firebase에 오디오 업로드
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
      // VAD 관련 파라미터
      vadApplied = false,
      originalDuration,
      processedDuration,
      silenceRemoved = 0,
      compressionRatio = 1.0,
      speechSegments = 1,
      qualityScore = 70,
      qualityIssues = [],
      qualityRecommendations = [],
    }: AudioUploadMutationRequest): Promise<AudioUploadResponse> => {
      // 1. 고유한 recording ID 생성
      const recordingId = `${userId}_${taskKey.replace(
        /[^a-zA-Z0-9]/g,
        "_"
      )}_${Date.now()}`;
      const fileName = `${recordingId}.${audioFormat}`;
      const enhancedFileName = `${recordingId}_enhanced.${audioFormat}`;

      // 2. 품질 분석
      const qualityAnalysis = await analyzeAudioQuality(
        audioBlob,
        actualDuration,
        audioFormat
      );

      // 3. Firebase Storage에 업로드
      const collectionName =
        process.env.NEXT_PUBLIC_STOREAGE_RECORDING_FILES_COLLECTION ||
        "temp-recording_files";
      const enhancedCollName =
        process.env.NEXT_PUBLIC_STOREAGE_RECORDING_ENHANCED_FILES_COLLECTION ||
        "temp-recording_files";

      const storageRef = ref(
        storage,
        `${collectionName}/${domain}/${taskKey}/${userId}/${fileName}`
      );

      const EHstorageRef = ref(
        storage,
        `${enhancedCollName}/${enhancedFileName}`
      );

      console.log("원본 업로드 시작");

      const uploadResult = await uploadBytes(storageRef, audioBlob, {
        contentType: audioBlob.type || "audio/wav",
      });

      console.log("원본 업로드 성공, eh 업로드 시작");
      await uploadBytes(EHstorageRef, audioBlob, {
        contentType: audioBlob.type || "audio/wav",
      });

      console.log("eh 업로드 종료");

      // 4. 다운로드 URL 생성
      const audioUrl = await getDownloadURL(uploadResult.ref);

      // 5. AudioRecording 데이터 생성
      const audioRecording: AudioRecording = {
        id: recordingId,
        userId,
        taskKey,
        taskType: taskType as "situational" | "formal",
        audioUrl,
        recordingSession: {
          startedAt: recordingStartedAt,
          endedAt: recordingEndedAt,
          actualDuration,
          sessionDuration,
        },
        uploadedAt: serverTimestamp(),
        textData: {
          originalScript,
          sttTranscription:
            sttTranscription || "클라이언트에서 STT 결과를 보내지 않았습니다",
          domain,
          intent,
          category,
        },
        speakerInfo: {
          gender: gender as "남성" | "여성" | "불명",
          ageGroup,
          userName,
        },
        qualityCheck: {
          duration: actualDuration,
          fileSize: audioBlob.size,
          volumeLevel: qualityAnalysis.volumeLevel,
          hasClipping: qualityAnalysis.hasClipping,
          backgroundNoise: qualityAnalysis.backgroundNoise,
          audioFormat,
          deviceInfo: deviceInfo || "undefined_device",
          qualityGrade: qualityAnalysis.qualityGrade,

          // VAD 처리 정보
          vadProcessing: vadApplied
            ? {
                applied: true,
                originalDuration: originalDuration || actualDuration,
                processedDuration: processedDuration || actualDuration,
                silenceRemoved: silenceRemoved || 0,
                compressionRatio: compressionRatio || 1.0,
                speechSegments: speechSegments || 1,
                qualityImprovement: Math.max(0, qualityScore - 70),
              }
            : {
                applied: false,
                originalDuration: actualDuration,
                processedDuration: actualDuration,
                silenceRemoved: 0,
                compressionRatio: 1.0,
                speechSegments: 1,
                qualityImprovement: 0,
              },

          // 품질 평가 결과
          qualityScore,
          qualityIssues,
          qualityRecommendations,
        },
        fileName,
        verificationStatus: VerificationStatus.PENDING,
      };

      // 6. Firestore에 저장
      const audioRecordingRef = doc(db, audioCollectionName, recordingId);
      await setDoc(audioRecordingRef, audioRecording);

      return {
        success: true,
        message: "녹음한 음성 제출이 완료되었습니다.",
        recordingId,
        audioUrl,
        fileName,
        fileSize: audioBlob.size,
        sttText: sttTranscription || "stt_failed",
      };
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
