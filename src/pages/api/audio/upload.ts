// pages/api/audio/upload.ts - 새로운 구조에 맞춘 오디오 업로드 API

import { NextApiRequest, NextApiResponse } from "next";
import { IncomingForm } from "formidable";
import { readFile } from "fs/promises";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { doc, setDoc, serverTimestamp, getDoc } from "firebase/firestore";
import { storage, db } from "@/lib/firebase/config";
import { VerificationStatus, AudioFormat } from "@/types/audio";
import { AudioUploadResponse } from "@/types/api";
import { AudioRecording } from "@/types/audio";
const audioCollectionName =
  process.env.NEXT_PUBLIC_DB_AUDIO_RECORDINGS_COLLECTION || "recording-temp";
// Next.js API Route의 body parser 비활성화
export const config = {
  api: {
    bodyParser: false,
  },
};

/**
 * 파일 확장자에서 오디오 포맷 추출
 */
const getAudioFormatFromFileName = (fileName: string): AudioFormat => {
  const extension = fileName.split(".").pop()?.toLowerCase();
  switch (extension) {
    case "wav":
      return AudioFormat.WAV;
    case "mp3":
      return AudioFormat.MP3;
    case "m4a":
      return AudioFormat.M4A;
    case "webm":
      return AudioFormat.WEBM;
    default:
      return AudioFormat.WAV;
  }
};

/**
 * 품질 등급 계산 함수 (조회 API와 동일한 로직)
 */
const calculateQualityGrade = (qualityCheck: {
  volumeLevel: number;
  backgroundNoise: "low" | "medium" | "high";
  hasClipping: boolean;
  duration: number;
}): "high" | "medium" | "low" => {
  const { volumeLevel, backgroundNoise, hasClipping, duration } = qualityCheck;

  // 고품질 조건
  if (
    volumeLevel >= 0.7 &&
    backgroundNoise === "low" &&
    !hasClipping &&
    duration >= 3
  ) {
    return "high";
  }

  // 저품질 조건
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
 * 향상된 음성 품질 분석
 */
const analyzeAudioQuality = (
  fileBuffer: Buffer,
  duration: number,
  audioFormat: AudioFormat
): {
  volumeLevel: number;
  hasClipping: boolean;
  backgroundNoise: "low" | "medium" | "high";
  qualityGrade: "high" | "medium" | "low"; // 추가!
} => {
  const fileSize = fileBuffer.length;

  // 포맷별 예상 비트레이트 (더 정확한 계산)
  const expectedBitrates = {
    [AudioFormat.WAV]: 1411, // kbps (CD 품질)
    [AudioFormat.MP3]: 128, // kbps (일반적인 MP3)
    [AudioFormat.M4A]: 128, // kbps
    [AudioFormat.WEBM]: 128, // kbps
  };

  const expectedBitrate = expectedBitrates[audioFormat] || 128;
  const expectedFileSize = (expectedBitrate * 1000 * duration) / 8; // bytes
  const actualBitrate = (fileSize * 8) / (duration * 1000); // kbps

  // 실제 비트레이트 기반 음량 추정
  const volumeLevel = Math.min(actualBitrate / expectedBitrate, 1);

  // 클리핑 감지 개선
  const hasClipping = volumeLevel > 0.98 || fileSize > expectedFileSize * 1.5;

  // 배경 소음 추정 개선
  let backgroundNoise: "low" | "medium" | "high" = "low";

  // 파일 크기가 예상보다 너무 크면 노이즈 의심
  if (fileSize > expectedFileSize * 2) {
    backgroundNoise = "high";
  } else if (volumeLevel < 0.3) {
    backgroundNoise = "high";
  } else if (volumeLevel < 0.6 || fileSize > expectedFileSize * 1.3) {
    backgroundNoise = "medium";
  }

  // 최소 녹음 시간 체크
  if (duration < 1) {
    backgroundNoise = "high"; // 너무 짧으면 품질 문제로 간주
  }

  const qualityResult = {
    volumeLevel: Math.round(volumeLevel * 100) / 100,
    hasClipping,
    backgroundNoise,
  };

  // 품질 등급 미리 계산
  const qualityGrade = calculateQualityGrade({
    ...qualityResult,
    duration,
  });

  return {
    ...qualityResult,
    qualityGrade, // 추가!
  };
};

const parseNumber = (
  value: string | undefined,
  defaultValue: number = 0
): number => {
  if (!value) return defaultValue;
  const parsed = parseFloat(value);
  return isNaN(parsed) ? defaultValue : parsed;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<AudioUploadResponse>
) {
  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      message: "Method not allowed",
      recordingId: "",
      audioUrl: "",
      fileName: "",
      fileSize: 0,
    });
  }

  try {
    // formidable로 multipart/form-data 파싱
    const form = new IncomingForm({
      maxFileSize: 50 * 1024 * 1024, // 50MB 제한
      allowEmptyFiles: false,
    });

    const [fields, files] = await form.parse(req);

    // 필수 필드 추출
    const userId = Array.isArray(fields.userId)
      ? fields.userId[0]
      : fields.userId;
    const taskKey = Array.isArray(fields.taskKey)
      ? fields.taskKey[0]
      : fields.taskKey;
    const taskType = Array.isArray(fields.taskType)
      ? fields.taskType[0]
      : fields.taskType;
    const originalScript = Array.isArray(fields.originalScript)
      ? fields.originalScript[0]
      : fields.originalScript;

    // === 녹음 세션 정보 파싱 추가 ===
    const recordingStartedAt = Array.isArray(fields.recordingStartedAt)
      ? fields.recordingStartedAt[0]
      : fields.recordingStartedAt;
    const recordingEndedAt = Array.isArray(fields.recordingEndedAt)
      ? fields.recordingEndedAt[0]
      : fields.recordingEndedAt;

    const actualDurationRaw = Array.isArray(fields.actualDuration)
      ? fields.actualDuration[0]
      : fields.actualDuration;
    const sessionDurationRaw = Array.isArray(fields.sessionDuration)
      ? fields.sessionDuration[0]
      : fields.sessionDuration;

    const actualDuration = parseNumber(actualDurationRaw, 0);
    const sessionDuration = parseNumber(sessionDurationRaw, 0);
    // 스크립트 메타데이터
    const domain = Array.isArray(fields.domain)
      ? fields.domain[0]
      : fields.domain;
    const intent = Array.isArray(fields.intent)
      ? fields.intent[0]
      : fields.intent;
    const category = Array.isArray(fields.category)
      ? fields.category[0]
      : fields.category;

    // 화자 정보
    const gender = Array.isArray(fields.gender)
      ? fields.gender[0]
      : fields.gender;
    const ageGroup = Array.isArray(fields.ageGroup)
      ? fields.ageGroup[0]
      : fields.ageGroup;

    const userName = Array.isArray(fields.userName)
      ? fields.userName[0]
      : fields.userName;

    const sttTranscriptionRaw = Array.isArray(fields.sttTranscription)
      ? fields.sttTranscription[0]
      : fields.sttTranscription;

    const sttTranscription =
      typeof sttTranscriptionRaw === "string" &&
      sttTranscriptionRaw.trim() !== ""
        ? sttTranscriptionRaw
        : "클라이언트에서 STT 결과를 아직 보내지 않았습니다";

    // 선택적 필드
    const deviceInfo = Array.isArray(fields.deviceInfo)
      ? fields.deviceInfo[0]
      : fields.deviceInfo;

    // 필수 필드 검증
    const missingFields: string[] = [];

    if (!userId) missingFields.push("userId");
    if (!taskKey) missingFields.push("taskKey");
    if (!taskType) missingFields.push("taskType");
    if (!originalScript) missingFields.push("originalScript");
    if (!domain) missingFields.push("domain");
    if (!intent) missingFields.push("intent");
    if (!category) missingFields.push("category");
    if (!gender) missingFields.push("gender");
    if (!ageGroup) missingFields.push("ageGroup");
    if (!userName) missingFields.push("userName");
    if (!recordingStartedAt) missingFields.push("recordingStartedAt");
    if (!recordingEndedAt) missingFields.push("recordingEndedAt");
    if (!actualDuration) missingFields.push("actualDuration");
    if (!sessionDuration) missingFields.push("sessionDuration");

    if (missingFields.length > 0) {
      console.warn("❗ 누락된 필수 필드:", missingFields.join(", "));
      return res.status(400).json({
        success: false,
        message: `필수 필드가 누락되었습니다: ${missingFields.join(", ")}`,
        recordingId: "",
        audioUrl: "",
        fileName: "",
        fileSize: 0,
      });
    }
    // taskType 검증
    if (taskType !== "situational" && taskType !== "formal") {
      return res.status(400).json({
        success: false,
        message: "유효하지 않은 태스크 타입입니다.",
        recordingId: "",
        audioUrl: "",
        fileName: "",
        fileSize: 0,
      });
    }

    // 업로드된 파일 검증
    const audioFile = Array.isArray(files.audio) ? files.audio[0] : files.audio;
    if (!audioFile) {
      return res.status(400).json({
        success: false,
        message: "오디오 파일이 없습니다.",
        recordingId: "",
        audioUrl: "",
        fileName: "",
        fileSize: 0,
      });
    }

    // 타입 가드 함수 추가
    const ensureString = (
      value: string | undefined,
      fieldName: string
    ): string => {
      if (!value) {
        throw new Error(`${fieldName} is required but undefined`);
      }
      return value;
    };

    const ensuredTaskKey = ensureString(taskKey, "taskKey");

    // 고유한 recording ID 생성
    const recordingId = `${userId}_${ensuredTaskKey.replace(
      /[^a-zA-Z0-9]/g,
      "_"
    )}_${Date.now()}`;
    const originalFileName = audioFile.originalFilename || "recording.wav";
    const audioFormat = getAudioFormatFromFileName(originalFileName);
    const fileName = `${recordingId}.${audioFormat}`;

    // 파일 읽기 및 분석
    const fileBuffer = await readFile(audioFile.filepath);
    const fileSize = fileBuffer.length;

    // 품질 분석
    const qualityAnalysis = analyzeAudioQuality(
      fileBuffer,
      actualDuration,
      audioFormat
    );

    // Firebase Storage에 업로드
    const collectionName =
      process.env.NEXT_PUBLIC_STOREAGE_RECORDING_FILES_COLLECTION ||
      "temp-recording_files";
    const storageRef = ref(
      storage,
      `${collectionName}/${domain}/${taskKey}/${userId}/${fileName}`
    );
    const uploadResult = await uploadBytes(storageRef, fileBuffer, {
      contentType: audioFile.mimetype || "audio/wav",
    });

    // 다운로드 URL 생성
    const audioUrl = await getDownloadURL(uploadResult.ref);

    // AudioRecording 데이터 생성
    const audioRecording: AudioRecording = {
      id: recordingId,
      userId: ensureString(userId, "userId"),
      taskKey: ensuredTaskKey,
      taskType: taskType as "situational" | "formal",
      audioUrl,

      // 녹음 세션 정보
      recordingSession: {
        startedAt: ensureString(recordingStartedAt, "recordingStartedAt"),
        endedAt: ensureString(recordingEndedAt, "recordingEndedAt"),

        actualDuration,
        sessionDuration,
      },

      uploadedAt: serverTimestamp(), // 서버에서 설정

      // 텍스트 데이터
      textData: {
        originalScript: ensureString(originalScript, "originalScript"),
        sttTranscription,
        domain: ensureString(domain, "domain"),
        intent: ensureString(intent, "intent"),
        category: ensureString(category, "category"),
      },

      // 화자 정보
      speakerInfo: {
        gender: gender as "남성" | "여성" | "불명",
        ageGroup: ensureString(ageGroup, "ageGroup"),
        userName: ensureString(userName, "userName"),
      },

      // 품질 체크
      qualityCheck: {
        duration: actualDuration,
        fileSize,
        volumeLevel: qualityAnalysis.volumeLevel,
        hasClipping: qualityAnalysis.hasClipping,
        backgroundNoise: qualityAnalysis.backgroundNoise,
        audioFormat,
        deviceInfo: deviceInfo || "undefined_device",
        qualityGrade: qualityAnalysis.qualityGrade || "unknown",
      },

      fileName,
      verificationStatus: VerificationStatus.PENDING,
    };

    // Firestore에 AudioRecording 저장
    const audioRecordingRef = doc(
      db,
      audioCollectionName, // 단일 컬렉션
      recordingId
    );
    await setDoc(audioRecordingRef, {
      ...audioRecording,
    });

    console.log("오디오 업로드 완료:", {
      recordingId,
      userId,
      taskKey,
      taskType,
      fileSize,
      duration: actualDuration,
      qualityScore: qualityAnalysis,
    });

    return res.status(200).json({
      success: true,
      message: "녹음한 음성 제출이 완료되었습니다.",
      recordingId,
      audioUrl,
      fileName,
      fileSize,
      sttText: sttTranscription || "stt_failed",
    });
  } catch (error) {
    console.error("오디오 업로드 중 오류:", error);

    return res.status(500).json({
      success: false,
      message: "녹음한 음성 파일 제출 중 오류가 발생했습니다.",
      recordingId: "",
      audioUrl: "",
      fileName: "",
      fileSize: 0,
    });
  }
}
