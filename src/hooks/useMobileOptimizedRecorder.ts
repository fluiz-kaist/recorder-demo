// hooks/useMobileOptimizedRecorder.ts
import { useRef, useState, useCallback } from "react";

interface RecorderState {
  isRecording: boolean;
  recordingTime: number;
  audioBlob: Blob | null;
}

interface RecorderActions {
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<void>;
  resetRecorder: () => void;
}

export const useMobileOptimizedRecorder = (): RecorderState &
  RecorderActions => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // 모바일 최적화 마이크 접근
  const getMicrophoneStream = async (): Promise<MediaStream> => {
    const isMobile =
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent
      );
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isAndroid = /Android/.test(navigator.userAgent);
    const isSamsung = /SM-/.test(navigator.userAgent);

    console.log("환경 감지:", { isMobile, isIOS, isAndroid, isSamsung });

    // 모바일에서 가장 호환성 좋은 설정들을 순서대로 시도
    const constraintsList: MediaStreamConstraints[] = [
      // 고령자 음성 최적화 설정 (새로 추가)
      {
        audio: {
          channelCount: 1,
          sampleRate: 48000,
          echoCancellation: false, // 변경: 약한 음성 보호
          noiseSuppression: false, // 변경: 자연스러운 음성 유지
          autoGainControl: true, // 유지: 작은 목소리 증폭
          ...(isMobile && {
            latency: 0.1,
            volume: 1.0,
          }),
        },
      },

      // 1순위: 모바일별 최적화 설정
      {
        audio: {
          channelCount: 1,
          sampleRate: 48000, // WebM Opus는 48kHz가 기본
          echoCancellation: true,
          noiseSuppression: !isIOS, // iOS에서 때때로 문제 발생
          autoGainControl: !isSamsung, // 삼성에서 볼륨 이슈
          ...(isMobile && {
            latency: 0.1,
            volume: 1.0,
          }),
        },
      },
      // 2순위: 기본 모노 설정
      {
        audio: {
          channelCount: 1,
          sampleRate: 48000,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      },
      // 3순위: 간단한 모노 설정
      {
        audio: {
          channelCount: 1,
          echoCancellation: true,
        },
      },
      // 4순위: 최소 설정 (호환성 우선)
      {
        audio: true,
      },
    ];

    for (let i = 0; i < constraintsList.length; i++) {
      const constraints = constraintsList[i];
      try {
        console.log(
          `🎤 마이크 접근 시도 ${i + 1}/${constraintsList.length}:`,
          constraints
        );
        const stream = await navigator.mediaDevices.getUserMedia(constraints);

        const track = stream.getAudioTracks()[0];
        const settings = track.getSettings();

        console.log("✅ 마이크 접근 성공:", {
          attempt: i + 1,
          settings,
          streamId: stream.id,
        });

        return stream;
      } catch (error) {
        console.warn(`⚠️ 설정 ${i + 1} 실패:`, error);

        if (i === constraintsList.length - 1) {
          // 마지막 시도도 실패하면 사용자 친화적 에러 메시지
          const errorMsg = getMicrophoneErrorMessage(
            error as DOMException,
            isMobile
          );
          throw new Error(errorMsg);
        }
        continue;
      }
    }

    throw new Error("모든 마이크 설정이 실패했습니다.");
  };

  // 사용자 친화적 에러 메시지
  const getMicrophoneErrorMessage = (
    error: DOMException,
    isMobile: boolean
  ): string => {
    switch (error.name) {
      case "NotAllowedError":
        return isMobile
          ? "마이크 권한이 거부되었습니다. 브라우저 설정 > 권한에서 마이크를 허용해주세요."
          : "마이크 권한이 거부되었습니다. 브라우저 설정에서 마이크 권한을 허용해주세요.";
      case "NotFoundError":
        return isMobile
          ? "마이크를 찾을 수 없습니다. 다른 앱에서 마이크를 사용 중인지 확인해주세요."
          : "마이크 장치를 찾을 수 없습니다. 마이크가 연결되어 있는지 확인해주세요.";
      case "NotSupportedError":
        return isMobile
          ? "현재 브라우저에서는 녹음이 지원되지 않습니다. 최신 버전으로 업데이트해주세요."
          : "현재 브라우저에서는 음성 녹음이 지원되지 않습니다.";
      case "NotReadableError":
        return isMobile
          ? "마이크가 다른 앱에서 사용 중입니다. 통화나 다른 녹음 앱을 종료 후 다시 시도해주세요."
          : "마이크가 다른 애플리케이션에서 사용 중입니다. 다른 앱을 종료 후 다시 시도해주세요.";
      case "OverconstrainedError":
        return isMobile
          ? "요청한 오디오 설정을 지원하지 않습니다. 기본 설정으로 녹음을 시도하세요."
          : "오디오 설정에 문제가 있습니다. 다시 시도해주세요.";
      case "SecurityError":
        return isMobile
          ? "보안상의 이유로 마이크에 접근할 수 없습니다. HTTPS 연결을 확인하거나 다른 브라우저를 사용해보세요."
          : "보안상의 이유로 마이크에 접근할 수 없습니다. HTTPS 연결을 확인해주세요.";
      default:
        return `마이크 접근 중 알 수 없는 오류가 발생했습니다: ${error.message}`;
    }
  };

  // 최적의 MediaRecorder 설정 찾기
  const getOptimalMediaRecorderOptions = (): MediaRecorderOptions => {
    // WebM Opus 포맷 우선순위로 시도
    const formatOptions: MediaRecorderOptions[] = [
      // 1순위: WebM Opus (고품질, 효율적 압축)
      {
        mimeType: "audio/webm;codecs=opus",
        audioBitsPerSecond: 64000, // 64kbps - 음성 최적화
      },
      // 2순위: WebM Opus (기본 품질)
      {
        mimeType: "audio/webm;codecs=opus",
      },
      // 3순위: WebM (코덱 미지정)
      {
        mimeType: "audio/webm",
      },
      // 4순위: MP4 (iOS Safari 폴백)
      {
        mimeType: "audio/mp4",
      },
      // 5순위: 기본 설정
      {},
    ];

    for (const options of formatOptions) {
      if (options.mimeType && MediaRecorder.isTypeSupported(options.mimeType)) {
        console.log("✅ 지원되는 포맷 선택:", options);
        return options;
      }
    }

    console.log("⚠️ 기본 설정 사용");
    return {};
  };

  // 생성된 오디오 파일 검증
  const validateAudioFile = (blob: Blob): void => {
    console.log("🔍 생성된 오디오 파일 정보:", {
      type: blob.type,
      size: blob.size,
      sizeKB: Math.round(blob.size / 1024),
      isWebM: blob.type.includes("webm"),
      isOpus: blob.type.includes("opus"),
    });

    if (blob.size === 0) {
      console.warn("⚠️ 빈 오디오 파일이 생성되었습니다!");
    }

    if (blob.type.includes("webm") && blob.type.includes("opus")) {
      console.log("✅ WebM Opus 포맷으로 성공적으로 녹음됨");
    } else {
      console.log("ℹ️ 다른 포맷으로 녹음됨:", blob.type);
    }
  };

  // 정리 함수
  const cleanup = useCallback(() => {
    console.log("🧹 녹음기 정리 시작");

    // 타이머 정리
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    // MediaRecorder 정리
    if (mediaRecorderRef.current) {
      if (mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
      mediaRecorderRef.current = null;
    }

    // 스트림 정리
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        console.log("🔇 트랙 정지:", track.label);
        track.stop();
      });
      streamRef.current = null;
    }

    // 청크 정리
    chunksRef.current = [];

    console.log("✅ 녹음기 정리 완료");
  }, []);

  // 녹음기 리셋 (새로 추가)
  const resetRecorder = useCallback(() => {
    console.log("🔄 녹음기 리셋 시작");
    
    // 상태 초기화
    setIsRecording(false);
    setRecordingTime(0);
    setAudioBlob(null);
    
    // 리소스 정리
    cleanup();
    
    console.log("✅ 녹음기 리셋 완료");
  }, [cleanup]);

  // 녹음 시작
  const startRecording = useCallback(async (): Promise<void> => {
    try {
      console.log("🎤 녹음 시작");

      // 이전 상태 정리
      cleanup();
      setAudioBlob(null);
      setRecordingTime(0);

      // 1. 마이크 스트림 획득
      const stream = await getMicrophoneStream();
      streamRef.current = stream;

      // 2. MediaRecorder 설정
      const options = getOptimalMediaRecorderOptions();
      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;

      // 3. 이벤트 리스너 설정
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
          console.log("📦 오디오 청크 수집:", event.data.size, "bytes");
        }
      };

      mediaRecorder.onstop = () => {
        console.log("🛑 MediaRecorder 중지됨");

        if (chunksRef.current.length > 0) {
          const finalBlob = new Blob(chunksRef.current, {
            type: mediaRecorder.mimeType || "audio/webm",
          });

          validateAudioFile(finalBlob);
          setAudioBlob(finalBlob);
        } else {
          console.warn("⚠️ 녹음된 데이터가 없습니다.");
          setAudioBlob(null);
        }
      };

      mediaRecorder.onerror = (event) => {
        console.error("❌ MediaRecorder 오류:", event);
      };

      // 4. 녹음 시작
      mediaRecorder.start(1000); // 1초마다 데이터 수집
      setIsRecording(true);

      // 5. 타이머 시작
      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => {
          const newTime = prev + 1;
          if (newTime % 10 === 0) {
            console.log(`⏱️ 녹음 진행 중: ${newTime}초`);
          }
          return newTime;
        });
      }, 1000);

      console.log("✅ 녹음 시작 완료", {
        mimeType: mediaRecorder.mimeType,
        state: mediaRecorder.state,
      });
    } catch (error) {
      console.error("❌ 녹음 시작 실패:", error);
      cleanup();
      setIsRecording(false);
      throw error;
    }
  }, [cleanup]);

  // 녹음 중지
  const stopRecording = useCallback(async (): Promise<void> => {
    try {
      console.log("🛑 녹음 중지 시작");

      setIsRecording(false);

      // 타이머 중지
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }

      // MediaRecorder 중지 (onstop 이벤트에서 blob 생성됨)
      if (
        mediaRecorderRef.current &&
        mediaRecorderRef.current.state !== "inactive"
      ) {
        mediaRecorderRef.current.stop();
      }

      // 스트림 정리
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => {
          track.stop();
        });
        streamRef.current = null;
      }

      console.log("✅ 녹음 중지 완료");
    } catch (error) {
      console.error("❌ 녹음 중지 실패:", error);
      cleanup();
      throw error;
    }
  }, [cleanup]);

  return {
    isRecording,
    recordingTime,
    audioBlob,
    startRecording,
    stopRecording,
    resetRecorder,
  };
};