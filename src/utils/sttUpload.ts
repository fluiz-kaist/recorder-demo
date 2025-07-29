export const performSTTForUpload = async (
  audioBlob: Blob
): Promise<string | null> => {
  try {
    const formData = new FormData();
    formData.append("file", audioBlob, "recording.webm");
    formData.append("model", "whisper-1");
    formData.append("language", "ko");
    formData.append("response_format", "json");

    const response = await fetch("/api/stt/whisper-transcribe", {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    return result.success ? result.transcription?.transcript : null;
  } catch (error) {
    console.error("Upload STT failed:", error);
    return null;
  }
};
