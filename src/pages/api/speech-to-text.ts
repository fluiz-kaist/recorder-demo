// pages/api/speech-to-text.ts
import { NextApiRequest, NextApiResponse } from "next";
import { SpeechClient } from "@google-cloud/speech";
import formidable, { IncomingForm } from "formidable";
import fs from "fs";

// API 설정: multipart/form-data를 처리하기 위해 body parser 비활성화
export const config = {
  api: {
    bodyParser: false,
  },
};

interface TranscriptionResult {
  transcript: string;
  confidence: number;
}

interface STTResponse {
  success: boolean;
  transcription?: TranscriptionResult;
  error?: string;
}

// Google Cloud Speech 클라이언트 초기화
let speechClient: SpeechClient;

try {
  // Vercel 환경에서는 환경변수로 서비스 계정 키를 전달
  if (process.env.GCP_CREDENTIALS_JSON) {
    const credentials = JSON.parse(process.env.GCP_CREDENTIALS_JSON);
    speechClient = new SpeechClient({
      credentials,
      projectId: credentials.project_id,
    });
  } else if (process.env.GCP_CREDENTIALS_JSON) {
    // 로컬 개발 환경에서는 파일 경로 사용
    speechClient = new SpeechClient({
      keyFilename: process.env.GCP_CREDENTIALS_JSON,
    });
  } else {
    throw new Error("Google Cloud 인증 정보가 설정되지 않았습니다.");
  }
} catch (error) {
  console.error("Google Speech Client 초기화 실패:", error);
}

// 파일 파싱을 위한 Promise 래퍼
const parseForm = (
  req: NextApiRequest
): Promise<{ fields: formidable.Fields; files: formidable.Files }> => {
  return new Promise((resolve, reject) => {
    // 운영체제에 따른 임시 디렉토리 설정
    const tmpDir = process.env.VERCEL ? "/tmp" : require("os").tmpdir();

    const form = new IncomingForm({
      uploadDir: tmpDir,
      keepExtensions: true,
      maxFileSize: 10 * 1024 * 1024, // 10MB 제한
    });

    form.parse(req, (err, fields, files) => {
      if (err) reject(err);
      else resolve({ fields, files });
    });
  });
};

// 파일 타입 및 인코딩 감지
const detectAudioFormat = (filename: string, mimetype: string) => {
  console.log("🔍 오디오 포맷 감지:", { filename, mimetype });

  // 파일 확장자 기반 감지
  const extension = filename?.toLowerCase().split(".").pop();

  // MIME 타입 기반 감지
  if (mimetype?.includes("webm")) {
    console.log("✅ WebM 포맷 감지");
    return {
      encoding: "WEBM_OPUS" as const,
      sampleRateHertz: 48000, // WebM Opus 기본 샘플레이트
    };
  }

  if (mimetype?.includes("wav") || extension === "wav") {
    console.log("✅ WAV 포맷 감지");
    return {
      encoding: "LINEAR16" as const,
      sampleRateHertz: 16000, // WAV 기본 샘플레이트
    };
  }

  if (mimetype?.includes("mp3") || extension === "mp3") {
    console.log("✅ MP3 포맷 감지");
    return {
      encoding: "MP3" as const,
    };
  }

  if (mimetype?.includes("flac") || extension === "flac") {
    console.log("✅ FLAC 포맷 감지");
    return {
      encoding: "FLAC" as const,
    };
  }

  // 기본값: WebM (새로운 기본값)
  console.log("⚠️ 알 수 없는 포맷, WebM으로 가정");
  return {
    encoding: "WEBM_OPUS" as const,
    sampleRateHertz: 48000,
  };
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<STTResponse>
) {
  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      error: "Method not allowed. Use POST.",
    });
  }

  try {
    console.log("🗣️ STT API 요청 시작");

    // Speech Client 확인
    if (!speechClient) {
      console.error("❌ Speech Client가 초기화되지 않음");
      return res.status(500).json({
        success: false,
        error: "Google Cloud Speech 서비스를 초기화할 수 없습니다.",
      });
    }

    // 폼 데이터 파싱
    const { fields, files } = await parseForm(req);
    console.log("📄 폼 데이터 파싱 완료:", {
      fields: Object.keys(fields),
      files: Object.keys(files),
    });

    // 오디오 파일 확인
    const audioFile = Array.isArray(files.audio) ? files.audio[0] : files.audio;
    if (!audioFile) {
      return res.status(400).json({
        success: false,
        error: "오디오 파일이 업로드되지 않았습니다.",
      });
    }

    console.log("🎵 오디오 파일 정보:", {
      filepath: audioFile.filepath,
      originalFilename: audioFile.originalFilename,
      mimetype: audioFile.mimetype,
      size: audioFile.size,
    });

    // 언어 코드 가져오기 (기본값: 한국어)
    const languageCode = Array.isArray(fields.languageCode)
      ? fields.languageCode[0]
      : fields.languageCode || "ko-KR";

    // 오디오 포맷 감지
    const audioFormat = detectAudioFormat(
      audioFile.originalFilename || "",
      audioFile.mimetype || ""
    );

    // 오디오 파일 읽기
    const audioBytes = fs.readFileSync(audioFile.filepath);
    console.log("📖 오디오 파일 읽기 완료, 크기:", audioBytes.length);

    // Google STT 요청 설정
    const request = {
      audio: {
        content: audioBytes.toString("base64"),
      },
      config: {
        encoding: audioFormat.encoding,
        ...(audioFormat.sampleRateHertz && {
          sampleRateHertz: audioFormat.sampleRateHertz,
        }),
        languageCode: languageCode,
        enableAutomaticPunctuation: true, // 자동 구두점 추가
        model: "latest_long", // 긴 형식 모델 사용
        useEnhanced: true, // 향상된 모델 사용
        // WebM의 경우 추가 설정
        ...(audioFormat.encoding === "WEBM_OPUS" && {
          enableSeparateRecognitionPerChannel: false, // 모노 채널 처리
        }),
      },
    };

    console.log("🚀 Google STT API 호출 시작", {
      encoding: audioFormat.encoding,
      sampleRate: audioFormat.sampleRateHertz,
      languageCode,
    });

    // Google STT API 호출
    const [response] = await speechClient.recognize(request);

    console.log("✅ Google STT API 응답 받음:", {
      resultsCount: response.results?.length || 0,
    });

    // 결과 처리
    if (!response.results || response.results.length === 0) {
      return res.status(200).json({
        success: false,
        error: "음성을 인식할 수 없습니다. \n더 명확하게 말씀해 주세요.",
      });
    }

    // 가장 신뢰도가 높은 결과 선택
    const bestResult = response.results[0];
    const bestAlternative = bestResult.alternatives?.[0];

    if (!bestAlternative || !bestAlternative.transcript) {
      return res.status(200).json({
        success: false,
        error: "텍스트 변환 결과를 찾을 수 없습니다.",
      });
    }

    const transcription: TranscriptionResult = {
      transcript: bestAlternative.transcript,
      confidence: bestAlternative.confidence || 0,
    };

    console.log("📝 변환 결과:", transcription);

    // 임시 파일 정리
    try {
      fs.unlinkSync(audioFile.filepath);
      console.log("🧹 임시 파일 정리 완료");
    } catch (cleanupError) {
      console.warn("⚠️ 임시 파일 정리 실패:", cleanupError);
    }

    // 성공 응답
    return res.status(200).json({
      success: true,
      transcription,
    });
  } catch (error) {
    console.error("❌ STT API 오류:", error);

    let errorMessage = "음성 텍스트 변환 중 오류가 발생했습니다.";

    if (error instanceof Error) {
      errorMessage = error.message;

      // WebM 관련 특정 오류 처리
      if (
        error.message.includes("WEBM") ||
        error.message.includes("encoding")
      ) {
        errorMessage =
          "WebM 오디오 포맷 처리 중 오류가 발생했습니다. WAV 포맷을 사용해보세요.";
      }
    }

    return res.status(500).json({
      success: false,
      error: errorMessage,
    });
  }
}
