import React, { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import styles from "@/styles/VoiceRecorder.module.css";
// Recorder를 동적으로 임포트 (SSR 방지)
const RecorderComponent: React.FC = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isClient, setIsClient] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0); // 녹음 시간
  const [audioDuration, setAudioDuration] = useState<number | null>(null); // 녹음된 파일 길이

  const audioContextRef = useRef<AudioContext | null>(null);
  const recorderRef = useRef<any>(null); // eslint-disable-line @typescript-eslint/no-explicit-any
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

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

        const AudioCtx =
          window.AudioContext || (window as any).webkitAudioContext; // eslint-disable-line @typescript-eslint/no-explicit-any

        if (AudioCtx) {
          console.log("🎵 AudioContext 생성 중...");
          audioContextRef.current = new AudioCtx();
          console.log("🎵 AudioContext 상태:", audioContextRef.current.state);

          recorderRef.current = new Recorder(audioContextRef.current);
          console.log("✅ Recorder 인스턴스 생성 완료");
        } else {
          console.error("❌ 이 브라우저는 AudioContext를 지원하지 않습니다.");
        }
      } catch (error) {
        console.error("❌ Recorder 초기화 실패:", error);
      }
    };

    initRecorder();

    return () => {
      console.log("🧹 VoiceRecorder 컴포넌트 언마운트 - 리소스 정리");
      audioContextRef.current?.close();
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isClient]);

  const startRecording = async () => {
    try {
      console.log("🎤 녹음 시작 요청");
      console.log("📱 브라우저 정보:", {
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        mediaDevices: !!navigator.mediaDevices,
        getUserMedia: !!navigator.mediaDevices?.getUserMedia,
      });

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      console.log("✅ 마이크 접근 성공, 스트림 획득:", {
        streamId: stream.id,
        tracks: stream.getAudioTracks().length,
        trackSettings: stream.getAudioTracks()[0]?.getSettings(),
      });

      streamRef.current = stream;

      console.log("🔧 Recorder 초기화 중...");
      await recorderRef.current?.init(stream);
      console.log("✅ Recorder 초기화 완료");

      console.log("▶️ 녹음 시작...");
      recorderRef.current?.start();
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
      >
        {isRecording ? "🛑 녹음 종료" : "🎤 녹음 시작"}
      </button>

      {audioUrl && (
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
          <a
            className={styles.downloadLink}
            href={audioUrl}
            download="recording.wav"
          >
            🔽 WAV 파일 다운로드
          </a>
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
