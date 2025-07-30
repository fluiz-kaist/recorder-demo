import React, { useState, useEffect, useCallback, useRef } from "react";
import styles from "@/styles/SttCompo.module.css";
import ErrorPopup from "@/components/ErrorPopup";

// Whisper API 응답 타입 정의
export interface WhisperTranscriptionResult {
  transcript: string;
  confidence?: number; // Whisper API에서는 confidence를 제공하지 않을 수 있음
}

export interface WhisperSTTResponse {
  success: boolean;
  transcription?: WhisperTranscriptionResult;
  error?: string;
}

// STT 컴포넌트 Props 인터페이스
interface SttWhisperProps {
  audioBlob: Blob | null;
  onTranscriptionComplete: (result: WhisperTranscriptionResult | null) => void;
  onError: (error: string) => void;
  autoTranscribe?: boolean; // 자동 변환 여부
  onTranscribingStateChange?: (isTranscribing: boolean) => void; // 변환 상태 변경 콜백
}

// Whisper STT 컴포넌트
const SttWhisper: React.FC<SttWhisperProps> = ({
  audioBlob,
  onTranscriptionComplete,
  onError,
  autoTranscribe = false,
  onTranscribingStateChange,
}) => {
  // 변환 진행 상태
  const [isTranscribing, setIsTranscribing] = useState(false);
  // 에러 팝업 표시 상태
  const [showErrorPopup, setShowErrorPopup] = useState(false);
  // 에러 메시지
  const [errorMessage, setErrorMessage] = useState("");
  // 변환 완료 여부 추적
  const [hasTranscribed, setHasTranscribed] = useState(false);

  // 실행 상태 관리를 위한 ref (중복 실행 방지)
  const transcribeRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // 변환 상태 변경 시 부모 컴포넌트에 알림
  useEffect(() => {
    onTranscribingStateChange?.(isTranscribing);
  }, [isTranscribing, onTranscribingStateChange]);

  // 에러 처리 함수
  const handleError = useCallback(
    (error: string) => {
      setErrorMessage(error);
      setShowErrorPopup(true);
      onError(error);
    },
    [onError]
  );

  // 에러 팝업 닫기
  const closeErrorPopup = useCallback(() => {
    setShowErrorPopup(false);
    setErrorMessage("");
  }, []);

  // HTTP 상태 코드 및 에러 타입별 메시지 포맷팅
  const formatErrorMessage = useCallback((error: Error | string): string => {
    if (typeof error === "string") {
      return error;
    }

    // OpenAI API 특정 에러 처리
    if (error.message.includes("status: 400")) {
      return "잘못된 요청입니다. 오디오 파일 형식을 확인해주세요.";
    }
    if (error.message.includes("status: 401")) {
      return "OpenAI API 키가 유효하지 않습니다. 설정을 확인해주세요.";
    }
    if (error.message.includes("status: 403")) {
      return "OpenAI API 접근 권한이 없습니다.";
    }
    if (error.message.includes("status: 404")) {
      return "OpenAI Whisper 서비스를 찾을 수 없습니다.";
    }
    if (error.message.includes("status: 429")) {
      return "API 요청 한도를 초과했습니다. 잠시 후 다시 시도해주세요.";
    }
    if (error.message.includes("status: 500")) {
      return "OpenAI 서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.";
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
  }, []);

  // OpenAI Whisper API 호출
  const transcribeAudio = useCallback(async () => {
    // 오디오 파일 존재 여부 확인
    if (!audioBlob) {
      console.error("변환할 오디오 파일이 없습니다.");
      handleError("변환할 오디오 파일이 없습니다.");
      return;
    }

    // 중복 실행 방지 - ref를 사용하여 동기적으로 체크
    if (transcribeRef.current) {
      console.log("이미 변환이 진행 중입니다.");
      return;
    }

    // 이미 변환이 완료된 경우 중복 실행 방지
    if (hasTranscribed) {
      console.log("이미 변환이 완료되었습니다.");
      return;
    }

    // 실행 상태 플래그 설정
    transcribeRef.current = true;
    setIsTranscribing(true);
    setHasTranscribed(true);

    try {
      console.log("Whisper 음성 텍스트 변환 시작");

      // 이전 요청이 있다면 취소
      if (
        abortControllerRef.current &&
        !abortControllerRef.current.signal.aborted
      ) {
        abortControllerRef.current.abort();
      }

      // FormData 생성 및 파일 추가
      const formData = new FormData();
      formData.append("file", audioBlob, "recording.webm");
      formData.append("model", "whisper-1");
      formData.append("language", "ko");
      formData.append("response_format", "json");

      // AbortController 생성
      const controller = new AbortController();
      abortControllerRef.current = controller;

      // 요청 타임아웃 설정 (45초)
      const timeoutId = setTimeout(() => {
        controller.abort();
      }, 45000);

      // OpenAI Whisper API 호출
      const response = await fetch("/api/stt/whisper-transcribe", {
        method: "POST",
        body: formData,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // HTTP 응답 상태 확인
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result: WhisperSTTResponse = await response.json();

      // 변환 성공 처리
      if (result.success && result.transcription) {
        onTranscriptionComplete(result.transcription);
        console.log("Whisper 음성 텍스트 변환 성공:", result.transcription);
      } else {
        throw new Error(result.error || "음성 변환에 실패했습니다.");
      }
    } catch (error) {
      console.error("Whisper 음성 텍스트 변환 실패:", error);

      let errorMessage: string;
      if (error instanceof Error) {
        if (error.name === "AbortError") {
          errorMessage = "요청이 취소되었습니다.";
        } else {
          errorMessage = formatErrorMessage(error);
        }
      } else {
        errorMessage = "알 수 없는 오류가 발생했습니다.";
      }

      handleError(errorMessage);
      onTranscriptionComplete(null);
    } finally {
      // 실행 상태 플래그 해제
      transcribeRef.current = false;
      setIsTranscribing(false);
      abortControllerRef.current = null;
    }
  }, [
    audioBlob,
    hasTranscribed,
    onTranscriptionComplete,
    handleError,
    formatErrorMessage,
  ]);

  // 수동 변환 버튼 클릭 핸들러
  const handleManualTranscribe = useCallback(() => {
    transcribeAudio();
  }, [transcribeAudio]);

  // 자동 변환 처리 - audioBlob이 존재하고 아직 변환하지 않은 경우 자동 실행
  useEffect(() => {
    if (
      autoTranscribe &&
      audioBlob &&
      !hasTranscribed &&
      !transcribeRef.current
    ) {
      console.log("자동 음성 변환 시작");
      // React Strict Mode에서 이중 실행 방지를 위한 짧은 지연
      const timeoutId = setTimeout(() => {
        if (!transcribeRef.current) {
          transcribeAudio();
        }
      }, 100);

      return () => clearTimeout(timeoutId);
    }
  }, [autoTranscribe, audioBlob, hasTranscribed, transcribeAudio]);

  // audioBlob이 변경될 때 상태 초기화
  useEffect(() => {
    setHasTranscribed(false);
    transcribeRef.current = false;
    // audioBlob이 null이 아닌 경우에만 이전 요청 취소
    if (
      audioBlob &&
      abortControllerRef.current &&
      !abortControllerRef.current.signal.aborted
    ) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, [audioBlob]);

  // 컴포넌트 언마운트 시 정리
  useEffect(() => {
    return () => {
      if (
        abortControllerRef.current &&
        !abortControllerRef.current.signal.aborted
      ) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // 오디오 파일이 없으면 컴포넌트 렌더링하지 않음
  if (!audioBlob) {
    return null;
  }

  return (
    <>
      <div className={styles.sttSection}>
        {/* 수동 변환 버튼 (자동 변환이 아닌 경우만 표시) */}
        {!autoTranscribe && (
          <button
            className={styles.sttButton}
            onClick={handleManualTranscribe}
            disabled={isTranscribing || hasTranscribed}
          >
            {isTranscribing
              ? "변환 중..."
              : hasTranscribed
              ? "변환 완료"
              : "여기를 누르면 말한 내용이 글자로 써져요"}
          </button>
        )}

        {/* 변환 진행 상태 표시 */}
        {isTranscribing && (
          <div className={styles.sttProgress}>
            <div className={styles.progressText}>
              {autoTranscribe
                ? "자동으로 음성을 분석하는 중..."
                : "녹음된 음성을 글자로 바꾸는 중..."}
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

export default SttWhisper;
