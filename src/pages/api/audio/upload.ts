// pages/api/audio/upload.ts - 새로운 구조에 맞춘 오디오 업로드 API

import { NextApiRequest, NextApiResponse } from "next";
import { IncomingForm } from "formidable";
import { readFile } from "fs/promises";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { doc, setDoc, serverTimestamp, getDoc } from "firebase/firestore";
import { storage, db } from "@/lib/firebase/config";
import { AudioStatus, AudioFormat } from "@/types/firebase";
import { AudioUploadResponse } from "@/types/api";
import { AudioRecording } from "@/types/audio";
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
 * 한국 시간 생성 함수
 */
const getKoreanTime = (): string => {
  const now = new Date();
  const koreanTime = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return koreanTime.toISOString();
};

/**
 * 기본 음성 품질 분석 (간단한 버전)
 */
const analyzeAudioQuality = (
  fileBuffer: Buffer,
  duration: number
): {
  volumeLevel: number;
  hasClipping: boolean;
  backgroundNoise: "low" | "medium" | "high";
} => {
  // 간단한 품질 분석 (실제로는 더 정교한 분석 필요)
  const fileSize = fileBuffer.length;

  // 파일 크기와 길이 기반으로 대략적인 음량 계산
  const bytesPerSecond = fileSize / duration;
  const volumeLevel = Math.min(bytesPerSecond / 16000, 1); // 16kbps 기준 정규화

  // 간단한 클리핑 감지 (파일 크기 기반 추정)
  const hasClipping = volumeLevel > 0.95;

  // 배경 소음 추정 (파일 크기와 음량의 비율로 추정)
  let backgroundNoise: "low" | "medium" | "high" = "low";
  if (volumeLevel < 0.3) backgroundNoise = "high";
  else if (volumeLevel < 0.6) backgroundNoise = "medium";

  return {
    volumeLevel: Math.round(volumeLevel * 100) / 100,
    hasClipping,
    backgroundNoise,
  };
};

/**
 * STT 처리 (임시 구현 - 실제로는 Google Speech-to-Text API 등 사용)
 */
const performSTT = async (audioBuffer: Buffer): Promise<string> => {
  // TODO: 실제 STT 서비스 연동
  // 임시로 빈 문자열 반환
  return "클라이언트에서해서보낼겁니다";
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

    // 선택적 필드
    const deviceInfo = Array.isArray(fields.deviceInfo)
      ? fields.deviceInfo[0]
      : fields.deviceInfo;

    // 필수 필드 검증
    if (
      !userId ||
      !taskKey ||
      !taskType ||
      !originalScript ||
      !domain ||
      !intent ||
      !category ||
      !gender ||
      !ageGroup
    ) {
      return res.status(400).json({
        success: false,
        message: "필수 필드가 누락되었습니다.",
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

    // 고유한 recording ID 생성
    const recordingId = `${userId}_${taskKey.replace(
      /[^a-zA-Z0-9]/g,
      "_"
    )}_${Date.now()}`;
    const originalFileName = audioFile.originalFilename || "recording.wav";
    const audioFormat = getAudioFormatFromFileName(originalFileName);
    const fileName = `${recordingId}.${audioFormat}`;

    // 파일 읽기 및 분석
    const fileBuffer = await readFile(audioFile.filepath);
    const fileSize = fileBuffer.length;

    // 오디오 길이 추정 (실제로는 더 정확한 분석 필요)
    const estimatedDuration = fileSize / 16000; // 16kbps 기준 추정

    // 품질 분석
    const qualityAnalysis = analyzeAudioQuality(fileBuffer, estimatedDuration);

    // Firebase Storage에 업로드
    const storageRef = ref(
      storage,
      `recordingsV2/${domain}/${taskKey}/${userId}/${fileName}`
    );
    const uploadResult = await uploadBytes(storageRef, fileBuffer, {
      contentType: audioFile.mimetype || "audio/wav",
    });

    // 다운로드 URL 생성
    const audioUrl = await getDownloadURL(uploadResult.ref);

    // STT 처리
    const sttTranscription = await performSTT(fileBuffer);

    const now = getKoreanTime();

    // AudioRecording 데이터 생성
    const audioRecording: AudioRecording = {
      id: recordingId,
      userId,
      taskKey,
      taskType: taskType as "situational" | "formal",
      audioUrl,
      recordedAt: now,
      uploadedAt: now,

      // 텍스트 데이터
      textData: {
        originalScript,
        sttTranscription,
        domain,
        intent,
        category,
      },

      // 화자 정보
      speakerInfo: {
        gender: gender as "male" | "female",
        ageGroup,
      },

      // 품질 체크
      qualityCheck: {
        duration: estimatedDuration,
        fileSize,
        volumeLevel: qualityAnalysis.volumeLevel,
        hasClipping: qualityAnalysis.hasClipping,
        backgroundNoise: qualityAnalysis.backgroundNoise,
        audioFormat,
        deviceInfo: deviceInfo || "undefined_device",
      },

      fileName,
      status: sttTranscription ? AudioStatus.COMPLETED : AudioStatus.PROCESSING,
    };

    // Firestore에 AudioRecording 저장
    const audioRecordingRef = doc(
      db,
      "audioRecordingsV2", // 단일 컬렉션
      recordingId
    );
    await setDoc(audioRecordingRef, {
      ...audioRecording,
      recordedAt: serverTimestamp(),
      uploadedAt: serverTimestamp(),
      processedAt: sttTranscription ? serverTimestamp() : null,
    });

    // // 사용자의 진행 상태 업데이트 (간단화)
    // try {
    //   const userRef = doc(db, "usersV2", userId);
    //   const userDoc = await getDoc(userRef);

    //   if (userDoc.exists()) {
    //     // 실제로는 더 복잡한 로직으로 사용자의 RecordingTask 상태 업데이트
    //     // 여기서는 간단하게 처리
    //     console.log(`사용자 ${userId}의 태스크 ${taskKey} 완료 처리`);
    //   }
    // } catch (updateError) {
    //   console.error("사용자 상태 업데이트 실패:", updateError);
    //   // 오디오 업로드는 성공했으므로 에러를 던지지 않음
    // }

    console.log("오디오 업로드 완료:", {
      recordingId,
      userId,
      taskKey,
      taskType,
      fileSize,
      duration: estimatedDuration,
      qualityScore: qualityAnalysis,
    });

    return res.status(200).json({
      success: true,
      message: "오디오 업로드가 완료되었습니다.",
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
      message: "오디오 업로드 중 오류가 발생했습니다.",
      recordingId: "",
      audioUrl: "",
      fileName: "",
      fileSize: 0,
    });
  }
}
