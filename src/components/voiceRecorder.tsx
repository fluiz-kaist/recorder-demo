/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useState, useRef, useCallback } from "react";
import dynamic from "next/dynamic";
import styles from "@/styles/VoiceRecorder.module.css";
import { useRouter } from "next/router";
//types
import {
  ScriptType,
  SituationalScript,
  FormalScript,
  AudioFormat,
  TutorialScript,
} from "@/types/firebase";
//hooks
import { useMobileOptimizedRecorder } from "@/hooks/useMobileOptimizedRecorder";
import { useScrollToTop } from "@/hooks/useScrollToTop";
//query and mutation
import { useUserQuery } from "@/hooks/queries/useUserQueries";
import { useUploadAudioMutation } from "@/hooks/mutations/useAudioMutations";
import { useCompleteScriptMutation } from "@/hooks/mutations/useUserMutations";
//functions
import type { WhisperTranscriptionResult } from "@/components/stt/SttWhisper";
import SttWhisper from "@/components/stt/SttWhisper";
//utils
import { getEnv } from "@/utils/envConfig";
import { formatTime } from "@/utils/time";
import { performSTTForUpload } from "@/utils/sttUpload";
import {
  validateAudioQualitySimple,
  SimpleQualityResult,
} from "@/utils/audioUtils";

// =================================
// ========== 타입, 상수=============
// ===================================

const { isPreview, isDev } = getEnv();
const isDevMode = isPreview || isDev;
//  최소 녹음 시간 설정 (초 단위, 개발모드에서는 1, 실사용에서는 10)
const MINIMUM_RECORDING_SECONDS = isDevMode ? 1 : 10;
// 최대 녹음 시간 설정(초 단위, 개발모드에서는 20, 실사용에서는 120)
const MAXIMUM_RECORDING_SECONDS = isDevMode ? 10 : 120;

// : 경고 타이밍 설정(개발모드에서는 종료 전 5초, 실사용에서는 30초 전에 경고)
const WARNING_BEFORE_MAX_SECONDS = isDevMode ? 5 : 30; // 최대 시간 30초 전에 경고
const WARNING_START_TIME =
  MAXIMUM_RECORDING_SECONDS - WARNING_BEFORE_MAX_SECONDS; // 90초

/** interfaces */
type AnyScript = SituationalScript | FormalScript | TutorialScript;

interface VoiceRecorderProps {
  scriptType: ScriptType;
  scriptData: AnyScript;
  onRecordingComplete?: () => void;
  isCompltedScript?: boolean;
  isTutorial?: boolean;
  onAllScriptsComplete?: () => void;
  totalScriptsCount?: number;
  completedScriptsCount?: number;
}

// 컴포넌트 시작
const RecorderComponent: React.FC<VoiceRecorderProps> = ({
  isTutorial = false,
  scriptType,
  scriptData,
  onRecordingComplete,
  totalScriptsCount,
  onAllScriptsComplete,
  completedScriptsCount,
}) => {
  // console.log("[VoiceRecorder] props:", {
  //   scriptType,
  //   scriptData,
  //   totalScriptsCount,
  //   completedScriptsCount,
  // });
  // =================================
  // ========== 상태 관리 =============
  // ===================================

  /** UI 관련 */
  // 스크롤 훅 사용
  const scrollToTop = useScrollToTop();
  const router = useRouter();
  // 카운트 다운
  const [countdown, setCountdown] = useState<number | null>(null);
  const [isCountingDown, setIsCountingDown] = useState(false);
  //녹음 정지 강제 관리
  const [canStopRecording, setCanStopRecording] = useState(false);
  //  최대 시간 관련 상태
  const [isNearMaxTime, setIsNearMaxTime] = useState(false); // 90초 지나면 true
  const [autoStopTimer, setAutoStopTimer] = useState<NodeJS.Timeout | null>(
    null
  );

  //녹음 파일 다시듣기 상태
  const [isPlaying, setIsPlaying] = useState(false);

  /** Audio 관련 */

  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  // 녹음 완료 된 결과물의 속성
  const [audioDuration, setAudioDuration] = useState<number | null>(null);
  //  녹음 세션 추적 상태
  const [recordingStartTime, setRecordingStartTime] = useState<Date | null>(
    null
  );
  const [recordingEndTime, setRecordingEndTime] = useState<Date | null>(null);

  /** upload */
  //업로드 상태 관련
  const [uploadProgress, setUploadProgress] = useState<{
    step: "idle" | "stt" | "audio_upload" | "user_update" | "complete";
    message: string;
  }>({
    step: "idle",
    message: "",
  });
  // STT 관련 상태
  const [showSTT, setShowSTT] = useState(false);
  const [isSTTProcessing, setIsSTTProcessing] = useState(false);
  const [hasSTTStarted, setHasSTTStarted] = useState(false);
  const [transcription, setTranscription] =
    useState<WhisperTranscriptionResult | null>(null);
  const [transcriptionError, setTranscriptionError] = useState<string | null>(
    null
  );
  // 간단한 품질 검증 관련 상태
  const [qualityResult, setQualityResult] =
    useState<SimpleQualityResult | null>(null);
  const [showQualityWarning, setShowQualityWarning] = useState(false);

  // ==========  Refs ==========
  // 오디오 재생/일시정지를 제어하기 위한 HTML Audio Element 참조
  // 사용자가 "재생" 버튼을 클릭했을 때 audio.play()/pause() 호출용
  const [audioRef, setAudioRef] = useState<HTMLAudioElement | null>(null);
  // 메모리 누수 방지를 위한 Blob URL 참조 저장소
  // URL.createObjectURL()로 생성한 URL을 나중에 URL.revokeObjectURL()로 정리하기 위해 보관
  const audioUrlRef = useRef<string | null>(null);

  // =================================
  // ========= 외부 훅과 쿼리 =========
  // ===================================

  const uploadAudioMutation = useUploadAudioMutation();
  const completeUserScriptMutation = useCompleteScriptMutation();

  const { data: fullUser } = useUserQuery();
  // MobileOptimizedRecorder hook 사용
  const {
    isRecording,
    recordingTime, //녹음 진행 상태
    audioBlob,
    startRecording: startMobileRecording,
    stopRecording: stopMobileRecording,
    resetRecorder,
  } = useMobileOptimizedRecorder();

  /// funcs for useEffects //

  //오디오 관련
  const cleanupAudioUrl = useCallback(() => {
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }
  }, []);

  // 일반적인 정리 (리렌더링 시)
  const cleanup = useCallback(() => {
    // 1. 타이머 정리
    if (autoStopTimer) {
      clearTimeout(autoStopTimer);
    }

    // 2. Blob URL 정리
    cleanupAudioUrl();
  }, [autoStopTimer, cleanupAudioUrl]);

  // 페이지 떠날 때만 완전 정리
  const cleanupForPageUnload = useCallback(() => {
    // 1. 기본 정리
    cleanup();

    // 2. resetRecorder() 대신 직접 스트림만 정리
    if (typeof stopMobileRecording === "function") {
      stopMobileRecording().catch(console.error);
    }
  }, [cleanup, stopMobileRecording]);

  // =====================================
  // ========== useEffect 훅 =============
  // =====================================

  //  audioBlob이 생성되면 즉시 간단한 품질 검증 후 STT 준비
  useEffect(() => {
    if (audioBlob && !hasSTTStarted) {
      console.log(" 새로운 오디오 blob 생성됨:", {
        size: audioBlob.size,
        type: audioBlob.type,
      });

      // 이전 URL 정리
      cleanupAudioUrl();

      // 타이머 정리
      if (autoStopTimer) {
        clearTimeout(autoStopTimer);
      }

      let url = "";

      // iOS 호환성을 위한 오디오 URL 생성
      if (
        /iPad|iPhone|iPod/.test(navigator.userAgent) &&
        audioBlob.type.includes("webm")
      ) {
        // iOS에서 WebM 문제 시 Data URL 사용
        const reader = new FileReader();
        reader.onloadend = () => {
          const dataUrl = reader.result as string;
          setAudioUrl(dataUrl);
        };
        reader.readAsDataURL(audioBlob);
      } else {
        // 일반적인 경우
        url = URL.createObjectURL(audioBlob);
        audioUrlRef.current = url; // ref에 저장
        setAudioUrl(url);
      }

      setAudioDuration(recordingTime);

      // 품질 검증 + VAD 처리 동시 실행
      const processAudioQuality = async () => {
        const quality = await validateAudioQualitySimple(
          audioBlob,
          recordingTime
        );
        setQualityResult(quality);
        // quality 결과에 VAD 처리된 오디오도 포함됨

        // 🔥 품질 검증 결과에 따른 처리를 async 함수 안으로 이동
        if (quality.isGoodQuality) {
          console.log("✅ 품질 검증 통과 - STT 진행");
          setShowSTT(true);
          setHasSTTStarted(true);
        } else {
          console.log("⚠️ 품질 검증 실패 - 사용자에게 경고 표시");
          setShowQualityWarning(true);
        }
      };
      // 함수 호출
      processAudioQuality();
      // 오디오 메타데이터 로드 (더 정확한 duration, 선택사항)
      if (url) {
        setTimeout(() => {
          if (audioUrlRef.current === url) {
            const audio = new Audio(url);
            audio.addEventListener("loadedmetadata", () => {
              if (audio.duration && isFinite(audio.duration)) {
                setAudioDuration(Math.floor(audio.duration));
              }
            });
            audio.addEventListener("error", (e) => {
              console.error("Audio loading error:", e);
            });
            audio.load();
          }
        }, 100);
      }
    }
  }, [audioBlob, recordingTime, hasSTTStarted, cleanupAudioUrl, autoStopTimer]);

  useEffect(() => {
    return cleanupAudioUrl;
  }, [cleanupAudioUrl]);

  //녹음 중 뒤로가기, 새로고침 대응
  useEffect(() => {
    const handleRouteChangeStart = (url: string) => {
      if (isRecording && url !== router.asPath) {
        const shouldLeave = window.confirm(
          "녹음이 진행 중입니다.\n\n페이지를 떠나면 녹음이 중단됩니다.\n정말로 떠나시겠습니까?"
        );

        if (!shouldLeave) {
          router.events.emit("routeChangeError");
          throw "Route change cancelled";
        } else {
          // 녹음 정리
          cleanupForPageUnload();
        }
      }
    };

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      // 녹음 중이면 경고 메시지
      if (isRecording) {
        const message =
          "녹음이 진행 중입니다.\n\n페이지를 떠나면 녹음이 중단됩니다.\n정말로 떠나시겠습니까?";
        event.preventDefault();
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore: Deprecated, but required for cross-browser support
        event.returnValue = message;
        return message;
      }

      // 강제 정리 작업
      cleanupForPageUnload();
    };

    // 이벤트 리스너 등록
    if (isRecording) {
      //  Next.js 라우터 이벤트
      router.events.on("routeChangeStart", handleRouteChangeStart);
    }

    window.addEventListener("beforeunload", handleBeforeUnload);
    window.addEventListener("unload", cleanup); // iOS Safari용

    return () => {
      // : Next.js 라우터 이벤트 정리
      router.events.off("routeChangeStart", handleRouteChangeStart);

      //  브라우저 이벤트 정리
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("unload", cleanup);
      // 컴포넌트 언마운트 시에만 완전 정리
      cleanup();
    };
  }, [isRecording, router, cleanupForPageUnload, cleanup]);

  // =====================================
  // ========== 이벤트 핸들러 =============
  // =====================================

  //////////// 메인 녹음 핸들러
  // 녹음 시작
  const startRecording = async () => {
    try {
      console.group("[vr]녹음 시작 요청");

      // 이전 녹음 결과 초기화
      setAudioUrl(null);
      setAudioDuration(null);
      setTranscription(null);
      setTranscriptionError(null);
      setShowSTT(false);
      setQualityResult(null);
      setShowQualityWarning(false);

      // 최대 시간 관련 상태 초기화
      setIsNearMaxTime(false);
      if (autoStopTimer) {
        clearTimeout(autoStopTimer);
        setAutoStopTimer(null);
      }

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

      // 실제 녹음 시작할 때 시간 기록
      const actualStartTime = new Date();
      setRecordingStartTime(actualStartTime);
      setRecordingEndTime(null); // 이전 종료 시간 초기화

      // 실제 녹음 시작

      // MobileOptimizedRecorder의 startRecording 호출
      await startMobileRecording();

      // 최소 녹음 시간 타이머 (기존)
      setCanStopRecording(false);
      setTimeout(() => {
        setCanStopRecording(true);
      }, MINIMUM_RECORDING_SECONDS * 1000);

      // : 90초 경고 타이머
      setTimeout(() => {
        setIsNearMaxTime(true);
      }, WARNING_START_TIME * 1000); // 90초

      //  최대 시간 자동 종료 타이머
      const maxTimer = setTimeout(() => {
        console.log("최대 녹음 시간 도달 - 자동 종료");
        stopRecording();
      }, MAXIMUM_RECORDING_SECONDS * 1000);

      setAutoStopTimer(maxTimer);

      console.log("✅ 녹음 시작 완료");
      console.groupEnd();
    } catch (err) {
      console.error("❌ 녹음 시작 실패:", err);
      setIsCountingDown(false);
      setCountdown(null);
      alert(`녹음 시작 실패: ${(err as Error).message}`);
    }
  };

  // 녹음 중지
  const stopRecording = async () => {
    try {
      console.log("녹음 종료 요청");
      const actualEndTime = new Date();
      setRecordingEndTime(actualEndTime);

      //  타이머 정리
      if (autoStopTimer) {
        clearTimeout(autoStopTimer);
        setAutoStopTimer(null);
      }
      setIsNearMaxTime(false);

      await stopMobileRecording();
      console.log("✅ 녹음 종료 완료");
      // 세션 정보 계산
      if (recordingStartTime) {
        const sessionDuration =
          (actualEndTime.getTime() - recordingStartTime.getTime()) / 1000;
        console.log(
          `녹음 세션: ${sessionDuration}초, 실제 녹음: ${recordingTime}초`
        );
      }
    } catch (err) {
      console.error("❌ 녹음 종료 실패:", err);
    }
  };

  //////////// UI 인터랙션 핸들러
  // 품질 경고 무시하고 계속 진행
  const proceedDespiteQuality = () => {
    setShowQualityWarning(false);
    setShowSTT(true);
    console.warn("⚠️ 사용자가 품질 경고를 무시하고 STT 진행");
  };

  //녹음한 음성 다시듣기
  // 오디오 재생/정지 함수
  const togglePlayback = () => {
    if (!audioRef) return;

    // console.log("audioRef?", audioRef);

    if (isPlaying) {
      audioRef.pause();
      setIsPlaying(false);
    } else {
      audioRef.play().catch(console.error);
      setIsPlaying(true);
    }
  };

  //버튼 스타일
  const getButtonStyle = () => {
    if (isRecording) {
      return styles.recordingButton; // 빨간색
    }
    return styles.readyButton; // 초록색
  };

  ///////////// STT 관련 핸들러
  // STT 분석 상태 변경 핸들러
  const handleSTTStateChange = (isTranscribing: boolean) => {
    setIsSTTProcessing(isTranscribing);
  };

  // STT 결과 처리
  const handleTranscriptionComplete = (
    result: WhisperTranscriptionResult | null
  ) => {
    setTranscription(result);
    if (result) {
      setTranscriptionError(null);
      setIsSTTProcessing(false);
      console.log("✅ STT 변환 완료:", result);
    }
  };

  const handleTranscriptionError = (error: string) => {
    setTranscriptionError(error);
    setIsSTTProcessing(false);
    setTranscription(null);
    console.error("❌ STT 변환 실패:", error);
  };

  ///////////// 업로드 및 처리 핸들러
  const handleUpload = async () => {
    // 튜토리얼인 경우 서버 업로드 없이 바로 완료 처리
    if (isTutorial) {
      console.log("튜토리얼 녹음 완료:", transcription?.transcript);
      onRecordingComplete?.();
      if (onAllScriptsComplete && totalScriptsCount && completedScriptsCount) {
        if (completedScriptsCount + 1 >= totalScriptsCount) {
          onAllScriptsComplete();
        }
      }
      return;
    }

    if (!recordingStartTime || !recordingEndTime) {
      console.error("녹음 시간 정보가 없습니다.");
      return;
    }
    // 세션 정보 계산
    const sessionDuration =
      (recordingEndTime.getTime() - recordingStartTime.getTime()) / 1000;
    const actualDuration = audioDuration || recordingTime;

    if (!audioBlob || !audioDuration || !fullUser?.profile.userId) {
      console.error("업로드에 필요한 데이터가 없습니다.");
      return;
    }

    try {
      let sttText = transcription?.transcript || "";
      // STT 단계
      if (!transcription) {
        setUploadProgress({
          step: "stt",
          message: "음성을 텍스트로 변환하고 있습니다...",
        });
        console.log("업로드 중 STT 수행...");
        setIsSTTProcessing(true);
        sttText = (await performSTTForUpload(audioBlob)) || "";
        setIsSTTProcessing(false);
      }
      // 오디오 업로드 단계
      setUploadProgress({
        step: "audio_upload",
        message: "음성 파일을 업로드하고 있습니다...",
      });
      console.log("업로드 시작:", {
        userId: fullUser.profile.userId,
        scriptType,
        scriptId: scriptData.id,
        duration: audioDuration,
        sttText: sttText,
      });

      const originalScript =
        scriptType === ScriptType.SITUATIONAL && "main_content" in scriptData
          ? scriptData.main_content
          : "formal_script" in scriptData
          ? scriptData.formal_script
          : "";

      const gender = fullUser ? fullUser.profile.gender : "불명";
      const ageGroup = fullUser ? fullUser.profile.ageGroup : "불명";
      const userName = fullUser ? fullUser.profile.userName : "불명";

      const typedScript = scriptData as {
        service_name: string;
        task_name: string;
        service_target: string;
        task_key: string;
      };

      const uploadResult = await uploadAudioMutation.mutateAsync({
        // === 기본 정보 ===
        userId: fullUser.profile.userId,
        taskKey: typedScript.task_key, // "건강-건강정보-1"
        taskType:
          scriptType === ScriptType.SITUATIONAL ? "situational" : "formal",
        audioBlob: qualityResult?.processedBlob || audioBlob, // ← 처리된 오디오 사용

        // === 녹음 세션 정보 (새로 추가) ===
        recordingStartedAt: recordingStartTime.toISOString(),
        recordingEndedAt: recordingEndTime.toISOString(),
        actualDuration: actualDuration,
        sessionDuration: sessionDuration,

        // === 텍스트 데이터 ===
        originalScript, // 제시된 원본 스크립트
        sttTranscription: sttText, // STT로 변환된 텍스트

        // 스크립트 메타데이터
        domain: typedScript.service_name, // service_name → domain ("건강", "교통" 등)
        intent: typedScript.task_name, // task_name → intent ("건강정보입력(식사기록)" 등)
        category: typedScript.service_target, // service_target → category ("건강정보", "고속버스" 등)

        // === 화자 정보 ===
        gender, // "male" | "female"
        ageGroup, // "60-64세" 등
        userName,

        // === 품질 평가 ===

        audioFormat: AudioFormat.WAV, // 오디오 포맷
        deviceInfo: navigator.userAgent, // 녹음 기기 정보

        // 🔥 VAD 관련 데이터 flat하게 추가
        vadApplied: qualityResult?.vadApplied || false,
        originalDuration: recordingTime,
        processedDuration: qualityResult?.processedDuration || actualDuration,
        silenceRemoved: qualityResult?.silenceRemoved || 0,
        compressionRatio: qualityResult?.compressionRatio || 1.0,
        speechSegments: qualityResult?.speechSegments || 1,
        qualityScore: qualityResult?.score || 70,
        qualityIssues: qualityResult?.issues || [],
        qualityRecommendations: qualityResult?.recommendations || [],
      });
      console.log("오디오 업로드 완료:", uploadResult);

      // 사용자 정보 업데이트 단계
      setUploadProgress({
        step: "user_update",
        message: "사용자 정보를 업데이트하고 있습니다...",
      });

      const completeResult = await completeUserScriptMutation.mutateAsync({
        userId: fullUser.profile.userId,
        taskKey: typedScript.task_key,
        taskType:
          scriptType === ScriptType.SITUATIONAL ? "situational" : "formal",
        status: "completed", // 또는 "in_progress", "not_started"
        audioRecordId: uploadResult.recordingId,
        recordingDuration: actualDuration,
      });
      console.log("✅ completeResult:", completeResult);

      //  - 캐시 상태 확인
      console.log("제출 직전 fullUser:", fullUser);

      // 잠시 후 캐시 상태 다시 확인
      // setTimeout(() => {
      //   console.log("제출 3초 후 캐시 상태 확인");
      //   // 현재 캐시된 user 데이터 확인
      //   const cachedUser = queryClient.getQueryData(["user", fullUser.id]);
      //   console.log("캐시된 사용자 데이터:", cachedUser);
      // }, 3000);
      // 완료 단계
      setUploadProgress({
        step: "complete",
        message: "제출이 완료되었습니다!",
      });

      // 잠시 후 팝업 표시
      setTimeout(() => {
        onRecordingComplete?.();
        setUploadProgress({ step: "idle", message: "" });
      }, 1000);

      console.log("전체 처리 성공");
    } catch (error) {
      console.error("처리 실패:", error);

      // 에러 시 상태 초기화
      setUploadProgress({ step: "idle", message: "" });

      const errorMessage =
        error instanceof Error
          ? error.message
          : "알 수 없는 오류가 발생했습니다.";

      alert(`오류: ${errorMessage}`);
    }
  };

  // 새로 녹음하기
  const handleNewRecording = () => {
    console.log("🔄 새 녹음 준비 중...");

    // 기존 오디오 URL 정리 (개선된 방식)
    cleanupAudioUrl();

    //  타이머 정리
    if (autoStopTimer) {
      clearTimeout(autoStopTimer);
      setAutoStopTimer(null);
    }

    // 훅의 audioBlob과 모든 리소스 초기화
    resetRecorder();
    // 모든 상태 초기화
    setAudioUrl(null);
    setAudioDuration(null);
    setTranscription(null);
    setTranscriptionError(null);
    setShowSTT(false);
    setQualityResult(null);
    setShowQualityWarning(false);
    setIsSTTProcessing(false);
    setHasSTTStarted(false);

    setCountdown(null);
    setIsCountingDown(false);
    scrollToTop();

    // 녹음 강제 변수들 초기화
    setCanStopRecording(false);
    setRecordingStartTime(null);

    // 오디오 플레이어 상태 초기화
    setIsPlaying(false);
    if (audioRef) {
      audioRef.pause();
      audioRef.currentTime = 0;
    }
    setAudioRef(null);

    //  최대 시간 관련 상태 초기화
    setIsNearMaxTime(false);

    console.log("✅ 새 녹음 준비 완료");
  };

  // =================================
  // ========= 조건부 렌더링 로직 ======
  // ==================================
  // 로딩 상태 체크
  const isUploading = uploadAudioMutation.isPending;
  const uploadError = uploadAudioMutation.error;

  // ===========================
  // ========= JSX 반환 =========
  // ============================

  return (
    <div>
      {/* 카운트다운 표시 */}
      {isCountingDown && countdown && (
        <div className={styles.countdownContainer}>
          <div className={styles.countdownNumber}>{countdown}</div>
          <p className={styles.countdownText}>잠시 후 녹음이 시작됩니다</p>
        </div>
      )}

      {/* 녹음 시간 표시 */}
      {isRecording && (
        <div className={styles.recordingStatus}>
          <div className={styles.recordingTopRow}>
            <div className={styles.recordingIndicator}></div>
            <span className={styles.recordingTime}>
              녹음 중: {formatTime(recordingTime)}
            </span>
          </div>
          {/* 최대 시간 경고 */}
          {isNearMaxTime && (
            <div className={styles.maxTimeWarning}>
              {MAXIMUM_RECORDING_SECONDS - recordingTime}초 후 자동 종료됩니다.
            </div>
          )}
          {!canStopRecording && (
            <div className={styles.minimumTimeNotice}>
              최소 {MINIMUM_RECORDING_SECONDS}초 이상 녹음해주세요 (남은 시간:{" "}
              {Math.max(0, MINIMUM_RECORDING_SECONDS - recordingTime)}초)
            </div>
          )}
        </div>
      )}

      {/* 녹음 결과가 없을 때만 메인 녹음 버튼 표시 */}
      {!audioUrl && (
        <button
          className={`${styles.recordButton} ${getButtonStyle()} ${
            isRecording && !canStopRecording ? styles.recordingDisabled : ""
          }`}
          onClick={isRecording ? stopRecording : startRecording}
          disabled={
            isUploading || isCountingDown || (isRecording && !canStopRecording)
          }
        >
          <div className={styles.recordButtonTextWrapper}>
            {isCountingDown ? (
              // 카운트다운 중 표시
              <>
                <span className={styles.recordIcon}>⏳</span>
                <span className={styles.recordMainText}>
                  녹음을 준비하는 중입니다
                </span>
                <span className={styles.recordSubText}>
                  {countdown}초 후 녹음이 시작됩니다
                </span>
              </>
            ) : !isRecording ? (
              // 녹음 시작 전
              <>
                <span className={styles.recordIcon}>🎤</span>
                <span className={styles.recordMainText}>녹음을 시작하려면</span>
                <span className={styles.recordMainText}>
                  여기를 눌러주세요!
                </span>
              </>
            ) : canStopRecording ? (
              // 녹음 중 (종료 가능)
              <>
                <span className={styles.recordMainText}>녹음을 끝내시려면</span>
                <span className={styles.recordMainText}>
                  여기를 눌러주세요!
                </span>
              </>
            ) : (
              // 녹음 중 (최소 시간 대기)
              <>
                <span className={styles.recordMainText}>녹음 중...</span>
                <span className={styles.recordSubText}>
                  ({Math.max(0, MINIMUM_RECORDING_SECONDS - recordingTime)}초 후
                  종료 가능)
                </span>
              </>
            )}
          </div>
        </button>
      )}

      {isRecording && (
        <div className={styles.recordingNotice}>
          🎤{" "}
          {canStopRecording
            ? "녹음을 끝내려면 "
            : `최소 ${MINIMUM_RECORDING_SECONDS}초 이상 녹음 후 `}
          <span className={styles.redText}>빨간 버튼</span>을 눌러주세요
        </div>
      )}

      {/* 🎯 품질 경고 표시 */}
      {showQualityWarning && qualityResult && (
        <div className={styles.qualityWarning}>
          <h4>⚠️ 녹음된 음성의 품질이 좋지 않습니다</h4>
          {audioUrl ? (
            <div className={styles.audioPreview}>
              <p>🔉 녹음된 음성 확인하기:</p>
              <audio className={styles.audioPlayer} src={audioUrl} controls />
            </div>
          ) : (
            <div className={styles.audioError}>
              ❌ 음성 파일을 불러올 수 없습니다. 다시 녹음해 주세요.
            </div>
          )}
          <div className={styles.qualityScore}>
            품질 점수: {qualityResult.score}/100 점
          </div>
          <div className={styles.fileSizeInfo}>
            파일 크기: {qualityResult.fileSizeKB}KB
          </div>

          {qualityResult.issues.length > 0 && (
            <div className={styles.qualityIssues}>
              <strong>문제점:</strong>
              <ul>
                {qualityResult.issues.map((issue, index) => (
                  <li key={index}>{issue}</li>
                ))}
              </ul>
            </div>
          )}

          {qualityResult.recommendations.length > 0 && (
            <div className={styles.qualityRecommendations}>
              <strong>개선 방법:</strong>
              <ul>
                {qualityResult.recommendations.map((rec, index) => (
                  <li key={index}>{rec}</li>
                ))}
              </ul>
            </div>
          )}

          <div className={styles.qualityActions}>
            <button
              className={styles.retryRecordingButton}
              onClick={handleNewRecording}
            >
              🔄 다시 녹음하기(권장)
            </button>
            <button
              className={styles.proceedButton}
              onClick={proceedDespiteQuality}
            >
              그대로 진행하기
            </button>
          </div>
        </div>
      )}

      {/* 오디오 섹션 (품질 통과 시) */}
      {audioUrl && !showQualityWarning && (
        <div className={styles.audioSection}>
          <div className={styles.audioHeader}>
            <p className={styles.audioLabel}>🔉 녹음</p>
            {audioDuration && (
              <span className={styles.audioDuration}>
                길이: {formatTime(audioDuration)}
              </span>
            )}
          </div>
          <div className={styles.customAudioPlayer}>
            <audio
              ref={setAudioRef}
              src={audioUrl}
              preload="none"
              playsInline
              onError={() => setIsPlaying(false)}
              onCanPlayThrough={() => console.log("Audio ready")}
              style={{ display: "none" }}
              onEnded={() => {
                setTimeout(() => {
                  setIsPlaying(false);
                }, 1500);
              }}
            />
            <button
              className={styles.playButton}
              onClick={togglePlayback}
              disabled={!audioUrl}
            >
              {isPlaying ? "⏸️ 재생 멈추기" : "▶️ 녹음한 음성 확인하기"}
            </button>
          </div>
          {isTutorial ? (
            <p className={styles.tutorialDetailedInstruction}>
              녹음한 음성을 제출하기 전에, 잘 녹음 되었는지 확인해주세요
            </p>
          ) : (
            <></>
          )}
          <div className={styles.actionButtons}>
            {audioBlob && (
              <button
                className={styles.uploadButton}
                onClick={handleUpload}
                disabled={
                  isUploading ||
                  isSTTProcessing ||
                  uploadProgress.step !== "idle"
                }
              >
                {uploadProgress.step !== "idle"
                  ? isDevMode
                    ? uploadProgress.message // 개발: 상세 메시지
                    : "업로드 중..." // 프로덕션: 간단 메시지
                  : isSTTProcessing
                  ? "음성 변환 중..."
                  : isUploading
                  ? isTutorial
                    ? "완료 중..."
                    : "제출 중..."
                  : isTutorial
                  ? "연습 녹음 제출하기"
                  : "제출하기"}
              </button>
            )}
            {uploadProgress.step !== "idle" && (
              <div className={styles.uploadProgressContainer}>
                {/* 공통: 진행 바는 항상 표시 */}
                <div className={styles.progressBar}>
                  <div
                    className={styles.progressFill}
                    style={{
                      width:
                        uploadProgress.step === "stt"
                          ? "25%"
                          : uploadProgress.step === "audio_upload"
                          ? "50%"
                          : uploadProgress.step === "user_update"
                          ? "75%"
                          : uploadProgress.step === "complete"
                          ? "100%"
                          : "0%",
                    }}
                  />
                </div>

                {/* 개발 모드: 상세 메시지 표시 */}
                {isDevMode && (
                  <p className={styles.progressMessage}>
                    {uploadProgress.message}
                  </p>
                )}

                {/* 프로덕션 모드: 간단한 메시지 */}
                {!isDevMode && (
                  <p className={styles.progressMessageSimple}>
                    제출 중입니다, 잠시만 기다려 주세요... (
                    {uploadProgress.step === "stt"
                      ? "1"
                      : uploadProgress.step === "audio_upload"
                      ? "2"
                      : uploadProgress.step === "user_update"
                      ? "3"
                      : uploadProgress.step === "complete"
                      ? "4"
                      : "0"}
                    /4)
                  </p>
                )}

                {/* 개발 모드: 상세 단계 표시 */}
                {isDevMode && (
                  <div className={styles.progressSteps}>
                    <span
                      className={
                        uploadProgress.step === "stt"
                          ? styles.activeStep
                          : styles.completedStep
                      }
                    >
                      1. 음성 변환
                    </span>
                    <span
                      className={
                        uploadProgress.step === "audio_upload"
                          ? styles.activeStep
                          : ["user_update", "complete"].includes(
                              uploadProgress.step
                            )
                          ? styles.completedStep
                          : styles.pendingStep
                      }
                    >
                      2. 파일 업로드
                    </span>
                    <span
                      className={
                        uploadProgress.step === "user_update"
                          ? styles.activeStep
                          : uploadProgress.step === "complete"
                          ? styles.completedStep
                          : styles.pendingStep
                      }
                    >
                      3. 정보 갱신
                    </span>
                    <span
                      className={
                        uploadProgress.step === "complete"
                          ? styles.activeStep
                          : styles.pendingStep
                      }
                    >
                      4. 완료
                    </span>
                  </div>
                )}

                {/* 프로덕션 모드: 간단한 점 표시 */}
                {!isDevMode && (
                  <div className={styles.progressDotsContainer}>
                    <div className={styles.progressDots}>
                      <span
                        className={
                          [
                            "stt",
                            "audio_upload",
                            "user_update",
                            "complete",
                          ].includes(uploadProgress.step)
                            ? styles.activeDot
                            : styles.pendingDot
                        }
                      />
                      <span
                        className={
                          ["audio_upload", "user_update", "complete"].includes(
                            uploadProgress.step
                          )
                            ? styles.activeDot
                            : styles.pendingDot
                        }
                      />
                      <span
                        className={
                          ["user_update", "complete"].includes(
                            uploadProgress.step
                          )
                            ? styles.activeDot
                            : styles.pendingDot
                        }
                      />
                      <span
                        className={
                          uploadProgress.step === "complete"
                            ? styles.activeDot
                            : styles.pendingDot
                        }
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
            {isTutorial ? (
              <p className={styles.tutorialDetailedInstruction}>
                녹음한 음성은 제출하기 버튼을 눌러서 제출해주세요
              </p>
            ) : (
              <></>
            )}

            <button
              className={styles.newRecordingButton}
              onClick={handleNewRecording}
              disabled={isUploading || isSTTProcessing}
            >
              {isSTTProcessing ? "분석 중..." : "새로 녹음하기"}
            </button>
            {isTutorial ? (
              <p className={styles.tutorialDetailedInstruction}>
                다시 녹음을 하려면 새로 녹음하기 버튼을 눌러서 녹음해주세요
              </p>
            ) : (
              <></>
            )}

            {/* STT 컴포넌트 */}
            {showSTT && (
              <SttWhisper
                audioBlob={audioBlob}
                onTranscriptionComplete={handleTranscriptionComplete}
                onError={handleTranscriptionError}
                onTranscribingStateChange={handleSTTStateChange}
                autoTranscribe={false}
              />
            )}

            {/* STT 에러 표시 */}
            {transcriptionError && (
              <div className={styles.errorMessage}>
                ❌ 변환 실패: {transcriptionError}
                <p className={styles.errorGuidance}>
                  음성 변환에 실패했습니다. 새로 녹음해주세요.
                </p>
              </div>
            )}

            {/* STT 변환 결과 */}
            {transcription && (
              <div className={styles.GoogleTranscriptionResult}>
                <div className={styles.transcriptionText}>
                  <p className={styles.transcriptContent}>
                    {transcription.transcript}
                  </p>
                </div>
              </div>
            )}

            {isTutorial ? (
              <p className={styles.tutorialDetailedInstruction}>
                녹음한 음성을 글자로 바꿔보고 싶으시다면, 여기를 눌러보세요
              </p>
            ) : (
              <></>
            )}
          </div>

          {/* 업로드 에러 */}
          {uploadError && (
            <div className={styles.errorMessage}>
              ❌ 제출 실패: {uploadError.message}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const VoiceRecorder = dynamic(() => Promise.resolve(RecorderComponent), {
  ssr: false,
  loading: () => (
    <p className={styles.loading}>음성 녹음 기능을 불러오고 있습니다...</p>
  ),
});

export default VoiceRecorder;
