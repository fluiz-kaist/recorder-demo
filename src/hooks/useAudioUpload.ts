// src/hooks/useAudioUpload.ts - 오디오 업로드 커스텀 훅
import { useState } from "react";
import { uploadBlob } from "@/lib/firebase/storage";
import { saveDoc } from "@/lib/firebase/firestore";

interface UploadProgress {
  isUploading: boolean;
  progress: number;
  error: string | null;
  success: boolean;
}

interface AudioMetadata {
  fileName: string;
  duration: number;
  uploadedAt: string;
  fileSize: number;
}

export const useAudioUpload = () => {
  const [uploadState, setUploadState] = useState<UploadProgress>({
    isUploading: false,
    progress: 0,
    error: null,
    success: false,
  });

  const uploadAudio = async (
    audioBlob: Blob,
    fileName: string = `recording_${Date.now()}.wav`,
    duration: number = 0,
    userId?: string
  ): Promise<{ downloadURL: string; fileId: string } | null> => {
    try {
      setUploadState({
        isUploading: true,
        progress: 0,
        error: null,
        success: false,
      });

      console.log("🚀 오디오 업로드 시작:", {
        fileName,
        size: audioBlob.size,
        type: audioBlob.type,
        duration,
      });

      // 진행률 업데이트 (Storage 업로드)
      setUploadState((prev) => ({ ...prev, progress: 25 }));

      // Firebase Storage에 업로드
      const folderPath = userId ? `audio/${userId}` : "audio/anonymous";
      const filePath = `${folderPath}/${fileName}`;

      const { downloadURL } = await uploadBlob(
        audioBlob,
        filePath,
        "audio/wav"
      );

      console.log("✅ Storage 업로드 완료:", downloadURL);

      // 진행률 업데이트 (Firestore 저장)
      setUploadState((prev) => ({ ...prev, progress: 75 }));

      // Firestore에 메타데이터 저장
      const audioMetadata: AudioMetadata = {
        fileName,
        duration,
        uploadedAt: new Date().toISOString(),
        fileSize: audioBlob.size,
      };

      const audioDoc = {
        ...audioMetadata,
        downloadURL,
        filePath,
        userId: userId || "anonymous",
        createdAt: new Date().toISOString(),
      };

      // 문서 ID 생성 (타임스탬프 기반)
      const fileId = `audio_${Date.now()}_${Math.random()
        .toString(36)
        .substr(2, 9)}`;

      await saveDoc("audio_files", fileId, audioDoc);

      console.log("✅ Firestore 메타데이터 저장 완료:", fileId);

      // 완료
      setUploadState({
        isUploading: false,
        progress: 100,
        error: null,
        success: true,
      });

      return { downloadURL, fileId };
    } catch (error) {
      console.error("❌ 오디오 업로드 실패:", error);

      const errorMessage =
        error instanceof Error
          ? error.message
          : "알 수 없는 오류가 발생했습니다.";

      setUploadState({
        isUploading: false,
        progress: 0,
        error: errorMessage,
        success: false,
      });

      return null;
    }
  };

  const resetUploadState = () => {
    setUploadState({
      isUploading: false,
      progress: 0,
      error: null,
      success: false,
    });
  };

  return {
    uploadState,
    uploadAudio,
    resetUploadState,
  };
};
