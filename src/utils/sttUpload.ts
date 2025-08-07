interface STTSuccessResponse {
  success: true;
  transcription: { transcript: string; confidence?: number };
}

interface STTErrorResponse {
  success: false;
  error: string;
}

export const performSTTForUpload = async (
  audioBlob: Blob,
  signal?: AbortSignal
): Promise<STTSuccessResponse | STTErrorResponse> => {
  try {
    const formData = new FormData();
    formData.append("file", audioBlob, "recording.webm");
    formData.append("model", "whisper-1");
    formData.append("language", "ko");
    formData.append("response_format", "json");

    const options: RequestInit = {
      method: "POST",
      body: formData,
    };

    if (signal) {
      options.signal = signal;
    }

    const response = await fetch("/api/stt/whisper-transcribe", options);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    // return result.success ? result.transcription?.transcript : null;

    // API 응답 객체를 그대로 반환
    return result;
  } catch (error) {
    console.error("Upload STT failed:", error);
    // 예기치 않은 오류가 발생했을 경우, 일관된 형식으로 반환
    let errorMessage = "음성 텍스트 변환 중 예상치 못한 오류가 발생했습니다.";
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    return { success: false, error: errorMessage };
  }
};
