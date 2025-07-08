import React, { useState, useEffect, useCallback } from "react";
import styles from "@/styles/SttCompo.module.css";
import ErrorPopup from "@/components/ErrorPopup";

export interface GoogleTranscriptionResult {
  transcript: string;
  confidence: number;
}

export interface STTResponse {
  success: boolean;
  transcription?: GoogleTranscriptionResult;
  error?: string;
}

// STT 컴포넌트
const SttGoogle: React.FC<{
  audioBlob: Blob | null;
  onTranscriptionComplete: (result: GoogleTranscriptionResult | null) => void;
  onError: (error: string) => void;
  autoTranscribe?: boolean; // 자동 변환 여부 추가
  onTranscribingStateChange?: (isTranscribing: boolean) => void; // 새로 추가
}> = ({
  audioBlob,
  onTranscriptionComplete,
  onError,
  autoTranscribe = false,
  onTranscribingStateChange, // 새로 추가
}) => {
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [showErrorPopup, setShowErrorPopup] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [hasTranscribed, setHasTranscribed] = useState(false); // 이미 변환했는지 추적

  // isTranscribing 상태가 변경될 때마다 부모에게 알림
  useEffect(() => {
    onTranscribingStateChange?.(isTranscribing);
  }, [isTranscribing, onTranscribingStateChange]);

  // 에러 처리 함수
  const handleError = (error: string) => {
    setErrorMessage(error);
    setShowErrorPopup(true);
    onError(error);
  };

  // 에러 팝업 닫기
  const closeErrorPopup = () => {
    setShowErrorPopup(false);
    setErrorMessage("");
  };

  // 에러 메시지 포맷팅
  const formatErrorMessage = (error: Error | string): string => {
    if (typeof error === "string") {
      return error;
    }

    // HTTP 상태 코드별 메시지
    if (error.message.includes("status: 400")) {
      return "잘못된 요청입니다. 오디오 파일을 확인해주세요.";
    }
    if (error.message.includes("status: 401")) {
      return "인증에 실패했습니다. 설정을 확인해주세요.";
    }
    if (error.message.includes("status: 403")) {
      return "음성 변환 서비스에 접근할 수 없습니다.";
    }
    if (error.message.includes("status: 404")) {
      return "음성 변환 서비스를 찾을 수 없습니다.";
    }
    if (error.message.includes("status: 500")) {
      return "서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.";
    }
    if (
      error.message.includes("NetworkError") ||
      error.message.includes("fetch")
    ) {
      return "네트워크 연결을 확인해주세요.";
    }
    if (error.message.includes("timeout")) {
      return "요청 시간이 초과되었습니다. 다시 시도해주세요.";
    }

    return error.message || "알 수 없는 오류가 발생했습니다.";
  };

  // Google STT API 호출
  const transcribeAudio = useCallback(async () => {
    if (!audioBlob) {
      console.error("❌ 변환할 오디오 파일이 없습니다.");
      handleError("변환할 오디오 파일이 없습니다.");
      return;
    }

    if (hasTranscribed) {
      console.log("⚠️ 이미 변환이 완료되었습니다.");
      return;
    }

    setIsTranscribing(true);
    setHasTranscribed(true); // 변환 시작시 플래그 설정

    try {
      console.log("🗣️ 음성 텍스트 변환 시작");

      const formData = new FormData();
      formData.append("audio", audioBlob, "recording.webm");
      formData.append("languageCode", "ko-KR"); // 한국어 설정

      // 타임아웃 설정 (30초)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      const response = await fetch("/api/stt/google-transcribe", {
        method: "POST",
        body: formData,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result: STTResponse = await response.json();

      if (result.success && result.transcription) {
        onTranscriptionComplete(result.transcription);
        console.log("✅ 음성 텍스트 변환 성공:", result.transcription);
      } else {
        throw new Error(result.error || "음성 변환에 실패했습니다.");
      }
    } catch (error) {
      console.error("❌ 음성 텍스트 변환 실패:", error);

      let errorMessage: string;
      if (error instanceof Error) {
        if (error.name === "AbortError") {
          errorMessage = "요청 시간이 초과되었습니다. 다시 시도해주세요.";
        } else {
          errorMessage = formatErrorMessage(error);
        }
      } else {
        errorMessage = "알 수 없는 오류가 발생했습니다.";
      }

      handleError(errorMessage);
      onTranscriptionComplete(null);
    } finally {
      setIsTranscribing(false);
    }
  }, [audioBlob, hasTranscribed, onTranscriptionComplete, onError]);

  // 자동 변환 처리
  useEffect(() => {
    if (autoTranscribe && audioBlob && !hasTranscribed && !isTranscribing) {
      console.log("🤖 자동 음성 변환 시작");
      transcribeAudio();
    }
  }, [
    autoTranscribe,
    audioBlob,
    hasTranscribed,
    isTranscribing,
    transcribeAudio,
  ]);

  // audioBlob이 변경될 때 상태 초기화
  useEffect(() => {
    setHasTranscribed(false);
  }, [audioBlob]);

  if (!audioBlob) {
    return null;
  }

  return (
    <>
      <div className={styles.sttSection}>
        {!autoTranscribe && (
          <button
            className={styles.sttButton}
            onClick={transcribeAudio}
            disabled={isTranscribing || hasTranscribed}
          >
            {isTranscribing
              ? "변환 중..."
              : hasTranscribed
              ? "변환 완료"
              : "텍스트로 변환하기"}
          </button>
        )}

        {isTranscribing && (
          <div className={styles.sttProgress}>
            <div className={styles.progressText}>
              {autoTranscribe
                ? "자동으로 음성을 분석하는 중..."
                : "음성을 분석하는 중..."}
            </div>
            <div className={styles.loadingSpinner}></div>
          </div>
        )}
      </div>

      {/* 에러 팝업 */}
      {showErrorPopup && (
        <ErrorPopup message={errorMessage} onClose={closeErrorPopup} />
      )}
    </>
  );
};

export default SttGoogle;
