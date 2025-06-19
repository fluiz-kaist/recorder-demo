import React, { useState, useEffect } from "react";
import { useRouter } from "next/router";
import styles from "@/styles/SituationRecording.module.css";
import VoiceRecorder from "@/components/voiceRecorder";
// 타입 정의
interface SituationScript {
  category: string;
  intent: string;
  title: string;
  description: string;
}

const SituationRecordingPage = () => {
  const router = useRouter();
  const [situations, setSituations] = useState<SituationScript[]>([]);
  const [situationIndex, setSituationIndex] = useState(0);
  const [recordedCount, setRecordedCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showRecorder, setShowRecorder] = useState(false);

  // JSON 파일에서 상황 스크립트 불러오기

  // localStorage에서 상황 스크립트 불러오기
  useEffect(() => {
    const fetchSituations = () => {
      try {
        setIsLoading(true);

        // localStorage에서 데이터 가져오기
        const storedData = localStorage.getItem("assignedScripts");

        if (!storedData) {
          throw new Error("저장된 스크립트 데이터가 없습니다.");
        }

        const parsedData = JSON.parse(storedData);

        // situational 배열만 추출
        if (parsedData.situational && Array.isArray(parsedData.situational)) {
          setSituations(parsedData.situational);
          setError(null);
        } else {
          throw new Error("situational 데이터를 찾을 수 없습니다.");
        }
      } catch (err) {
        console.error("Error fetching situations:", err);
        setError(
          err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다."
        );
      } finally {
        setIsLoading(false);
      }
    };

    fetchSituations();
  }, []);

  // 햅틱 피드백 (모바일)
  const triggerHapticFeedback = () => {
    if ("vibrate" in navigator) {
      navigator.vibrate(50);
    }
  };

  const handleStartRecording = () => {
    triggerHapticFeedback();
    setShowRecorder(true);
  };

  const handleRecordingComplete = () => {
    setRecordedCount((prev) => prev + 1);
    setShowRecorder(false);
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

  const getCurrentSituation = (): SituationScript | undefined => {
    return situations[situationIndex];
  };

  const getProgressPercentage = (): number => {
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
                <p className={styles.description}>
                  {currentSituation.description}
                </p>
              </div>

              {/* 녹음 섹션 */}
              {!showRecorder ? (
                <div className={styles.recordingSection}>
                  <div className={styles.recordingPrompt}>
                    🎤 이 상황에서 어떻게 말하시겠어요?
                  </div>
                  <div className={styles.recordingInstruction}>
                    마음편히 자연스럽게 말씀해보세요!
                  </div>

                  {/* 녹음 시작 버튼 */}
                  <VoiceRecorder
                    key={`voice-recorder-${situationIndex}`}
                    currentSituation={currentSituation}
                    situationIndex={situationIndex}
                  />
                </div>
              ) : (
                /* VoiceRecorder 컴포넌트 */
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
                  aria-label="이전 상황으로 가기"
                >
                  <svg
                    className={`${styles.navIcon} ${styles.navIconLeft}`}
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
                  이전 상황
                </button>

                <div className={styles.statsSection}>
                  <div className={styles.statsLabel}>완료한 녹음</div>
                  <div className={styles.statsValue}>{recordedCount}</div>
                </div>

                <button
                  onClick={handleNextSituation}
                  disabled={situationIndex === situations.length - 1}
                  className={`${styles.navButton} ${
                    situationIndex === situations.length - 1
                      ? styles.navButtonDisabled
                      : styles.navButtonEnabled
                  }`}
                  aria-label="다음 상황으로 가기"
                >
                  다음 상황
                  <svg
                    className={`${styles.navIcon} ${styles.navIconRight}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={3}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
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
