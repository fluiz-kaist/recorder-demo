// pages/api/audio/upload.ts - 오디오 파일 업로드 API
import { NextApiRequest, NextApiResponse } from "next";
import { IncomingForm } from "formidable";
import { readFile } from "fs/promises";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { storage, db } from "@/lib/firebase/config";
import {
  AudioRecording,
  AudioStatus,
  AudioFormat,
  ScriptType,
} from "@/types/firebase";
import { AudioUploadResponse } from "@/types/api";
// Next.js API Route의 body parser 비활성화 (formidable 사용)
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
      return AudioFormat.WAV; // 기본값
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

    // 필수 필드 검증
    const userId = Array.isArray(fields.userId)
      ? fields.userId[0]
      : fields.userId;
    const scriptId = Array.isArray(fields.scriptId)
      ? fields.scriptId[0]
      : fields.scriptId;
    const scriptType = Array.isArray(fields.scriptType)
      ? fields.scriptType[0]
      : fields.scriptType;
    const duration = Array.isArray(fields.duration)
      ? fields.duration[0]
      : fields.duration;
    const deviceInfo = Array.isArray(fields.deviceInfo)
      ? fields.deviceInfo[0]
      : fields.deviceInfo;
    const browserInfo = Array.isArray(fields.browserInfo)
      ? fields.browserInfo[0]
      : fields.browserInfo;

    if (!userId || !scriptId || !scriptType || !duration) {
      return res.status(400).json({
        success: false,
        message: "필수 필드가 누락되었습니다.",
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
    const recordingId = `${userId}_${scriptType}_${scriptId}_${Date.now()}`;
    const originalFileName = audioFile.originalFilename || "recording.wav";
    const audioFormat = getAudioFormatFromFileName(originalFileName);
    const fileName = `${recordingId}.${audioFormat}`;

    // 파일 읽기
    const fileBuffer = await readFile(audioFile.filepath);
    const fileSize = fileBuffer.length;

    // Firebase Storage에 업로드
    const storageRef = ref(storage, `audio/${userId}/${fileName}`);
    const uploadResult = await uploadBytes(storageRef, fileBuffer, {
      contentType: audioFile.mimetype || "audio/wav",
    });

    // 다운로드 URL 생성
    const audioUrl = await getDownloadURL(uploadResult.ref);

    // STT 처리 (임시로 빈 문자열, 나중에 실제 STT 서비스 연동)
    const sttText = ""; // TODO: 실제 STT 서비스 연동
    const sttConfidence = 0; // TODO: STT 신뢰도

    const now = getKoreanTime();

    // AudioRecording 데이터 생성
    const audioRecording: AudioRecording = {
      id: recordingId,
      userId,
      scriptId: parseInt(scriptId),
      scriptType: scriptType as ScriptType,

      // 오디오 파일 정보
      audioUrl,
      fileName,
      fileSize,
      duration: parseFloat(duration),
      audioFormat,

      // STT 및 분석 결과
      sttText,
      sttConfidence,

      // 시간 정보
      recordedAt: now,
      uploadedAt: now,
      createdAt: now,
      processedAt: sttText ? now : undefined,

      // 상태 정보
      status: sttText ? AudioStatus.COMPLETED : AudioStatus.PROCESSING,

      // 메타데이터
      deviceInfo: deviceInfo || undefined,
      browserInfo: browserInfo || undefined,
      quality:
        fileSize > 1024 * 1024
          ? "high"
          : fileSize > 512 * 1024
          ? "medium"
          : "low",
    };

    // Firestore에 AudioRecording 저장
    const audioRecordingRef = doc(db, "audioRecordings", recordingId);
    await setDoc(audioRecordingRef, {
      ...audioRecording,
      recordedAt: serverTimestamp(),
      uploadedAt: serverTimestamp(),
      processedAt: sttText ? serverTimestamp() : null,
    });

    console.log("오디오 업로드 완료:", {
      recordingId,
      userId,
      scriptId,
      scriptType,
      fileSize,
      duration,
    });

    return res.status(200).json({
      success: true,
      message: "오디오 업로드가 완료되었습니다.",
      recordingId,
      audioUrl,
      fileName,
      fileSize,
      sttText: sttText || undefined,
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
