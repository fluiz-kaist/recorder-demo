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

  // 기준 완화
  if (
    volumeLevel >= 0.6 && // 0.7 → 0.6
    backgroundNoise === "low" &&
    !hasClipping &&
    duration >= 2 // 3 → 2
  ) {
    return "high";
  }

  if (
    volumeLevel < 0.25 || // 0.4 → 0.25
    backgroundNoise === "high" ||
    hasClipping ||
    duration < 1 // 2 → 1
  ) {
    return "low";
  }

  return "medium";
};
/**
 * 기기 타입 감지
 */
const detectDeviceType = (
  deviceInfo: string
): "iOS" | "Android" | "Desktop" => {
  if (/iPhone|iPad|iPod/i.test(deviceInfo)) return "iOS";
  if (/Android/i.test(deviceInfo)) return "Android";
  return "Desktop";
};

/**
 * 기기별 품질 기준
 */
const DEVICE_QUALITY_STANDARDS = {
  iOS: {
    expectedBitrate: 180,
    volumeThresholds: { veryLow: 0.2, low: 0.4, medium: 0.6, high: 0.8 },
  },
  Android: {
    expectedBitrate: 150,
    volumeThresholds: { veryLow: 0.15, low: 0.3, medium: 0.5, high: 0.7 },
  },
  Desktop: {
    expectedBitrate: 280,
    volumeThresholds: { veryLow: 0.18, low: 0.35, medium: 0.55, high: 0.75 },
  },
};

/**
 * 클라이언트에서 음성 품질 분석
 */
const analyzeAudioQuality = async (
  audioBlob: Blob,
  duration: number,
  audioFormat: AudioFormat,
  deviceInfo?: string,
  vadApplied?: boolean,
  compressionRatio?: number,
  sttTranscription?: string
): Promise<{
  volumeLevel: number;
  hasClipping: boolean;
  backgroundNoise: "low" | "medium" | "high";
  qualityGrade: "high" | "medium" | "low";
}> => {
  const fileSize = audioBlob.size;

  // 1. 기기 타입 감지
  const deviceType = detectDeviceType(deviceInfo || "");
  const standards = DEVICE_QUALITY_STANDARDS[deviceType];

  // 2. 기기별 기대 비트레이트 설정
  const formatMultipliers = {
    [AudioFormat.WAV]: 1.0, // 기준값 그대로
    [AudioFormat.MP3]: 0.4, // 압축률 고려
    [AudioFormat.M4A]: 0.4,
    [AudioFormat.WEBM]: 0.35,
  };

  const expectedBitrate =
    standards.expectedBitrate * (formatMultipliers[audioFormat] || 0.4);
  const actualBitrate = (fileSize * 8) / (duration * 1000);

  // 3. 개선된 volumeLevel 계산
  let volumeLevel: number;

  if (actualBitrate >= expectedBitrate * 1.2) {
    volumeLevel = 0.9; // 매우 높은 품질
  } else if (actualBitrate >= expectedBitrate) {
    volumeLevel = 0.8; // 높은 품질
  } else if (actualBitrate >= expectedBitrate * 0.7) {
    volumeLevel = 0.6; // 양호한 품질
  } else if (actualBitrate >= expectedBitrate * 0.4) {
    volumeLevel = 0.4; // 보통 품질
  } else if (actualBitrate >= expectedBitrate * 0.2) {
    volumeLevel = 0.2; // 낮은 품질
  } else {
    volumeLevel = 0.1; // 매우 낮은 품질
  }

  // 4. VAD 처리 보정 (극단적인 경우 특별 처리)
  if (vadApplied && compressionRatio !== undefined) {
    if (compressionRatio < 0.001) {
      // 거의 100% 무음 제거된 경우 → 실제 음성 구간은 매우 선명했을 가능성
      console.log("극단적인 VAD 처리 감지 - 특별 보정 적용");
      volumeLevel = Math.max(volumeLevel, 0.5); // 최소 50% 보장

      // STT 성공 여부로 추가 보정
      if (sttTranscription && sttTranscription.length > 5) {
        volumeLevel = Math.max(volumeLevel, 0.6); // STT 성공시 최소 60%
      }
    } else if (compressionRatio < 0.6) {
      // 일반적인 VAD 보정
      const vadBoost = deviceType === "iOS" ? 1.15 : 1.1; // 보정값 감소
      volumeLevel = Math.min(volumeLevel * vadBoost, 0.95);
    }
  }
  // 5. Android 저사양 기기 특별 보정
  if (deviceType === "Android" && actualBitrate < 100) {
    // 매우 낮은 비트레이트의 Android 기기에 대한 관대한 평가
    volumeLevel = Math.max(volumeLevel, Math.min(actualBitrate / 120, 0.6));
  }

  // 6. 클리핑 검출 개선
  const hasClipping = actualBitrate > expectedBitrate * 3.0;

  // 7. 배경잡음 평가 개선
  let backgroundNoise: "low" | "medium" | "high" = "low";

  if (duration < 1) {
    backgroundNoise = "high";
  } else if (vadApplied && compressionRatio) {
    if (compressionRatio < 0.3) {
      backgroundNoise = "low"; // 70% 이상 제거 = 매우 조용한 환경
    } else if (compressionRatio < 0.7) {
      backgroundNoise =
        actualBitrate < expectedBitrate * 0.5 ? "medium" : "low";
    } else {
      backgroundNoise =
        actualBitrate < expectedBitrate * 0.6 ? "high" : "medium";
    }
  } else {
    // VAD 미적용시 기존 로직 개선
    if (actualBitrate < expectedBitrate * 0.3) {
      backgroundNoise = "high";
    } else if (actualBitrate < expectedBitrate * 0.6) {
      backgroundNoise = "medium";
    }
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
      // eh
      enhancedAudioBlob,
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
        audioFormat,
        deviceInfo,
        vadApplied,
        compressionRatio,
        sttTranscription
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

      // 업로드 작업들 준비
      const uploadTasks = [
        uploadBytes(storageRef, audioBlob, {
          contentType: audioBlob.type || "audio/wav",
        }),
      ];

      // enhanced 파일이 있으면 업로드 목록에 추가 (URL은 불필요)
      if (enhancedAudioBlob && enhancedAudioBlob instanceof Blob) {
        uploadTasks.push(
          uploadBytes(EHstorageRef, enhancedAudioBlob, {
            contentType: enhancedAudioBlob.type || "audio/wav",
          })
        );
      }

      // 병렬 업로드 실행
      const uploadResults = await Promise.all(uploadTasks);
      console.log("모든 업로드 완료");

      // 4. 원본 파일만 다운로드 URL 생성
      const audioUrl = await getDownloadURL(uploadResults[0].ref);

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
