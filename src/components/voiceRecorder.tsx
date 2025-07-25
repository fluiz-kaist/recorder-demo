/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import styles from "@/styles/VoiceRecorder.module.css";
import { useScrollToTop } from "@/hooks/useScrollToTop";
import type { WhisperTranscriptionResult } from "@/components/stt/SttWhisper";
import {
  ScriptType,
  SituationalScript,
  FormalScript,
  AudioFormat,
  TutorialScript,
} from "@/types/firebase";
import { useMobileOptimizedRecorder } from "@/hooks/useMobileOptimizedRecorder";
import SuccessPopup from "@/components/SuccessPopup";
import { useUploadAudioMutation } from "@/hooks/mutations/useAudioMutations";

// import { useCompleteScriptMutation } from "@/hooks/mutations/useScriptMutations";
import { useAuthStatusQuery } from "@/hooks/queries/useUserQueries";
import SttWhisper from "@/components/stt/SttWhisper";
import { useUserQuery } from "@/hooks/queries/useUserQueries";
import { useAssignScriptsMutation } from "@/hooks/mutations/useScriptMutations";
import { useCompleteScriptMutation } from "@/hooks/mutations/useUserMutations";
import { useAllLocalScriptsQuery } from "@/hooks/queries/useScriptQueries";
// 🎯 간단한 품질 검증 결과 인터페이스
interface SimpleQualityResult {
  isGoodQuality: boolean;
  score: number; // 0-100 점수
  issues: string[];
  recommendations: string[];
  fileSize: number;
  fileSizeKB: number;
}
type AnyScript = SituationalScript | FormalScript;
// Props 인터페이스 수정
interface VoiceRecorderProps {
  scriptType: ScriptType;
  scriptData: AnyScript;
  onRecordingComplete?: () => void;
  isCompltedScript?: boolean;
  isTutorial?: boolean;
  onAllScriptsComplete?: () => void; // 새로 추가
  totalScriptsCount?: number; // 새로 추가
  completedScriptsCount?: number; // 새로 추가
}

//  최소 녹음 시간 설정 (초 단위)
const MINIMUM_RECORDING_SECONDS = 5;

const RecorderComponent: React.FC<VoiceRecorderProps> = ({
  scriptType,
  scriptData,
  onRecordingComplete,
  isCompltedScript,
  isTutorial = false,
  onAllScriptsComplete,
  totalScriptsCount,
  completedScriptsCount,
}) => {
  console.log("VoiceRecorder props:", { scriptType, scriptData });

  const [isClient, setIsClient] = useState(false);
  const [audioDuration, setAudioDuration] = useState<number | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isSTTProcessing, setIsSTTProcessing] = useState(false);
  const [isSTTSuccess, setIsSTTSuccess] = useState(false);
  // 스크롤 훅 사용
  const scrollToTop = useScrollToTop();
  // STT 관련 상태
  const [transcription, setTranscription] =
    useState<WhisperTranscriptionResult | null>(null);
  const [transcriptionError, setTranscriptionError] = useState<string | null>(
    null
  );
  const [showSTT, setShowSTT] = useState(false);

  // 간단한 품질 검증 관련 상태
  const [qualityResult, setQualityResult] =
    useState<SimpleQualityResult | null>(null);
  const [showQualityWarning, setShowQualityWarning] = useState(false);

  // 성공 팝업 관련 상태
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);

  const [countdown, setCountdown] = useState<number | null>(null);
  const [isCountingDown, setIsCountingDown] = useState(false);
  const [hasSTTStarted, setHasSTTStarted] = useState(false);
  // React Query 훅들
  const { data: authToken } = useAuthStatusQuery();
  const uploadAudioMutation = useUploadAudioMutation();
  const completeUserScriptMutation = useCompleteScriptMutation();
  const assignScriptsMutation = useAssignScriptsMutation();
  const { data: localScripts } = useAllLocalScriptsQuery();
  //녹음 정지 강제 관리
  const [canStopRecording, setCanStopRecording] = useState(false);
  const [recordingStartTime, setRecordingStartTime] = useState<number | null>(
    null
  );
  //녹음 파일 다시듣기 상태
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioRef, setAudioRef] = useState<HTMLAudioElement | null>(null);
  const { data: fullUser } = useUserQuery();
  // MobileOptimizedRecorder hook 사용
  const {
    isRecording,
    recordingTime,
    audioBlob,
    startRecording: startMobileRecording,
    stopRecording: stopMobileRecording,
    resetRecorder,
  } = useMobileOptimizedRecorder();

  // 성공 팝업 닫기 핸들러
  const handleCloseSuccessPopup = () => {
    setShowSuccessPopup(false);
    onRecordingComplete?.();
  };

  // STT 분석 상태 변경 핸들러
  const handleSTTStateChange = (isTranscribing: boolean) => {
    setIsSTTProcessing(isTranscribing);
  };

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

  // 파일 크기 기반 간단한 품질 검증 (1-5ms 완료)
  const validateAudioQualitySimple = (
    blob: Blob,
    recordingDuration: number
  ): SimpleQualityResult => {
    const startTime = performance.now();

    const fileSize = blob.size;
    const fileSizeKB = Math.round(fileSize / 1024);

    let score = 100;
    const issues: string[] = [];
    const recommendations: string[] = [];

    console.log(
      `🔍 간단 품질 검증 시작: 파일크기=${fileSizeKB}KB, 시간=${recordingDuration}초`
    );

    // 1. 녹음 시간 체크
    if (recordingDuration < 2) {
      score -= 40;
      issues.push("녹음 시간이 너무 짧습니다");
      recommendations.push("최소 2초 이상 말씀해 주세요");
    } else if (recordingDuration < 3) {
      score -= 20;
      issues.push("녹음 시간이 조금 짧습니다");
      recommendations.push("더 자세히 말씀해 주세요");
    }

    if (recordingDuration > 60) {
      score -= 10;
      issues.push("녹음 시간이 너무 깁니다");
      recommendations.push("1분 이내로 간결하게 말씀해 주세요");
    }

    // 2. 파일 크기 절대값 체크
    if (fileSizeKB < 5) {
      score -= 50;
      issues.push("파일이 너무 작습니다 (거의 무음상태)");
      recommendations.push("마이크를 확인하고 더 크게 말씀해 주세요");
    } else if (fileSizeKB < 15) {
      score -= 30;
      issues.push("음성이 너무 작게 녹음되었습니다");
      recommendations.push("조금 더 크게 말씀해 주세요");
    }

    if (fileSizeKB > 10000) {
      score -= 5;
      issues.push("파일이 예상보다 큽니다");
    }

    // 3. 파일 크기 대비 시간 비율 체크 (핵심 지표)
    const expectedSizePerSecond = 8; // KB/초 (WebM Opus 64kbps 기준)
    const expectedSize = recordingDuration * expectedSizePerSecond;
    const sizeRatio = fileSizeKB / expectedSize;

    console.log(
      `📊 크기 비율 분석: 예상=${expectedSize}KB, 실제=${fileSizeKB}KB, 비율=${sizeRatio.toFixed(
        2
      )}`
    );

    if (sizeRatio < 0.1) {
      score -= 40;
      issues.push("거의 무음상태로 녹음되었습니다");
      recommendations.push(
        "마이크 권한을 확인하고 조용한 곳에서 다시 녹음해 주세요"
      );
    } else if (sizeRatio < 0.3) {
      score -= 25;
      issues.push("음성이 너무 작게 녹음되었습니다");
      recommendations.push(
        "스마트폰을 입에서 15-20cm 거리에 두고 더 크게 말씀해 주세요"
      );
    } else if (sizeRatio < 0.5) {
      score -= 10;
      issues.push("음성이 조금 작게 녹음되었습니다");
      recommendations.push("조금 더 크게 말씀해 주세요");
    }

    // 4. 포맷 체크
    if (!blob.type.includes("webm")) {
      score -= 5;
      issues.push("최적 포맷이 아닙니다");
    }

    // 5. 시간당 파일 크기가 너무 작은 경우 (발음 불분명 가능성)
    if (recordingDuration > 0 && fileSizeKB / recordingDuration < 3) {
      score -= 15;
      issues.push("발음이 불분명하거나 음성이 약할 수 있습니다");
      recommendations.push("천천히, 또렷하게 말씀해 주세요");
    }

    const result: SimpleQualityResult = {
      isGoodQuality: score >= 70 && issues.length <= 1,
      score: Math.max(0, score),
      issues,
      recommendations,
      fileSize,
      fileSizeKB,
    };

    const endTime = performance.now();
    console.log(
      `✅ 간단 품질 검증 완료: ${(endTime - startTime).toFixed(2)}ms, 점수=${
        result.score
      }/100`
    );

    return result;
  };

  // 클라이언트 사이드에서만 실행되도록 보장
  useEffect(() => {
    console.log("🚀 VoiceRecorder 컴포넌트 마운트됨");
    setIsClient(true);
  }, []);

  // 🔥 녹음 시작
  const startRecording = async () => {
    try {
      console.log("[vr]녹음 시작 요청");

      // 튜토리얼 스크립트이고 로컬에 스크립트가 없는 경우에만 할당 실행
      if (isTutorial && authToken?.userId && !localScripts) {
        try {
          console.log("튜토리얼 스크립트 - 로컬 스크립트 없음, 할당 실행");
          await assignScriptsMutation.mutateAsync({
            userId: authToken.userId,
          });
          console.log("튜토리얼 스크립트 할당 완료");
        } catch (error) {
          console.error("튜토리얼 스크립트 할당 실패:", error);
          // 스크립트 할당 실패해도 녹음은 계속 진행
        }
      } else if (isTutorial && localScripts) {
        console.log(
          "튜토리얼 스크립트 - 이미 로컬에 스크립트 존재, 할당 건너뜀"
        );
      }

      // 이전 녹음 결과 초기화
      setAudioUrl(null);
      setAudioDuration(null);
      setTranscription(null);
      setTranscriptionError(null);
      setShowSTT(false);
      setQualityResult(null);
      setShowQualityWarning(false);
      setIsSTTSuccess(false);
      setShowSuccessPopup(false);

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

      // 실제 녹음 시작

      // MobileOptimizedRecorder의 startRecording 호출
      await startMobileRecording();

      // 추가: 녹음 시작 시간 기록 및 5초 타이머 시작
      const startTime = Date.now();
      setRecordingStartTime(startTime);
      setCanStopRecording(false);

      // 5초 후에 정지 가능하도록 설정
      setTimeout(() => {
        setCanStopRecording(true);
      }, MINIMUM_RECORDING_SECONDS * 1000);

      console.log("✅ 녹음 시작 완료");
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
      console.log("🛑 녹음 종료 요청");
      await stopMobileRecording();
      console.log("✅ 녹음 종료 완료");
    } catch (err) {
      console.error("❌ 녹음 종료 실패:", err);
    }
  };

  //  audioBlob이 생성되면 즉시 간단한 품질 검증 후 STT 준비
  useEffect(() => {
    if (audioBlob && !hasSTTStarted) {
      console.log("📄 새로운 오디오 blob 생성됨:", {
        size: audioBlob.size,
        type: audioBlob.type,
      });

      let url = "";

      // iOS 호환성을 위한 오디오 URL 생성
      if (
        /iPad|iPhone|iPod/.test(navigator.userAgent) &&
        audioBlob.type.includes("webm")
      ) {
        // iOS에서 WebM 문제 시 Data URL 사용
        const reader = new FileReader();
        reader.onloadend = () => {
          url = reader.result as string;
          // setAudioUrl(reader.result as string);
        };
        reader.readAsDataURL(audioBlob);
      } else {
        // 일반적인 경우
        url = URL.createObjectURL(audioBlob);
      }
      setAudioUrl(url);
      setAudioDuration(recordingTime);

      // 🎯 즉시 간단한 품질 검증 (1-5ms 완료)
      const quality = validateAudioQualitySimple(audioBlob, recordingTime);
      setQualityResult(quality);

      if (quality.isGoodQuality) {
        console.log("✅ 품질 검증 통과 - STT 진행");
        setShowSTT(true);
        setHasSTTStarted(true);
      } else {
        console.log("⚠️ 품질 검증 실패 - 사용자에게 경고 표시");
        setShowQualityWarning(true);
      }

      // 오디오 메타데이터 로드 (더 정확한 duration, 선택사항)
      const audio = new Audio(url);
      audio.addEventListener("loadedmetadata", () => {
        if (audio.duration && isFinite(audio.duration)) {
          setAudioDuration(Math.floor(audio.duration));
        }
      });
      audio.load();

      // Cleanup 함수 (메모리 누수 방지)
      return () => {
        URL.revokeObjectURL(url);
      };
    }
  }, [audioBlob, recordingTime, hasSTTStarted]);

  const performSTTForUpload = async (
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
  // 품질 경고 무시하고 계속 진행
  const proceedDespiteQuality = () => {
    setShowQualityWarning(false);
    setShowSTT(true);
    console.log("⚠️ 사용자가 품질 경고를 무시하고 STT 진행");
  };

  // React Query 기반 업로드 처리
  const handleUpload = async () => {
    // 튜토리얼인 경우 서버 업로드 없이 바로 완료 처리
    if (isTutorial) {
      console.log("튜토리얼 녹음 완료:", transcription?.transcript);
      setShowSuccessPopup(true);
      // 새로 추가: 모든 스크립트 완료 체크
      if (onAllScriptsComplete && totalScriptsCount && completedScriptsCount) {
        // 현재 스크립트까지 포함해서 완료된 개수가 전체와 같은지 체크
        if (completedScriptsCount + 1 >= totalScriptsCount) {
          onAllScriptsComplete();
        }
      }
      return;
    }

    //stt가 있어야 업로드 하는 버전
    // if (!audioBlob || !audioDuration || !authToken?.userId || !transcription) {
    //   console.error("업로드에 필요한 데이터가 없습니다.");
    //   return;
    // }
    if (!audioBlob || !audioDuration || !authToken?.userId) {
      console.error("업로드에 필요한 데이터가 없습니다.");
      return;
    }

    try {
      let sttText = transcription?.transcript || "";

      if (!transcription) {
        console.log("업로드 중 STT 수행...");
        setIsSTTProcessing(true);
        sttText = (await performSTTForUpload(audioBlob)) || "";
        setIsSTTProcessing(false);
      }
      console.log("업로드 시작:", {
        userId: authToken.userId,
        scriptType,
        scriptId: scriptData.id,
        duration: audioDuration,
        sttText: sttText,
      });

      // STT가 아직 안된 경우 업로드 시 STT 수행

      console.log(
        "업로드하려고 하는데, 여기서 지금 스크립트 데이터 형태가?,",
        scriptData
      );

      // 1. 오디오 업로드 (새로운 구조에 맞춤)
      const originalScript =
        scriptType === ScriptType.SITUATIONAL && "main_content" in scriptData
          ? scriptData.main_content
          : "formal_script" in scriptData
          ? scriptData.formal_script
          : "";

      const gender = fullUser ? fullUser.gender : "불명";
      const ageGroup = fullUser ? fullUser.ageGroup : "불명";

      const uploadResult = await uploadAudioMutation.mutateAsync({
        userId: authToken.userId,
        taskKey: scriptData.task_key, // "건강-건강정보-1"
        taskType:
          scriptType === ScriptType.SITUATIONAL ? "situational" : "formal",
        audioBlob,
        originalScript, // 새로운 필드명

        // 스크립트 메타데이터 (새로운 필수 필드들)
        domain: scriptData.service_name, // service_name → domain
        intent: scriptData.task_name, // task_name → intent
        category: scriptData.service_target, // service_target → category

        // 화자 정보
        gender,
        ageGroup,

        // 선택적 정보
        audioFormat: AudioFormat.WAV,
        deviceInfo: navigator.userAgent,
        browserInfo: navigator.userAgent,
      });
      console.log("오디오 업로드 완료:", uploadResult);

      // // 2. 스크립트 완료 처리
      // 2. 스크립트 완료 상태를 유저 정보에 반영 (Firestore participation.sets[].tasks 에 기록)
      const completeResult = await completeUserScriptMutation.mutateAsync({
        userId: authToken.userId,
        taskKey: scriptData.task_key,
        taskType:
          scriptType === ScriptType.SITUATIONAL ? "situational" : "formal",
        status: "completed", // 또는 "in_progress", "not_started"
        audioRecordId: uploadResult.recordingId,
      });
      console.log("스크립트 완료 처리 완료:", completeResult);

      // // 3. 성공 처리
      setShowSuccessPopup(true);
      console.log("전체 처리 성공");
    } catch (error) {
      console.error("처리 실패:", error);

      const errorMessage =
        error instanceof Error
          ? error.message
          : "알 수 없는 오류가 발생했습니다.";

      alert(`오류: ${errorMessage}`);
    }
  };

  // STT 결과 처리
  const handleTranscriptionComplete = (
    result: WhisperTranscriptionResult | null
  ) => {
    setTranscription(result);
    if (result) {
      setTranscriptionError(null);
      setIsSTTSuccess(true);
      setIsSTTProcessing(false);
      console.log("✅ STT 변환 완료:", result);
    }
  };

  const handleTranscriptionError = (error: string) => {
    setTranscriptionError(error);
    setIsSTTProcessing(false);
    setTranscription(null);
    setIsSTTSuccess(false);
    console.error("❌ STT 변환 실패:", error);
  };

  // 새로 녹음하기
  const handleNewRecording = () => {
    console.log("🔄 새 녹음 준비 중...");

    // 기존 오디오 URL 정리 (메모리 누수 방지)
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
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
    setIsSTTSuccess(false);
    setIsSTTProcessing(false);
    setHasSTTStarted(false);
    setShowSuccessPopup(false);
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

    console.log("✅ 새 녹음 준비 완료");
  };

  // 로딩 상태 체크
  // const isUploading =
  //   uploadAudioMutation.isPending || completeScriptMutation.isPending;
  // const uploadError = uploadAudioMutation.error || completeScriptMutation.error;
  const isUploading = uploadAudioMutation.isPending;
  const uploadError = uploadAudioMutation.error;

  if (!isClient) {
    return (
      <div className={styles.loading}>
        <p>로딩 중...</p>
      </div>
    );
  }
  //녹음한 음성 다시듣기
  // 오디오 재생/정지 함수
  const togglePlayback = () => {
    if (!audioRef) return;

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

  return (
    <div>
      {/* 성공 팝업 */}
      {showSuccessPopup && (
        <SuccessPopup
          message={
            isTutorial
              ? "녹음 음성(연습용)이 성공적으로 제출되었습니다!"
              : "녹음한 음성이 성공적으로 제출되었습니다!"
          }
          details={
            transcription
              ? `녹음된 음성 내용: "${transcription.transcript}"`
              : undefined
          }
          onClose={handleCloseSuccessPopup}
        />
      )}

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
            isUploading ||
            isCountingDown ||
            assignScriptsMutation.isPending ||
            (isRecording && !canStopRecording)
          }
        >
          <div className={styles.recordButtonTextWrapper}>
            {!isRecording ? (
              <>
                <span className={styles.recordIcon}>🎤</span>
                <span className={styles.recordMainText}>녹음을 시작하려면</span>
                <span className={styles.recordMainText}>
                  여기를 눌러주세요!
                </span>
              </>
            ) : canStopRecording ? (
              <span className={styles.recordMainText}>녹음 종료</span>
            ) : (
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
            {/* {qualityResult && (
              <span className={styles.qualityBadge}>
                품질: {qualityResult.score}/100 ✅
              </span>
            )} */}
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
                disabled={isUploading || isSTTProcessing}
              >
                {isSTTProcessing
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
  loading: () => <p className={styles.loading}>음성 녹음기 로딩 중...</p>,
});

export default VoiceRecorder;
