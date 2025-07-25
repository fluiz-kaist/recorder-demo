// components/script/TutorialComponent.tsx - 메인 튜토리얼 컴포넌트
import React, { useState } from "react";
import { useRouter } from "next/router";
import styles from "@/styles/Tutorial.module.css";
import VoiceRecorder from "@/components/voiceRecorder";
import { ScriptType, TutorialScript } from "@/types/firebase";
import { ScriptRenderer } from "@/components/script/ScriptRenderer";
import { useScrollToTop } from "@/hooks/useScrollToTop";

// 독립 컴포넌트들 임포트
import TutorialWelcome from "@/components/guide/TutorialWelcome";
import AssistantIntro from "@/components/guide/AssistantIntro";
import VoiceGuide from "@/components/guide/VoiceGuide";
import MicPermission from "@/components/guide/MicPermission";

interface TutorialComponentProps {
  scriptType: ScriptType;
}

// 튜토리얼 단계 정의
enum TutorialStep {
  WELCOME = 0, // 1페이지: 튜토리얼 시작 안내
  ASSISTANT_INTRO = 1, // 2페이지: 비서 개념
  VOICE_GUIDE = 2, // 3페이지: 기술적 녹음 방법
  MIC_PERMISSION = 3, // 4페이지: 마이크 권한 및 연습 준비
  SITUATIONAL = 4, // 5페이지: 상황 연습
  FORMAL = 5, // 6페이지: 정형 연습
}

const tutorialScripts = [
  {
    id: 0,
    category: "tutorial",
    type: "situational",
    title: "상황 녹음 연습하기",
    description: "시청으로 가는 택시를 부르고 싶을 때, 어떻게 말씀하시겠어요?",
    explain:
      "예를 들어, 택시를 부르고 싶다면 '시청 가는 택시 불러줘'처럼 자연스럽게 말씀하시면 됩니다. 편한 말투로 이야기해보세요!",
  },
  {
    id: 1,
    category: "tutorial",
    type: "formal",
    title: "정형 발화 연습하기",
    description: "서울역에서 부산역 가는 기차를 예매해줘",
    explain:
      "위 문장을 평소처럼 자연스럽게 읽어주세요. \n한 말투로 말씀하셔도 괜찮습니다.",
  },
];

const TutorialComponent: React.FC<TutorialComponentProps> = ({
  scriptType = "tutorial",
}) => {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<TutorialStep>(
    TutorialStep.WELCOME
  );
  const [completedScripts, setCompletedScripts] = useState<Set<number>>(
    new Set()
  );
  const [micPermissionGranted, setMicPermissionGranted] = useState(false);
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [guideModalType, setGuideModalType] = useState<
    "assistant" | "voice" | "method"
  >("assistant");

  const totalSteps = 6;
  const scrollToTop = useScrollToTop();

  // 햅틱 피드백
  const triggerHapticFeedback = () => {
    if ("vibrate" in navigator) {
      navigator.vibrate(50);
    }
  };

  const handleNext = () => {
    if (currentStep < TutorialStep.FORMAL) {
      triggerHapticFeedback();
      setCurrentStep((prev) => prev + 1);
      scrollToTop();
    }
  };

  const handlePrev = () => {
    if (currentStep > TutorialStep.ASSISTANT_INTRO) {
      triggerHapticFeedback();
      setCurrentStep((prev) => prev - 1);
      scrollToTop();
    }
  };

  const goBack = () => {
    triggerHapticFeedback();
    router.push("/");
  };

  const handleRecordingComplete = (scriptId: number) => {
    setCompletedScripts((prev) => new Set([...prev, scriptId]));
  };

  const requestMicPermission = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop()); // 테스트용이므로 바로 정지
      setMicPermissionGranted(true);
      triggerHapticFeedback();
    } catch (error) {
      console.error("마이크 권한 요청 실패:", error);
      alert(
        "마이크 사용 권한이 필요합니다. 브라우저 설정에서 마이크를 허용해주세요."
      );
    }
  };

  const getCurrentScript = (): TutorialScript | undefined => {
    if (currentStep === TutorialStep.SITUATIONAL) {
      return tutorialScripts[0]; // 상황 스크립트
    } else if (currentStep === TutorialStep.FORMAL) {
      return tutorialScripts[1]; // 정형 스크립트
    }
    return undefined;
  };

  const isCurrentScriptCompleted = (scriptId: number): boolean => {
    return completedScripts.has(scriptId);
  };

  const getCompletionRate = (): number => {
    return Math.round((completedScripts.size / tutorialScripts.length) * 100);
  };

  const getPageTitle = (): string => {
    switch (currentStep) {
      case TutorialStep.WELCOME:
        return "연습 시작";
      case TutorialStep.ASSISTANT_INTRO:
        return "비서를 소개합니다";
      case TutorialStep.VOICE_GUIDE:
        return "음성 녹음 안내";
      case TutorialStep.MIC_PERMISSION:
        return "마이크 권한 요청";
      case TutorialStep.SITUATIONAL:
        return "상황 연습하기";
      case TutorialStep.FORMAL:
        return "정형 연습하기";
      default:
        return "녹음 연습하기";
    }
  };

  const openGuideModal = (type: "assistant" | "voice" | "method") => {
    setGuideModalType(type);
    setShowGuideModal(true);
  };

  // 가이드 모달 렌더링
  const renderGuideModal = () => {
    if (!showGuideModal) return null;

    let modalContent;
    switch (guideModalType) {
      case "assistant":
        modalContent = <AssistantIntro />;
        break;
      case "voice":
        modalContent = <VoiceGuide />;
        break;
      case "method":
        modalContent = (
          <MicPermission
            isGranted={micPermissionGranted}
            onRequestPermission={requestMicPermission}
          />
        );
        break;
    }

    return (
      <div
        className={styles.modalOverlay}
        onClick={() => setShowGuideModal(false)}
      >
        <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
          <div className={styles.modalHeader}>
            <h2>
              {guideModalType === "assistant"
                ? "비서 소개"
                : guideModalType === "voice"
                ? "음성 안내"
                : "마이크 사용법"}
            </h2>
            <button
              className={styles.modalCloseButton}
              onClick={() => setShowGuideModal(false)}
            >
              ✕
            </button>
          </div>
          <div className={styles.modalContent}>{modalContent}</div>
        </div>
      </div>
    );
  };

  // 실제 녹음 연습 페이지 렌더링
  const renderPracticeCard = (script: TutorialScript) => {
    const isCompleted = isCurrentScriptCompleted(script.id);

    return (
      <div className={styles.card}>
        <div className={styles.stepIndicator}>
          <span className={styles.stepNumber}>{currentStep + 1}</span>
          <span className={styles.stepTotal}>/ {totalSteps}</span>
        </div>

        <ScriptRenderer
          script={script}
          scriptType={ScriptType.TUTORIAL}
          isCompleted={isCompleted}
        />

        <div className={styles.recordingSection}>
          {isCompleted ? (
            <div className={styles.completedSection}>
              <div className={styles.completedIcon}>🎉</div>
              <div className={styles.completedMessage}>
                연습 녹음을 완료했습니다!
              </div>
              <div className={styles.reRecordPrompt}>다시 연습하시겠어요?</div>
              <VoiceRecorder
                key={`voice-recorder-${script.id}`}
                scriptType={ScriptType.TUTORIAL}
                scriptData={script}
                isCompltedScript={isCompleted}
                isTutorial={true}
                onRecordingComplete={() => handleRecordingComplete(script.id)}
              />
            </div>
          ) : (
            <VoiceRecorder
              key={`voice-recorder-${script.id}`}
              scriptType={ScriptType.TUTORIAL}
              scriptData={script}
              isTutorial={true}
              onRecordingComplete={() => handleRecordingComplete(script.id)}
            />
          )}
        </div>
      </div>
    );
  };

  return (
    <div className={styles.container}>
      <div className={styles.wrapper}>
        {/* 헤더 */}
        {/* <div className={styles.header}>
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
            처음화면으로
          </button>

          <div className={styles.headerTitle}>{getPageTitle()}</div>
        </div> */}

        {/* 진행률 카드 */}
        <div className={styles.progressCard}>
          <div className={styles.progressHeader}>
            <span className={styles.progressLabel}>
              {/* {currentStep >= TutorialStep.SITUATIONAL
                ? "연습 진행률"
                : "튜토리얼 단계"} */}
              연습 진행률
            </span>
            <span className={styles.progressPercentage}>
              {currentStep >= TutorialStep.SITUATIONAL
                ? `${getCompletionRate()}%`
                : `${currentStep + 1} / ${totalSteps}`}
            </span>
          </div>
          <div className={styles.progressBarTrack}>
            <div
              className={styles.progressBarFill}
              style={{
                width:
                  currentStep >= TutorialStep.SITUATIONAL
                    ? `${getCompletionRate()}%`
                    : `${((currentStep + 1) / totalSteps) * 100}%`,
              }}
            ></div>
          </div>
        </div>

        {/* 단계별 카드 렌더링 */}
        <div className={styles.cardContainer}>
          {currentStep === TutorialStep.WELCOME && (
            <div className={styles.card}>
              <TutorialWelcome /> {/* 새 컴포넌트 렌더링 */}
            </div>
          )}

          {currentStep === TutorialStep.ASSISTANT_INTRO && (
            <div className={styles.card}>
              {/* <div className={styles.stepIndicator}>
                <span className={styles.stepNumber}>1</span>
                <span className={styles.stepTotal}>/ {totalSteps}</span>
              </div> */}
              <AssistantIntro />
            </div>
          )}

          {currentStep === TutorialStep.VOICE_GUIDE && (
            <div className={styles.card}>
              {/* <div className={styles.stepIndicator}>
                <span className={styles.stepNumber}>2</span>
                <span className={styles.stepTotal}>/ {totalSteps}</span>
              </div> */}
              <VoiceGuide />
            </div>
          )}

          {currentStep === TutorialStep.MIC_PERMISSION && (
            <div className={styles.card}>
              {/* <div className={styles.stepIndicator}>
                <span className={styles.stepNumber}>3</span>
                <span className={styles.stepTotal}>/ {totalSteps}</span>
              </div> */}
              <MicPermission
                isGranted={micPermissionGranted}
                onRequestPermission={requestMicPermission}
              />
            </div>
          )}

          {currentStep === TutorialStep.SITUATIONAL &&
            renderPracticeCard(tutorialScripts[0])}

          {currentStep === TutorialStep.FORMAL &&
            renderPracticeCard(tutorialScripts[1])}
        </div>

        {/* 네비게이션 */}
        <div className={styles.navigation}>
          <button
            onClick={handlePrev}
            disabled={currentStep === TutorialStep.WELCOME}
            className={`${styles.navButton} ${
              currentStep === TutorialStep.ASSISTANT_INTRO
                ? styles.navButtonDisabled
                : styles.navButtonEnabled
            }`}
          >
            이전
          </button>

          <div className={styles.dots}>
            {Array.from({ length: totalSteps }, (_, i) => (
              <div
                key={i}
                className={`${styles.dot} ${
                  i === currentStep ? styles.activeDot : ""
                }`}
              />
            ))}
          </div>

          <button
            onClick={handleNext}
            disabled={
              currentStep === TutorialStep.FORMAL ||
              (currentStep === TutorialStep.MIC_PERMISSION &&
                !micPermissionGranted)
            } // 조건 추가 (권한 없으면 '다음' 비활성화)
            className={`${styles.navButton} ${
              currentStep === TutorialStep.FORMAL ||
              (currentStep === TutorialStep.MIC_PERMISSION &&
                !micPermissionGranted)
                ? styles.navButtonDisabled
                : styles.navButtonEnabled
            }`}
          >
            {currentStep === TutorialStep.FORMAL
              ? "연습하기 완료" // 마지막 버튼 문구 변경
              : currentStep === TutorialStep.MIC_PERMISSION &&
                !micPermissionGranted
              ? "권한 필요" // 마이크 권한 없으면 '권한 필요' 표시
              : "다음"}
          </button>
        </div>
      </div>

      {/* Footer - 안내 정보 바로가기 */}
      <div className={styles.footer}>
        <div className={styles.footerTitle}>도움말</div>
        <div className={styles.footerButtons}>
          <button
            className={styles.footerButton}
            onClick={() => openGuideModal("assistant")}
          >
            🤖 비서 소개
          </button>
          <button
            className={styles.footerButton}
            onClick={() => openGuideModal("voice")}
          >
            📢 녹음 안내
          </button>
          <button
            className={styles.footerButton}
            onClick={() => openGuideModal("method")}
          >
            🎤 마이크 사용법
          </button>
        </div>
      </div>

      {/* 가이드 모달 */}
      {renderGuideModal()}
    </div>
  );
};

export default TutorialComponent;
