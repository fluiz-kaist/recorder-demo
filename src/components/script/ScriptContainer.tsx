// components/script/ScriptContainer.tsx - 메인 컨테이너 컴포넌트
import React, { useState, useEffect } from "react";
import { useRouter } from "next/router";
import styles from "@/styles/ScriptRecording.module.css";
import VoiceRecorder from "@/components/voiceRecorder";
import {
  ScriptType,
  SituationalScript,
  FormalScript,
  QAScenarioScript,
} from "@/types/firebase";
import {
  useLocalScriptsByTypeQuery,
  useScriptProgressByType,
} from "@/hooks/queries/useScriptQueries";
import {
  useAuthStatusQuery,
  useUserScriptAssignmentsQuery,
} from "@/hooks/queries/useUserQueries";
import { useAssignScriptsMutation } from "@/hooks/mutations/useScriptMutations";
import { ScriptRenderer } from "@/components/script/ScriptRenderer";

// 유니온 타입 정의
type AnyScript = SituationalScript | FormalScript | QAScenarioScript;

interface ScriptContainerProps {
  scriptType: ScriptType;
}

export const ScriptContainer: React.FC<ScriptContainerProps> = ({
  scriptType,
}) => {
  const router = useRouter();
  const [scripts, setScripts] = useState<AnyScript[]>([]);
  const [scriptIndex, setScriptIndex] = useState(0);
  const [showRecorder, setShowRecorder] = useState(false);

  // React Query로 스크립트 데이터 가져오기
  const {
    data: scriptData,
    isLoading,
    error: queryError,
    refetch,
  } = useLocalScriptsByTypeQuery(scriptType);

  // 인증 정보 가져오기
  const { data: authToken } = useAuthStatusQuery();

  const userId = authToken?.userId;
  if (!authToken) {
    console.log("- authToken이 null입니다");
  } else if (!userId) {
    console.log("- authToken.userId가 null입니다");
  } else {
    // console.log('✅ 사용자 ID:', userId);
  }

  // 진행률 정보 가져오기
  const scriptProgress = useScriptProgressByType(
    scriptType,
    userId || undefined
  );

  // 사용자 스크립트 할당 정보 가져오기
  const { data: userAssignments } = useUserScriptAssignmentsQuery(
    userId || undefined
  );

  // 스크립트 데이터 설정
  useEffect(() => {
    if (scriptData && Array.isArray(scriptData)) {
      setScripts(scriptData as AnyScript[]);
    }
  }, [scriptData]);

  const assignScriptsMutation = useAssignScriptsMutation();

  // 스크립트 할당 처리
  const handleAssignScripts = async () => {
    if (!authToken?.userId) return;

    try {
      await assignScriptsMutation.mutateAsync({ userId: authToken.userId });
      setTimeout(() => {
        refetch();
      }, 1000);
    } catch (error) {
      console.error("스크립트 할당 실패:", error);
    }
  };

  // 햅틱 피드백 (모바일)
  const triggerHapticFeedback = () => {
    if ("vibrate" in navigator) {
      navigator.vibrate(50);
    }
  };

  const handleRecordingComplete = () => {
    setShowRecorder(false);
  };

  const handleNextScript = () => {
    if (scriptIndex < scripts.length - 1) {
      triggerHapticFeedback();
      setScriptIndex((prev) => prev + 1);
      setShowRecorder(false);
    }
  };

  const handlePrevScript = () => {
    if (scriptIndex > 0) {
      triggerHapticFeedback();
      setScriptIndex((prev) => prev - 1);
      setShowRecorder(false);
    }
  };

  const goBack = () => {
    triggerHapticFeedback();
    router.push("/");
  };

  const getCurrentScript = (): AnyScript | undefined => {
    return scripts[scriptIndex];
  };

  const getProgressPercentage = (): number => {
    if (scriptProgress) {
      return scriptProgress.progress;
    }
    if (scripts.length === 0) return 0;
    return Math.round(((scriptIndex + 1) / scripts.length) * 100);
  };

  // 페이지 제목 가져오기
  const getPageTitle = (): string => {
    switch (scriptType) {
      case ScriptType.SITUATIONAL:
        return "상황별 녹음";
      case ScriptType.FORMAL:
        return "정형화 녹음";
      case ScriptType.QA_SCENARIO:
        return "질의응답 녹음";
      default:
        return "스크립트 녹음";
    }
  };

  // 로딩 중일 때
  if (isLoading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.loadingSpinner}></div>
        <div className={styles.loadingText}>스크립트를 불러오고 있어요...</div>
      </div>
    );
  }

  // 에러가 발생했을 때
  if (queryError) {
    return (
      <div className={styles.errorContainer}>
        <div className={styles.errorCard}>
          <div className={styles.errorIcon}>😕</div>
          <h2 className={styles.errorTitle}>문제가 생겼어요</h2>
          <p className={styles.errorMessage}>{queryError.message}</p>
          <button
            onClick={() => window.location.reload()}
            className={styles.retryButton}
          >
            다시 시도하기
          </button>
        </div>
      </div>
    );
  }

  // 스크립트가 없을 때
  if (scripts.length === 0) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.loadingText}>
          아직 녹음할 스크립트가 없습니다.
        </div>
        <button
          onClick={handleAssignScripts}
          disabled={assignScriptsMutation.isPending}
          className={styles.assignButton}
        >
          {assignScriptsMutation.isPending ? "할당 중..." : "스크립트 할당받기"}
        </button>
      </div>
    );
  }

  const currentScript = getCurrentScript();

  // 현재 스크립트 타입의 할당 정보만 필터링
  const currentAssignment = userAssignments?.find(
    (assignment) => assignment.scriptType === scriptType
  );

  // 현재 스크립트가 완료되었는지 확인하는 함수
  const isCurrentScriptCompleted = (scriptId: number): boolean => {
    if (!currentAssignment) return false;
    return currentAssignment.completedScriptIds.includes(scriptId);
  };

  // 현재 스크립트의 완료 상태
  const currentScriptCompleted = currentScript
    ? isCurrentScriptCompleted(currentScript.id)
    : false;

  return (
    <div className={styles.container}>
      <div className={styles.wrapper}>
        {/* 헤더 */}
        <div className={styles.header}>
          <button onClick={goBack} className={styles.backButton}>
            <svg
              className={styles.backIcon}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={3}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            뒤로가기
          </button>

          <div className={styles.headerTitle}>{getPageTitle()}</div>

          <div className={styles.progressIndicator}>
            {scriptIndex + 1} / {scripts.length}
          </div>
        </div>

        {/* 메인 콘텐츠 */}
        <div className={styles.mainCard}>
          {currentScript && (
            <>
              {/* 스크립트 렌더러 - 타입별로 다른 UI 렌더링 */}
              <ScriptRenderer
                script={currentScript}
                scriptType={scriptType}
                isCompleted={currentScriptCompleted}
              />

              {/* 녹음 섹션 */}
              {!showRecorder ? (
                <div className={styles.recordingSection}>
                  {currentScriptCompleted ? (
                    // 완료된 스크립트 표시
                    <div className={styles.completedSection}>
                      <div className={styles.completedIcon}>🎉</div>
                      <div className={styles.completedMessage}>
                        이미 녹음을 완료했습니다!
                      </div>
                      <div className={styles.reRecordPrompt}>
                        다시 녹음하시겠어요?
                      </div>
                      <VoiceRecorder
                        key={`voice-recorder-${scriptIndex}`}
                        scriptType={scriptType}
                        scriptData={currentScript}
                        isCompltedScript={currentScriptCompleted}
                        onRecordingComplete={handleRecordingComplete}
                      />
                    </div>
                  ) : (
                    // 미완료 스크립트 표시
                    <>
                      <div className={styles.recordingPrompt}>
                        편하게 말씀해주세요!
                      </div>

                      <VoiceRecorder
                        key={`voice-recorder-${scriptIndex}`}
                        scriptType={scriptType}
                        scriptData={currentScript}
                        onRecordingComplete={handleRecordingComplete}
                      />
                    </>
                  )}
                </div>
              ) : (
                /* VoiceRecorder 컴포넌트 활성화 상태 */
                <div className={styles.voiceRecorderSection}>
                  <div className={styles.recorderHeader}>
                    <h3 className={styles.recorderTitle}>🎙️ 음성 녹음</h3>
                    <button
                      onClick={() => setShowRecorder(false)}
                      className={styles.closeRecorderButton}
                    >
                      ✕ 닫기
                    </button>
                  </div>
                  <div className={styles.recorderWrapper}></div>
                  <div className={styles.recorderActions}>
                    <button
                      onClick={handleRecordingComplete}
                      className={styles.completeButton}
                    >
                      ✅ 녹음 완료
                    </button>
                  </div>
                </div>
              )}

              {/* 네비게이션 */}
              <div className={styles.navigation}>
                <button
                  onClick={handlePrevScript}
                  disabled={scriptIndex === 0}
                  className={`${styles.navButton} ${
                    scriptIndex === 0
                      ? styles.navButtonDisabled
                      : styles.navButtonEnabled
                  }`}
                >
                  {/* 이전 스크립트 완료 상태 표시 */}
                  {scriptIndex > 0 &&
                    isCurrentScriptCompleted(scripts[scriptIndex - 1].id) && (
                      <span className={styles.navCompletedIcon}>✅</span>
                    )}
                  이전
                </button>
                <div className={styles.statsSection}>
                  <div className={styles.statsLabel}>완료한 녹음</div>
                  <div className={styles.statsValue}>
                    {currentAssignment?.completedScriptIds.length || 0} /{" "}
                    {scripts.length}
                  </div>
                </div>

                <button
                  onClick={handleNextScript}
                  disabled={scriptIndex === scripts.length - 1}
                  className={`${styles.navButton} ${
                    scriptIndex === scripts.length - 1
                      ? styles.navButtonDisabled
                      : styles.navButtonEnabled
                  }`}
                >
                  다음
                  {/* 다음 스크립트 완료 상태 표시 */}
                  {scriptIndex < scripts.length - 1 &&
                    isCurrentScriptCompleted(scripts[scriptIndex + 1].id) && (
                      <span className={styles.navCompletedIcon}>✅</span>
                    )}
                </button>
              </div>
            </>
          )}
        </div>

        {/* 전체 진행률 */}
        <div className={styles.progressCard}>
          <div className={styles.progressHeader}>
            <span className={styles.progressLabel}>전체 진행률</span>
            <span className={styles.progressPercentage}>
              {getProgressPercentage()}%
            </span>
          </div>
          <div className={styles.progressBarTrack}>
            <div
              className={styles.progressBarFill}
              style={{
                width: `${getProgressPercentage()}%`,
              }}
            ></div>
          </div>
        </div>
      </div>
    </div>
  );
};
