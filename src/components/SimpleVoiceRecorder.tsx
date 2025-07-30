import React, { useEffect, useState, useRef, useCallback } from "react";
import dynamic from "next/dynamic";
import styles from "@/styles/VoiceRecorder.module.css";

// 단순한 Props 인터페이스
interface SimpleVoiceRecorderProps {
  onRecordingComplete?: (audioBlob: Blob, duration: number) => void;
  onUploadComplete?: (success: boolean, message?: string) => void;
  uploadEndpoint?: string; // 업로드할 API 엔드포인트
  maxDuration?: number; // 최대 녹음 시간 (초)
  minDuration?: number; // 최소 녹음 시간 (초)
}

// 최소 녹음 시간 설정 (초 단위)
const DEFAULT_MIN_DURATION = 1;
const DEFAULT_MAX_DURATION = 300; // 5분

const SimpleRecorderComponent: React.FC<SimpleVoiceRecorderProps> = ({
  onRecordingComplete,
  onUploadComplete,
  uploadEndpoint = "/api/upload-audio",
  maxDuration = DEFAULT_MAX_DURATION,
  minDuration = DEFAULT_MIN_DURATION,
}) => {
  const [isClient, setIsClient] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [canStopRecording, setCanStopRecording] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [isCountingDown, setIsCountingDown] = useState(false);

  // MediaRecorder 관련 refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const audioUrlRef = useRef<string | null>(null);

  // 클라이언트 사이드에서만 실행
  useEffect(() => {
    setIsClient(true);
  }, []);

  // 시간을 mm:ss 형식으로 변환
  const formatTime = (seconds: number): string => {
    if (!seconds || !isFinite(seconds) || isNaN(seconds)) {
      return "00:00";
    }
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  };

  // 오디오 URL 정리
  const cleanupAudioUrl = useCallback(() => {
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }
  }, []);

  // 녹음 시작
  const startRecording = async () => {
    try {
      console.log("녹음 시작 요청");

      // 이전 결과 초기화
      setAudioBlob(null);
      setAudioUrl(null);
      cleanupAudioUrl();

      // 카운트다운 시작
      setIsCountingDown(true);
      setCountdown(3);

      // 3초 카운트다운
      for (let i = 3; i > 0; i--) {
        setCountdown(i);
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      setCountdown(null);
      setIsCountingDown(false);

      // 마이크 권한 요청
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      // MediaRecorder 설정
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: "audio/webm;codecs=opus",
      });

      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      // 데이터 수집
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      // 녹음 완료 처리
      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        setAudioBlob(blob);

        // 오디오 URL 생성
        const url = URL.createObjectURL(blob);
        audioUrlRef.current = url;
        setAudioUrl(url);

        // 스트림 정리
        stream.getTracks().forEach((track) => track.stop());

        // 콜백 호출
        onRecordingComplete?.(blob, recordingTime);
      };

      // 녹음 시작
      mediaRecorder.start(1000); // 1초마다 데이터 수집
      setIsRecording(true);
      setRecordingTime(0);
      setCanStopRecording(false);

      // 최소 녹음 시간 타이머
      setTimeout(() => {
        setCanStopRecording(true);
      }, minDuration * 1000);

      // 녹음 시간 카운터
      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime((prev) => {
          const newTime = prev + 1;
          // 최대 시간 도달 시 자동 정지
          if (newTime >= maxDuration) {
            stopRecording();
          }
          return newTime;
        });
      }, 1000);
    } catch (err) {
      console.error("녹음 시작 실패:", err);
      setIsCountingDown(false);
      setCountdown(null);
      alert(`녹음 시작 실패: ${(err as Error).message}`);
    }
  };

  // 녹음 중지
  const stopRecording = () => {
    try {
      console.log("녹음 종료 요청");

      if (mediaRecorderRef.current && isRecording) {
        mediaRecorderRef.current.stop();
        setIsRecording(false);
      }

      // 타이머 정리
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
        recordingIntervalRef.current = null;
      }
    } catch (err) {
      console.error("녹음 종료 실패:", err);
    }
  };

  // 업로드 처리
  const handleUpload = async () => {
    if (!audioBlob) return;

    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append("audio", audioBlob, "recording.webm");
      formData.append("duration", recordingTime.toString());
      formData.append("timestamp", new Date().toISOString());

      const response = await fetch(uploadEndpoint, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`업로드 실패: ${response.statusText}`);
      }

      const result = await response.json();
      console.log("업로드 성공:", result);

      onUploadComplete?.(true, "업로드가 완료되었습니다.");
    } catch (error) {
      console.error("업로드 실패:", error);
      const errorMessage =
        error instanceof Error ? error.message : "알 수 없는 오류";
      onUploadComplete?.(false, errorMessage);
      alert(`업로드 실패: ${errorMessage}`);
    } finally {
      setIsUploading(false);
    }
  };

  // 새로 녹음하기
  const handleNewRecording = () => {
    console.log("새 녹음 준비");

    // 기존 리소스 정리
    cleanupAudioUrl();

    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = null;
    }

    // 상태 초기화
    setAudioBlob(null);
    setAudioUrl(null);
    setRecordingTime(0);
    setCanStopRecording(false);
    setCountdown(null);
    setIsCountingDown(false);
    audioChunksRef.current = [];
  };

  // 컴포넌트 언마운트 시 정리
  useEffect(() => {
    return () => {
      cleanupAudioUrl();
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
    };
  }, [cleanupAudioUrl]);

  if (!isClient) {
    return (
      <div className={styles.loading}>
        <p>로딩 중...</p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* 카운트다운 표시 */}
      {isCountingDown && countdown && (
        <div className={styles.countdownContainer}>
          <div className={styles.countdownNumber}>{countdown}</div>
          <p className={styles.countdownText}>잠시 후 녹음이 시작됩니다</p>
        </div>
      )}

      {/* 녹음 상태 표시 */}
      {isRecording && (
        <div className={styles.recordingStatus}>
          <div className={styles.recordingIndicator}></div>
          <span className={styles.recordingTime}>
            녹음 중: {formatTime(recordingTime)}
          </span>
          {recordingTime >= maxDuration - 10 && (
            <div className={styles.timeWarning}>
              {maxDuration - recordingTime}초 후 자동 종료됩니다
            </div>
          )}
        </div>
      )}

      {/* 메인 녹음 버튼 */}
      {!audioUrl && (
        <button
          className={`${styles.recordButton} ${
            isRecording ? styles.recordingButton : styles.readyButton
          }`}
          onClick={isRecording ? stopRecording : startRecording}
          disabled={
            isUploading || isCountingDown || (isRecording && !canStopRecording)
          }
        >
          <div className={styles.recordButtonText}>
            {isCountingDown ? (
              <>
                <span className={styles.recordIcon}>⏳</span>
                <span>녹음 준비 중...</span>
              </>
            ) : !isRecording ? (
              <>
                <span className={styles.recordIcon}>🎤</span>
                <span>녹음 시작</span>
              </>
            ) : canStopRecording ? (
              <>
                <span className={styles.recordIcon}>⏹️</span>
                <span>녹음 완료</span>
              </>
            ) : (
              <>
                <span className={styles.recordIcon}>🎤</span>
                <span>
                  녹음 중... ({minDuration - recordingTime}초 후 종료 가능)
                </span>
              </>
            )}
          </div>
        </button>
      )}

      {/* 녹음 결과 */}
      {audioUrl && (
        <div className={styles.audioSection}>
          <div className={styles.audioHeader}>
            <span className={styles.audioLabel}>🔉 녹음 완료</span>
            <span className={styles.audioDuration}>
              길이: {formatTime(recordingTime)}
            </span>
          </div>

          {/* 오디오 플레이어 */}
          <audio
            className={styles.audioPlayer}
            src={audioUrl}
            controls
            preload="metadata"
          />

          {/* 액션 버튼들 */}
          <div className={styles.actionButtons}>
            <button
              className={styles.uploadButton}
              onClick={handleUpload}
              disabled={isUploading}
            >
              {isUploading ? "업로드 중..." : "업로드"}
            </button>

            <button
              className={styles.newRecordingButton}
              onClick={handleNewRecording}
              disabled={isUploading}
            >
              새로 녹음하기
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// Dynamic import로 SSR 방지
const SimpleVoiceRecorder = dynamic(
  () => Promise.resolve(SimpleRecorderComponent),
  {
    ssr: false,
    loading: () => <p>음성 녹음기 로딩 중...</p>,
  }
);

export default SimpleVoiceRecorder;
