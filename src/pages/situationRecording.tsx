import React, { useState, useEffect } from "react";
import { useRouter } from "next/router";
import styles from "@/styles/SituationRecording.module.css";
import VoiceRecorder from "@/components/voiceRecorder";
import { SituationalScript, ScriptType } from "@/types/firebase";
import {
  useLocalScriptsByTypeQuery,
  useScriptProgressByType,
} from "@/hooks/queries/useScriptQueries";
import {
  useAuthStatusQuery,
  useUserScriptAssignmentsQuery,
} from "@/hooks/queries/useUserQueries";
import { useAssignScriptsMutation } from "@/hooks/mutations/useScriptMutations";

const SituationRecordingPage = () => {
  const router = useRouter();
  const [situations, setSituations] = useState<SituationalScript[]>([]);
  const [situationIndex, setSituationIndex] = useState(0);
  const [showRecorder, setShowRecorder] = useState(false);

  // React Query로 상황 스크립트 데이터 가져오기
  const {
    data: situationalScripts,
    isLoading,
    error: queryError,
    refetch,
  } = useLocalScriptsByTypeQuery(ScriptType.SITUATIONAL);

  // 인증 정보 가져오기
  const { data: authToken } = useAuthStatusQuery();

  // 진행률 정보 가져오기
  const scriptProgress = useScriptProgressByType(
    ScriptType.SITUATIONAL,
    authToken?.userId
  );

  // 사용자 스크립트 할당 정보 가져오기
  const { data: userAssignments } = useUserScriptAssignmentsQuery(
    authToken?.userId
  );

  // 스크립트 데이터 설정
  useEffect(() => {
    if (situationalScripts && Array.isArray(situationalScripts)) {
      setSituations(situationalScripts as SituationalScript[]);
    }
  }, [situationalScripts]);

  const assignScriptsMutation = useAssignScriptsMutation();

  // 스크립트 할당 처리
  const handleAssignScripts = async () => {
    if (!authToken?.userId) return;

    try {
      await assignScriptsMutation.mutateAsync({ userId: authToken.userId });

      // localStorage 확인
      console.log(
        "localStorage 확인:",
        localStorage.getItem("scriptContents_situational")
      );

      // 약간의 지연 후 refetch
      setTimeout(() => {
        refetch();
      }, 1000);
    } catch (error) {
      console.error("스크립트 할당 실패:", error);
    }
  };

  // 상황이 없을 때 표시할 UI 수정
  if (situations.length === 0) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.loadingText}>아직 녹음할 상황이 없습니다.</div>
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

  // 에러 처리
  const error = queryError?.message || null;

  // 햅틱 피드백 (모바일)
  const triggerHapticFeedback = () => {
    if ("vibrate" in navigator) {
      navigator.vibrate(50);
    }
  };

  const handleRecordingComplete = () => {
    setShowRecorder(false);
    // 녹음 완료 후 필요한 추가 처리가 있다면 여기에
  };

  const handleNextSituation = () => {
    if (situationIndex < situations.length - 1) {
      triggerHapticFeedback();
      setSituationIndex((prev) => prev + 1);
      setShowRecorder(false);
    }
  };

  const handlePrevSituation = () => {
    if (situationIndex > 0) {
      triggerHapticFeedback();
      setSituationIndex((prev) => prev - 1);
      setShowRecorder(false);
    }
  };

  const goBack = () => {
    triggerHapticFeedback();
    router.push("/");
  };

  const getCurrentSituation = (): SituationalScript | undefined => {
    return situations[situationIndex];
  };

  const getProgressPercentage = (): number => {
    if (scriptProgress) {
      return scriptProgress.progress;
    }
    // 백업: 현재 인덱스 기반 계산
    if (situations.length === 0) return 0;
    return Math.round(((situationIndex + 1) / situations.length) * 100);
  };

  // 로딩 중일 때
  if (isLoading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.loadingSpinner}></div>
        <div className={styles.loadingText}>상황을 불러오고 있어요...</div>
      </div>
    );
  }

  // 에러가 발생했을 때
  if (error) {
    return (
      <div className={styles.errorContainer}>
        <div className={styles.errorCard}>
          <div className={styles.errorIcon}>😕</div>
          <h2 className={styles.errorTitle}>문제가 생겼어요</h2>
          <p className={styles.errorMessage}>{error}</p>
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

  // 상황이 없을 때
  if (situations.length === 0) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.loadingText}>아직 녹음할 상황이 없습니다.</div>
      </div>
    );
  }

  const currentSituation = getCurrentSituation();

  // 현재 스크립트 타입의 할당 정보만 필터링
  const situationalAssignment = userAssignments?.find(
    (assignment) => assignment.scriptType === ScriptType.SITUATIONAL
  );

  // 현재 스크립트가 완료되었는지 확인하는 함수
  const isCurrentScriptCompleted = (scriptId: number): boolean => {
    if (!situationalAssignment) return false;
    return situationalAssignment.completedScriptIds.includes(scriptId);
  };

  // 현재 스크립트의 완료 상태
  const currentScriptCompleted = currentSituation
    ? isCurrentScriptCompleted(currentSituation.id)
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

          <div className={styles.progressIndicator}>
            {situationIndex + 1} / {situations.length}
          </div>
        </div>

        {/* 메인 콘텐츠 */}
        <div className={styles.mainCard}>
          {currentSituation && (
            <>
              {/* 카테고리 배지 */}
              <div className={styles.categoryBadge}>
                📱 {currentSituation.category}/{currentSituation.intent}
              </div>

              {/* 제목 섹션 */}
              <div className={styles.titleSection}>
                <h1 className={styles.title}>{currentSituation.title}</h1>
                {currentScriptCompleted && (
                  <div className={styles.completedBadge}>✅ 제출완료</div>
                )}
                <p className={styles.description}>
                  {currentSituation.description}
                </p>
              </div>

              {/* 녹음 섹션 */}
              {!showRecorder ? (
                <div className={styles.recordingSection}>
                  {currentScriptCompleted ? (
                    // 완료된 스크립트 표시
                    <div className={styles.completedSection}>
                      <div className={styles.completedIcon}>🎉</div>
                      <div className={styles.completedMessage}>
                        이 상황은 이미 녹음을 완료했습니다!
                      </div>
                      <div className={styles.reRecordPrompt}>
                        다시 녹음하시겠어요?
                      </div>
                      <VoiceRecorder
                        key={`voice-recorder-${situationIndex}`}
                        scriptType={ScriptType.SITUATIONAL}
                        scriptData={currentSituation}
                        onRecordingComplete={handleRecordingComplete}
                      />
                    </div>
                  ) : (
                    // 미완료 스크립트 표시
                    <>
                      <div className={styles.recordingPrompt}>
                        🎤 이 상황에서 어떻게 말하시겠어요?
                      </div>
                      <div className={styles.recordingInstruction}>
                        마음편히 자연스럽게 말씀해보세요!
                      </div>
                      <VoiceRecorder
                        key={`voice-recorder-${situationIndex}`}
                        scriptType={ScriptType.SITUATIONAL}
                        scriptData={currentSituation}
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
                  onClick={handlePrevSituation}
                  disabled={situationIndex === 0}
                  className={`${styles.navButton} ${
                    situationIndex === 0
                      ? styles.navButtonDisabled
                      : styles.navButtonEnabled
                  }`}
                >
                  {/* 이전 스크립트 완료 상태 표시 */}
                  {situationIndex > 0 &&
                    isCurrentScriptCompleted(
                      situations[situationIndex - 1].id
                    ) && <span className={styles.navCompletedIcon}>✅</span>}
                  이전상황
                </button>
                <div className={styles.statsSection}>
                  <div className={styles.statsLabel}>완료한 녹음</div>
                  <div className={styles.statsValue}>
                    {situationalAssignment?.completedScriptIds.length || 0} /{" "}
                    {situations.length}
                  </div>
                </div>

                <button
                  onClick={handleNextSituation}
                  disabled={situationIndex === situations.length - 1}
                  className={`${styles.navButton} ${
                    situationIndex === situations.length - 1
                      ? styles.navButtonDisabled
                      : styles.navButtonEnabled
                  }`}
                >
                  다음상황
                  {/* 다음 스크립트 완료 상태 표시 */}
                  {situationIndex < situations.length - 1 &&
                    isCurrentScriptCompleted(
                      situations[situationIndex + 1].id
                    ) && <span className={styles.navCompletedIcon}>✅</span>}
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

export default SituationRecordingPage;
