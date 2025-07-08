// pages/api/whisper-transcribe.ts
import { NextApiRequest, NextApiResponse } from "next";
import formidable, { IncomingForm } from "formidable";
import fs from "fs";
import os from "os";
// form-data 패키지 제거 - 내장 FormData 사용

// API 설정: multipart/form-data를 처리하기 위해 body parser 비활성화
export const config = {
  api: {
    bodyParser: false,
  },
};

interface WhisperTranscriptionResult {
  transcript: string;
  confidence?: number; // Whisper API에서는 confidence를 기본적으로 제공하지 않음
}

interface WhisperSTTResponse {
  success: boolean;
  transcription?: WhisperTranscriptionResult;
  error?: string;
}

// OpenAI Whisper API 응답 타입 정의
interface OpenAIWhisperResponse {
  text: string;
  task?: string;
  language?: string;
  duration?: number;
  segments?: Array<{
    id: number;
    seek: number;
    start: number;
    end: number;
    text: string;
    tokens: number[];
    temperature: number;
    avg_logprob: number;
    compression_ratio: number;
    no_speech_prob: number;
  }>;
}

// 파일 파싱을 위한 Promise 래퍼
const parseForm = (
  req: NextApiRequest
): Promise<{ fields: formidable.Fields; files: formidable.Files }> => {
  return new Promise((resolve, reject) => {
    // 운영체제에 따른 임시 디렉토리 설정
    const tmpDir = process.env.VERCEL ? "/tmp" : os.tmpdir();

    const form = new IncomingForm({
      uploadDir: tmpDir,
      keepExtensions: true,
      maxFileSize: 25 * 1024 * 1024, // 25MB 제한 (Whisper API 제한에 맞춤)
    });

    form.parse(req, (err, fields, files) => {
      if (err) reject(err);
      else resolve({ fields, files });
    });
  });
};

// 지원하는 오디오 포맷 확인
const getSupportedFormat = (filename: string, mimetype: string) => {
  console.log("[o] 오디오 포맷 확인:", { filename, mimetype });

  // 파일 확장자 기반 확인
  const extension = filename?.toLowerCase().split(".").pop();

  // Whisper API 지원 포맷: flac, m4a, mp3, mp4, mpeg, mpga, oga, ogg, wav, webm
  const supportedFormats = [
    "flac",
    "m4a",
    "mp3",
    "mp4",
    "mpeg",
    "mpga",
    "oga",
    "ogg",
    "wav",
    "webm",
  ];

  if (extension && supportedFormats.includes(extension)) {
    console.log("[o] 지원하는 포맷 확인:", extension);
    return extension;
  }

  // MIME 타입 기반 확인
  if (mimetype?.includes("webm")) return "webm";
  if (mimetype?.includes("wav")) return "wav";
  if (mimetype?.includes("mp3")) return "mp3";
  if (mimetype?.includes("mp4")) return "mp4";
  if (mimetype?.includes("ogg")) return "ogg";

  // 기본값: webm
  console.log("[o] 알 수 없는 포맷, webm으로 가정");
  return "webm";
};

// OpenAI Whisper API 호출
const callWhisperAPI = async (
  audioBuffer: Buffer,
  filename: string,
  model: string = "whisper-1",
  language?: string
): Promise<OpenAIWhisperResponse> => {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("OpenAI API 키가 설정되지 않았습니다.");
  }

  // 내장 FormData 사용 (Node.js 18+에서 사용 가능)
  const formData = new FormData();

  // Blob으로 변환하여 파일 추가
  const audioBlob = new Blob([audioBuffer], { type: "audio/webm" });
  formData.append("file", audioBlob, filename);
  formData.append("model", model);

  if (language) {
    formData.append("language", language);
  }

  // 응답 형식을 JSON으로 설정
  formData.append("response_format", "json");
  formData.append("temperature", "0.0"); // 가장 보수적인 설정


  console.log("[o] OpenAI Whisper API 호출 시작");

  try {
    const response = await fetch(
      "https://api.openai.com/v1/audio/transcriptions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          // FormData 사용시 Content-Type은 자동으로 설정됨 (boundary 포함)
        },
        body: formData,
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[o] OpenAI API 오류 응답:", {
        status: response.status,
        statusText: response.statusText,
        body: errorText,
      });

      // OpenAI API 특정 오류 처리
      if (response.status === 400) {
        throw new Error("잘못된 요청입니다. 오디오 파일을 확인해주세요.");
      }
      if (response.status === 401) {
        throw new Error("OpenAI API 키가 유효하지 않습니다.");
      }
      if (response.status === 429) {
        throw new Error(
          "API 요청 한도를 초과했습니다. 잠시 후 다시 시도해주세요."
        );
      }
      if (response.status === 413) {
        throw new Error(
          "파일 크기가 너무 큽니다. 25MB 이하의 파일을 사용해주세요."
        );
      }

      throw new Error(
        `OpenAI API 오류: ${response.status} ${response.statusText}`
      );
    }

    const result = await response.json();
    console.log("[o] OpenAI Whisper API 응답 성공");

    return result;
  } catch (error) {
    console.error("[o] OpenAI Whisper API 호출 실패:", error);
    throw error;
  }
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<WhisperSTTResponse>
) {
  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      error: "Method not allowed. Use POST.",
    });
  }

  let tempFilePath: string | null = null;

  try {
    console.log("[o] Whisper STT API 요청 시작");

    // OpenAI API 키 확인
    if (!process.env.OPENAI_API_KEY) {
      console.error("[o] OpenAI API 키가 설정되지 않음");
      return res.status(500).json({
        success: false,
        error: "OpenAI API 키가 설정되지 않았습니다.",
      });
    }

    // 폼 데이터 파싱
    const { fields, files } = await parseForm(req);
    console.log("[o] 폼 데이터 파싱 완료:", {
      fields: Object.keys(fields),
      files: Object.keys(files),
    });

    // 오디오 파일 확인
    const audioFile = Array.isArray(files.file) ? files.file[0] : files.file;
    if (!audioFile) {
      return res.status(400).json({
        success: false,
        error: "오디오 파일이 업로드되지 않았습니다.",
      });
    }

    tempFilePath = audioFile.filepath; // 임시 파일 경로 저장

    console.log("[o] 오디오 파일 정보:", {
      filepath: audioFile.filepath,
      originalFilename: audioFile.originalFilename,
      mimetype: audioFile.mimetype,
      size: audioFile.size,
    });

    // 파일 크기 확인 (25MB 제한)
    if (audioFile.size > 25 * 1024 * 1024) {
      return res.status(400).json({
        success: false,
        error: "파일 크기가 너무 큽니다. 25MB 이하의 파일을 사용해주세요.",
      });
    }

    // 필드 값 추출
    const model = Array.isArray(fields.model)
      ? fields.model[0]
      : fields.model || "whisper-1";

    const language = Array.isArray(fields.language)
      ? fields.language[0]
      : fields.language; // 언어 코드 (선택사항)

    // 오디오 포맷 확인
    const audioFormat = getSupportedFormat(
      audioFile.originalFilename || "",
      audioFile.mimetype || ""
    );

    // 오디오 파일 읽기
    const audioBuffer = fs.readFileSync(audioFile.filepath);
    console.log("[o] 오디오 파일 읽기 완료, 크기:", audioBuffer.length);

    // 파일명 설정 (확장자 포함)
    const filename = `audio.${audioFormat}`;

    // OpenAI Whisper API 호출
    const whisperResponse = await callWhisperAPI(
      audioBuffer,
      filename,
      model,
      language
    );

    console.log("[o] Whisper API 응답 받음");

    // 결과 처리
    if (!whisperResponse.text || whisperResponse.text.trim() === "") {
      return res.status(200).json({
        success: false,
        error: "음성을 인식할 수 없습니다. 더 명확하게 말씀해 주세요.",
      });
    }

    const transcription: WhisperTranscriptionResult = {
      transcript: whisperResponse.text.trim(),
      // Whisper API는 기본적으로 confidence를 제공하지 않음
      // 필요한 경우 segments의 avg_logprob을 사용하여 계산할 수 있음
    };

    console.log("[o] 변환 결과:", transcription);

    // 성공 응답
    return res.status(200).json({
      success: true,
      transcription,
    });
  } catch (error) {
    console.error("[o] Whisper STT API 오류:", error);

    let errorMessage = "음성 텍스트 변환 중 오류가 발생했습니다.";

    if (error instanceof Error) {
      errorMessage = error.message;

      // 네트워크 오류 처리
      if (error.message.includes("fetch")) {
        errorMessage =
          "OpenAI API 연결에 실패했습니다. 네트워크를 확인해주세요.";
      }

      // 파일 형식 오류 처리
      if (error.message.includes("format") || error.message.includes("codec")) {
        errorMessage =
          "지원하지 않는 오디오 형식입니다. WAV, MP3, WebM 형식을 사용해주세요.";
      }
    }

    return res.status(500).json({
      success: false,
      error: errorMessage,
    });
  } finally {
    // 임시 파일 정리
    if (tempFilePath) {
      try {
        fs.unlinkSync(tempFilePath);
        console.log("[o] 임시 파일 정리 완료");
      } catch (cleanupError) {
        console.warn("[o] 임시 파일 정리 실패:", cleanupError);
      }
    }
  }
}
