import React, { useState } from "react";
import { useRouter } from "next/router";
import styles from "@/styles/Tutorial.module.css";
import VoiceRecorder from "@/components/voiceRecorder";
import { ScriptType, TutorialScript } from "@/types/firebase";
import { ScriptRenderer } from "@/components/script/ScriptRenderer";
import { useScrollToTop } from "@/hooks/useScrollToTop";
import { useTutorialFlow } from "@/hooks/useTutorialFlow";
import { useUserQuery } from "@/hooks/queries/useUserQueries";

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
  WELCOME = 0,
  ASSISTANT_INTRO = 1,
  VOICE_GUIDE = 2,
  MIC_PERMISSION = 3,
  SITUATIONAL = 4,
  FORMAL = 5,
}

const tutorialScripts = [
  {
    id: 0,
    category: "tutorial",
    type: "situational",
    title: "상황에 따라 말해보기",
    description:
      "다음 주 병원 예약이 있어 까먹지 않도록 달력에 기록하고 싶습니다.<br /><br />비서에게 캘린더 앱을 열고 병원 일정을 등록해달라고 할 때, 뭐라고 말씀하시겠어요?",
    explain:
      "비서가 대신 캘린더 앱을 열고 병원 일정을 등록한다고 생각해보세요. <br />그때 어떤 말로 부탁할까요?",
  },
  {
    id: 1,
    category: "tutorial",
    type: "formal",
    title: "주어진 문장을 읽어보기",
    description:
      "다음 주에 병원에 가야 하는데 자꾸 까먹을까 봐 그래. 캘린더 좀 열어서 날짜랑 시간 등록해줄래?",
    explain:
      "위 문장을 평소처럼 자연스럽게 읽어주세요. \n한 말투로 말씀하셔도 괜찮습니다. ",
  },
];

const TutorialComponent: React.FC<TutorialComponentProps> = ({
  scriptType = "tutorial",
}) => {
  const router = useRouter();
  const scrollToTop = useScrollToTop();
  const { data: user, isLoading, error } = useUserQuery();
  const { completeTutorialAndAssignScripts, isCompleting } = useTutorialFlow();

  // 로컬 상태들
  const [currentStep, setCurrentStep] = useState<TutorialStep>(
    TutorialStep.WELCOME
  );
  const [completedScripts, setCompletedScripts] = useState<Set<number>>(
    new Set()
  );
  const [micPermissionGranted, setMicPermissionGranted] = useState(false);
  const [showTutorialComplete, setShowTutorialComplete] = useState(false);

  const totalSteps = 6;
  const isDev = process.env.NODE_ENV === "development";
  // 햅틱 피드백
  const triggerHapticFeedback = () => {
    if ("vibrate" in navigator) {
      navigator.vibrate(50);
    }
  };

  // 네비게이션 핸들러들
  const handleNext = () => {
    if (currentStep < TutorialStep.FORMAL) {
      triggerHapticFeedback();
      setCurrentStep((prev) => prev + 1);
      scrollToTop();
    }
  };

  const handlePrev = () => {
    if (currentStep > TutorialStep.WELCOME) {
      triggerHapticFeedback();
      setCurrentStep((prev) => prev - 1);
      scrollToTop();
    }
  };

  // 메인 화면으로 이동 (간소화됨)
  const goToMain = async () => {
    try {
      await completeTutorialAndAssignScripts();
      triggerHapticFeedback();
    } catch (error) {
      console.error("튜토리얼 완료 실패:", error);
      // 에러가 발생해도 메인으로 이동 (사용자 경험 고려)
      router.push("/");
    }
  };

  // 녹음 완료 핸들러
  const handleRecordingComplete = (scriptId: number) => {
    setCompletedScripts((prev) => new Set([...prev, scriptId]));
  };

  // 마이크 권한 요청
  const requestMicPermission = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
      setMicPermissionGranted(true);
      triggerHapticFeedback();
    } catch (error) {
      console.error("마이크 권한 요청 실패:", error);
      alert(
        "마이크 사용 권한이 필요합니다. 브라우저 설정에서 마이크를 허용해주세요."
      );
    }
  };

  // 유틸리티 함수들
  const getCurrentScript = (): TutorialScript | undefined => {
    if (currentStep === TutorialStep.SITUATIONAL) return tutorialScripts[0];
    if (currentStep === TutorialStep.FORMAL) return tutorialScripts[1];
    return undefined;
  };

  const isCurrentScriptCompleted = (scriptId: number): boolean => {
    return completedScripts.has(scriptId);
  };

  const getCompletionRate = (): number => {
    return Math.round((completedScripts.size / tutorialScripts.length) * 100);
  };

  const handleAllTutorialComplete = () => {
    setShowTutorialComplete(true);
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

  // 로딩 및 에러 처리
  if (isLoading) {
    return (
      <div className={styles.container}>
        <div className={styles.wrapper}>
          <p className={styles.tutorialDetailedInstruction}>
            사용자 정보를 불러오는 중입니다...
          </p>
        </div>
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className={styles.container}>
        <div className={styles.wrapper}>
          <p className={styles.tutorialDetailedInstruction}>
            사용자 정보를 불러오는 데 문제가 발생했습니다. <br />
            다시 로그인하거나, 처음 화면으로 돌아가 주세요.
          </p>
          <button
            onClick={() => router.push("/")}
            className={styles.returnHomeButton}
          >
            처음 화면으로
          </button>
        </div>
      </div>
    );
  }

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
                isTutorial={true}
                onRecordingComplete={() => handleRecordingComplete(script.id)}
                onAllScriptsComplete={handleAllTutorialComplete}
                totalScriptsCount={tutorialScripts.length}
                completedScriptsCount={completedScripts.size}
              />

              {currentStep === TutorialStep.FORMAL &&
              showTutorialComplete ? null : (
                <p className={styles.tutorialDetailedInstruction}>
                  녹음이 끝나고 <br />
                  제출이 정상적으로 되면,
                  <br />
                  이렇게 완료 화면이 나옵니다. <br />
                  <br />
                  이제 아래의 <br />
                  <strong>[다음]</strong> 버튼을 눌러주세요.
                </p>
              )}
            </div>
          ) : (
            <VoiceRecorder
              key={`voice-recorder-${script.id}`}
              scriptType={ScriptType.TUTORIAL}
              scriptData={script}
              isTutorial={true}
              onRecordingComplete={() => handleRecordingComplete(script.id)}
              onAllScriptsComplete={handleAllTutorialComplete}
              totalScriptsCount={tutorialScripts.length}
              completedScriptsCount={completedScripts.size}
            />
          )}
        </div>
      </div>
    );
  };

  return (
    <div className={styles.container}>
      <div className={styles.wrapper}>
        {/* 진행률 카드 */}
        {(currentStep === TutorialStep.SITUATIONAL ||
          currentStep === TutorialStep.FORMAL) && (
          <div className={styles.progressCard}>
            <div className={styles.progressHeader}>
              <span className={styles.progressLabel}>연습 진행률</span>
              <span className={styles.progressPercentage}>
                {getCompletionRate()}%
              </span>
            </div>
            <div className={styles.progressBarTrack}>
              <div
                className={styles.progressBarFill}
                style={{ width: `${getCompletionRate()}%` }}
              />
            </div>
            <div className={styles.tutorialDetailedInstruction}>
              전체 녹음 진행도를 보여줍니다.
            </div>
          </div>
        )}

        {/* 단계별 카드 렌더링 */}
        <div className={styles.cardContainer}>
          {currentStep === TutorialStep.WELCOME && (
            <div className={styles.card}>
              <TutorialWelcome />
            </div>
          )}

          {currentStep === TutorialStep.ASSISTANT_INTRO && (
            <div className={styles.card}>
              <AssistantIntro />
              <div className={styles.keyMessageSection}>
                <div className={styles.keyMessage}>
                  <p>
                    이제 이 비서를 상상하면서, <u>어떤 말을 하실지</u> 녹음하는
                    연습을 해보겠습니다.
                  </p>
                  <p>
                    <strong>평소처럼 부탁하듯 말씀해 주세요.</strong>
                  </p>
                </div>
              </div>
              <p className={styles.next}>
                계속해서 [다음] 버튼을 눌러서 진행해주세요!
              </p>
            </div>
          )}

          {currentStep === TutorialStep.VOICE_GUIDE && (
            <div className={styles.card}>
              <VoiceGuide />
            </div>
          )}

          {currentStep === TutorialStep.MIC_PERMISSION && (
            <div className={styles.card}>
              <div className={styles.headerSection}>
                <div className={styles.micIcon}>🎤</div>
                <h1 className={styles.pageTitle}>실전 연습을 시작하겠습니다</h1>
              </div>
              <div className={styles.explanationSection}>
                <p className={styles.explanationText}>
                  이제 실제로 음성을 녹음해보겠습니다.
                  <br />
                  <br />
                  먼저 마이크 사용 권한을 허용해주세요.
                </p>
              </div>
              <div className={styles.stepsSection}>
                <div className={styles.permissionStep}>
                  <span className={styles.stepIcon}>1️⃣</span>
                  <span className={styles.stepText}>
                    아래 버튼을 눌러주세요
                  </span>
                </div>
                <div className={styles.permissionStep}>
                  <span className={styles.stepIcon}>2️⃣</span>
                  <span className={styles.stepText}>
                    허용 또는 Allow 버튼을 눌러주세요
                  </span>
                </div>
                <div className={styles.permissionStep}>
                  <span className={styles.stepIcon}>3️⃣</span>
                  <span className={styles.stepText}>
                    준비가 완료되면 다음으로 진행하세요
                  </span>
                </div>
              </div>
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

        {/* 튜토리얼 완료 버튼 */}
        {currentStep === TutorialStep.FORMAL && showTutorialComplete && (
          <div>
            <div className={styles.tutorialDetailedInstruction}>
              🎉 축하합니다! 모든 연습이 끝났습니다! <br />
              이제 본격적인 녹음을 시작해 주세요!
            </div>
            <button
              onClick={goToMain}
              className={styles.returnHomeButton}
              disabled={isCompleting}
            >
              <span>{isCompleting ? "준비 중..." : "이곳을 눌러주세요!"}</span>
            </button>
          </div>
        )}

        {/* 네비게이션 */}
        <div className={styles.navigation}>
          <button
            onClick={handlePrev}
            disabled={currentStep === TutorialStep.WELCOME}
            className={`${styles.navButton} ${
              currentStep === TutorialStep.WELCOME
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
            }
            className={`${styles.navButton} ${
              currentStep === TutorialStep.FORMAL ||
              (currentStep === TutorialStep.MIC_PERMISSION &&
                !micPermissionGranted)
                ? styles.navButtonDisabled
                : styles.navButtonEnabled
            }`}
          >
            {currentStep === TutorialStep.FORMAL
              ? "연습완료!"
              : currentStep === TutorialStep.MIC_PERMISSION &&
                !micPermissionGranted
              ? "권한 필요"
              : "다음"}
          </button>
        </div>
      </div>
      {isDev && (
        <>
          <div>
            <div className={styles.tutorialDetailedInstruction}>
              튜토리얼완료버튼
            </div>
            <button
              onClick={goToMain}
              className={styles.returnHomeButton}
              disabled={isCompleting}
            >
              <span>{isCompleting ? "준비 중..." : "이곳을 눌러주세요!"}</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default TutorialComponent;
