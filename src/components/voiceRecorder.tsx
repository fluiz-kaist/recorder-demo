import React, { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import styles from "@/styles/VoiceRecorder.module.css";
import { useAudioUpload } from "@/hooks/useAudioUpload";

// Recorder를 동적으로 임포트 (SSR 방지)
const RecorderComponent: React.FC = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isClient, setIsClient] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0); // 녹음 시간
  const [audioDuration, setAudioDuration] = useState<number | null>(null); // 녹음된 파일 길이
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null); // 업로드용 Blob
  const [uploadResult, setUploadResult] = useState<{
    downloadURL: string;
    fileId: string;
  } | null>(null);

  const audioContextRef = useRef<AudioContext | null>(null);
  const recorderRef = useRef<any>(null); // eslint-disable-line @typescript-eslint/no-explicit-any
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // 업로드 훅 사용
  const { uploadState, uploadAudio, resetUploadState } = useAudioUpload();

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

  // 클라이언트 사이드에서만 실행되도록 보장
  useEffect(() => {
    console.log("🚀 VoiceRecorder 컴포넌트 마운트됨");
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (!isClient) return;

    console.log("📱 클라이언트 사이드 초기화 시작");

    const initRecorder = async () => {
      try {
        console.log("🔧 Recorder 라이브러리 로딩 시작");
        const { default: Recorder } = await import("recorder-js");
        console.log("✅ Recorder 라이브러리 로딩 완료");

        // Recorder 클래스만 저장 (인스턴스는 나중에 생성)
        recorderRef.current = Recorder;
      } catch (error) {
        console.error("❌ Recorder 라이브러리 로딩 실패 실패:", error);
      }
    };

    initRecorder();
  }, [isClient]);

  const startRecording = async () => {
    try {
      console.log("🎤 녹음 시작 요청");

      // 이전 녹음 결과 초기화
      setAudioUrl(null);
      setAudioBlob(null);
      setUploadResult(null);
      resetUploadState();

      console.log("📱 브라우저 정보:", {
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        mediaDevices: !!navigator.mediaDevices,
        getUserMedia: !!navigator.mediaDevices?.getUserMedia,
      });

      // 여기서 AudioContext와 Recorder 인스턴스 생성
      const AudioCtx =
        window.AudioContext || (window as any).webkitAudioContext; // eslint-disable-line @typescript-eslint/no-explicit-any
      audioContextRef.current = new AudioCtx();

      const RecorderClass = recorderRef.current;
      const recorderInstance = new RecorderClass(audioContextRef.current);

      // 마이크 접근 및 녹음 시작

      // const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // console.log("✅ 마이크 접근 성공, 스트림 획득:", {
      //   streamId: stream.id,
      //   tracks: stream.getAudioTracks().length,
      //   trackSettings: stream.getAudioTracks()[0]?.getSettings(),
      // });

      const stream = await requestMicrophoneAccess();
      console.log("🔧 Recorder 초기화 중...");
      await recorderInstance.init(stream);
      console.log("✅ Recorder 초기화 완료");
      console.log("▶️ 녹음 시작...");
      recorderInstance.start();

      // 인스턴스를 ref에 저장
      recorderRef.current = recorderInstance;
      setIsRecording(true);
      setRecordingTime(0);

      // 1초마다 녹음 시간 업데이트
      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => {
          const newTime = prev + 1;
          if (newTime % 10 === 0) {
            // 10초마다 로그
            console.log(`⏱️ 녹음 진행 중: ${newTime}초`);
          }
          return newTime;
        });
      }, 1000);

      console.log("🎵 녹음 상태 변경 완료");
    } catch (err) {
      console.error("❌ 마이크 접근 실패:", {
        error: err,
        message: (err as Error)?.message,
        name: (err as Error)?.name,
      });

      // 더 자세한 에러 정보
      if (err instanceof DOMException) {
        console.error("🚫 DOMException 상세:", {
          code: err.code,
          message: err.message,
          name: err.name,
        });
      }
    }
  };

  // 마이크 접근을 별도 함수로 분리
  const requestMicrophoneAccess = async (): Promise<MediaStream> => {
    try {
      console.log("🎤 마이크 접근 요청 중...");

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      console.log("✅ 마이크 접근 성공, 스트림 획득:", {
        streamId: stream.id,
        tracks: stream.getAudioTracks().length,
        trackSettings: stream.getAudioTracks()[0]?.getSettings(),
      });

      return stream;
    } catch (err: unknown) {
      const error = err as DOMException;

      console.error("❌ 마이크 접근 실패:", {
        name: error.name,
        message: error.message,
        code: error.code,
      });

      // 구체적인 에러 타입 확인
      switch (error.name) {
        case "NotAllowedError":
          console.error("🚫 사용자가 마이크 권한을 거부함");
          throw new Error(
            "마이크 권한이 거부되었습니다. 브라우저 설정에서 마이크 권한을 허용해주세요."
          );
        case "NotFoundError":
          console.error("🔍 마이크 장치를 찾을 수 없음");
          throw new Error(
            "마이크 장치를 찾을 수 없습니다. 마이크가 연결되어 있는지 확인해주세요."
          );
        case "NotSupportedError":
          console.error("🚫 브라우저에서 지원하지 않음");
          throw new Error("현재 브라우저에서는 음성 녹음이 지원되지 않습니다.");
        case "NotReadableError":
          console.error("🔧 마이크가 다른 애플리케이션에서 사용 중");
          throw new Error(
            "마이크가 다른 애플리케이션에서 사용 중입니다. 다른 앱을 종료 후 다시 시도해주세요."
          );
        case "OverconstrainedError":
          console.error("⚙️ 요청한 오디오 제약 조건을 만족할 수 없음");
          throw new Error("오디오 설정에 문제가 있습니다. 다시 시도해주세요.");
        case "SecurityError":
          console.error("🔒 보안 정책으로 인한 접근 거부 (HTTPS 필요)");
          throw new Error(
            "보안상의 이유로 마이크에 접근할 수 없습니다. HTTPS 연결을 확인해주세요."
          );
        default:
          console.error("❓ 알 수 없는 에러:", error.name);
          throw new Error(
            `마이크 접근 중 알 수 없는 오류가 발생했습니다: ${error.message}`
          );
      }
    }
  };

  const stopRecording = async () => {
    try {
      console.log("🛑 녹음 종료 요청");

      const result = await recorderRef.current?.stop();
      console.log("📄 녹음 결과:", {
        hasResult: !!result,
        hasBlobData: !!result?.blob,
        blobSize: result?.blob?.size,
        blobType: result?.blob?.type,
      });

      if (result) {
        const url = URL.createObjectURL(result.blob);
        console.log("🔗 Blob URL 생성:", url);
        setAudioUrl(url);
        setAudioBlob(result.blob); // 업로드용 Blob 저장

        // 녹음된 시간을 파일 길이로 사용 (더 정확함)
        console.log("⏱️ 녹음 시간 설정:", recordingTime);
        setAudioDuration(recordingTime);

        // 대안: 오디오 파일에서 실제 길이 가져오기 (백업용)
        const audio = new Audio(url);
        audio.addEventListener("loadedmetadata", () => {
          console.log("🎵 오디오 메타데이터 로드 완료:", {
            duration: audio.duration,
            isFinite: isFinite(audio.duration),
          });

          if (audio.duration && isFinite(audio.duration)) {
            setAudioDuration(Math.floor(audio.duration));
          }
        });

        audio.addEventListener("error", (e) => {
          console.warn("⚠️ 오디오 메타데이터 로드 실패:", e);
          console.log("📝 녹음 시간 사용");
        });

        // 메타데이터 로드 시도
        audio.load();
      }

      // 스트림 정리
      const tracks = streamRef.current?.getTracks() || [];
      console.log("🧹 스트림 트랙 정리:", tracks.length);
      tracks.forEach((track, index) => {
        console.log(`🔇 트랙 ${index} 정지:`, track.label);
        track.stop();
      });

      setIsRecording(false);

      // 타이머 정리
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
        console.log("⏰ 타이머 정리 완료");
      }

      console.log("✅ 녹음 종료 완료");
    } catch (err) {
      console.error("❌ 녹음 종료 실패:", {
        error: err,
        message: (err as Error)?.message,
        name: (err as Error)?.name,
      });
    }
  };

  // 서버로 업로드
  const handleUpload = async () => {
    if (!audioBlob || !audioDuration) {
      console.error("❌ 업로드할 오디오 파일이 없습니다.");
      return;
    }

    try {
      const fileName = `recording_${new Date()
        .toISOString()
        .replace(/[:.]/g, "-")}.wav`;
      const userId = "user123"; // 실제 사용자 ID로 교체

      const result = await uploadAudio(
        audioBlob,
        fileName,
        audioDuration,
        userId
      );

      if (result) {
        setUploadResult(result);
        console.log("🎉 업로드 성공:", result);
      }
    } catch (error) {
      console.error("❌ 업로드 실패:", error);
    }
  };

  // 새로 녹음하기
  const handleNewRecording = () => {
    setAudioUrl(null);
    setAudioBlob(null);
    setAudioDuration(null);
    setUploadResult(null);
    resetUploadState();
  };

  if (!isClient) {
    return (
      <div className={styles.loading}>
        <p>로딩 중...</p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <h2 className={styles.title}>🎙️ 음성 녹음</h2>

      {/* 녹음 시간 표시 */}
      {isRecording && (
        <div className={styles.recordingStatus}>
          <div className={styles.recordingIndicator}></div>
          <span className={styles.recordingTime}>
            녹음 중: {formatTime(recordingTime)}
          </span>
        </div>
      )}

      <button
        className={`${styles.recordButton} ${
          isRecording ? styles.recordingButton : ""
        }`}
        onClick={isRecording ? stopRecording : startRecording}
        disabled={uploadState.isUploading}
      >
        {isRecording ? "🛑 녹음 종료" : "🎤 녹음 시작"}
      </button>

      {audioUrl && !uploadResult && (
        <div className={styles.audioSection}>
          <div className={styles.audioHeader}>
            <p className={styles.audioLabel}>🔉 녹음된 파일</p>
            {audioDuration && (
              <span className={styles.audioDuration}>
                길이: {formatTime(audioDuration)}
              </span>
            )}
          </div>
          <audio className={styles.audioPlayer} src={audioUrl} controls />

          <div className={styles.actionButtons}>
            <a
              className={styles.downloadLink}
              href={audioUrl}
              download="recording.wav"
            >
              🔽 WAV 파일 다운로드
            </a>

            <button
              className={styles.uploadButton}
              onClick={handleUpload}
              disabled={uploadState.isUploading}
            >
              {uploadState.isUploading ? "업로드 중..." : "✅ 서버로 전송"}
            </button>

            <button
              className={styles.newRecordingButton}
              onClick={handleNewRecording}
              disabled={uploadState.isUploading}
            >
              🔄 새로 녹음하기
            </button>
          </div>

          {/* 업로드 진행률 */}
          {uploadState.isUploading && (
            <div className={styles.uploadProgress}>
              <div className={styles.progressBar}>
                <div
                  className={styles.progressFill}
                  style={{ width: `${uploadState.progress}%` }}
                ></div>
              </div>
              <span className={styles.progressText}>
                업로드 중... {uploadState.progress}%
              </span>
            </div>
          )}

          {/* 업로드 에러 */}
          {uploadState.error && (
            <div className={styles.errorMessage}>
              ❌ 업로드 실패: {uploadState.error}
            </div>
          )}
        </div>
      )}

      {/* 업로드 성공 */}
      {uploadResult && (
        <div className={styles.successSection}>
          <div className={styles.successHeader}>
            <h3 className={styles.successTitle}>🎉 업로드 완료!</h3>
          </div>

          <div className={styles.successInfo}>
            <p className={styles.successText}>
              파일이 성공적으로 서버에 저장되었습니다.
            </p>
            <div className={styles.fileDetails}>
              <p>
                <strong>파일 ID:</strong> {uploadResult.fileId}
              </p>
              <p>
                <strong>파일 길이:</strong>{" "}
                {audioDuration ? formatTime(audioDuration) : "알 수 없음"}
              </p>
            </div>
          </div>

          <div className={styles.successActions}>
            <a
              className={styles.viewFileLink}
              href={uploadResult.downloadURL}
              target="_blank"
              rel="noopener noreferrer"
            >
              🔗 업로드된 파일 보기
            </a>

            <button
              className={styles.newRecordingButton}
              onClick={handleNewRecording}
            >
              🔄 새로 녹음하기
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const VoiceRecorder = dynamic(() => Promise.resolve(RecorderComponent), {
  ssr: false,
  loading: () => <p className={styles.loading}>음성 녹음기 로딩 중...</p>,
});

export default VoiceRecorder;
