// components/script/TutorialComponent.tsx - 메인 튜토리얼 컴포넌트
import React, { useState } from "react";
import { useRouter } from "next/router";
import styles from "@/styles/Tutorial.module.css";
import VoiceRecorder from "@/components/voiceRecorder";
import { ScriptType, TutorialScript } from "@/types/firebase";
import { ScriptRenderer } from "@/components/script/ScriptRenderer";
import { useScrollToTop } from "@/hooks/useScrollToTop";
import { useQueryClient } from "@tanstack/react-query";
// 독립 컴포넌트들 임포트
import TutorialWelcome from "@/components/guide/TutorialWelcome";
import AssistantIntro from "@/components/guide/AssistantIntro";
import VoiceGuide from "@/components/guide/VoiceGuide";
import MicPermission from "@/components/guide/MicPermission";
import { useUserQuery } from "@/hooks/queries/useUserQueries";
import { useUpdateUserMutation } from "@/hooks/mutations/useUserMutations";
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
  const [currentStep, setCurrentStep] = useState<TutorialStep>(
    TutorialStep.WELCOME
  );
  const [completedScripts, setCompletedScripts] = useState<Set<number>>(
    new Set()
  );
  const [micPermissionGranted, setMicPermissionGranted] = useState(false);

  const [showTutorialComplete, setShowTutorialComplete] = useState(false);
  const { mutateAsync: updateUser } = useUpdateUserMutation();
  const totalSteps = 6;
  const scrollToTop = useScrollToTop();
  const { data: user, isLoading, error } = useUserQuery();
  const queryClient = useQueryClient();
  // 튜토리얼 완료 시 호출
  const handleTutorialComplete = (userId: string) => {
    if (user) {
      updateUser({
        userId,
        updates: {
          currentStatus: {
            ...user.currentStatus, // 기존 값 유지
            isTutorialCompleted: true,
            canStartRecording: true,
          },
        },
      });
    }
  };

  console.log("currentStep?", currentStep);
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
    // WELCOME 단계가 아닐 때만 이전 단계로 이동
    if (currentStep > TutorialStep.WELCOME) {
      // 수정된 부분
      triggerHapticFeedback();
      setCurrentStep((prev) => prev - 1);
      scrollToTop();
    }
  };

  const goToMain = async () => {
    console.group("유저가 튜토리얼을 완료함");
    if (!user?.id) {
      console.warn(
        "유저 정보가 없어서 tutorial 완료 상태를 저장할 수 없습니다."
      );
    } else {
      try {
        const updatedUser = await updateUser({
          // await 추가
          userId: user.id,
          updates: {
            currentStatus: {
              ...user.currentStatus,
              isTutorialCompleted: true,
              canStartRecording: true,
            },
          },
        });
        console.log("튜토리얼 완료!");
        // mutation이 반환한 최신 데이터 사용
        console.log(
          "mutation 반환값:",
          updatedUser.currentStatus.isTutorialCompleted
        );

        // 잠시 기다린 후 캐시에서 다시 확인
        setTimeout(() => {
          const cachedUser = queryClient.getQueryData(["user", user.id]);

          console.log("캐시에서 가져온 user:", cachedUser);
        }, 100);
      } catch (error) {
        console.error("업데이트 실패:", error);
      }
    }
    triggerHapticFeedback();
    console.log("메인 화면으로 이동 합니다. ");
    console.groupEnd();
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

  //튜토 완료 핸들러
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

  // 실제 녹음 연습 페이지 렌더링
  const renderPracticeCard = (script: TutorialScript) => {
    console.log("여기서 스클비트?", script);
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
                onAllScriptsComplete={handleAllTutorialComplete} // 새로 추가
                totalScriptsCount={tutorialScripts.length} // 새로 추가
                completedScriptsCount={completedScripts.size} // 새로 추가
              />

              {currentStep === TutorialStep.FORMAL && showTutorialComplete ? (
                <></>
              ) : (
                <>
                  {" "}
                  <p className={styles.tutorialDetailedInstruction}>
                    녹음이 끝나고 <br />
                    제출이 정상적으로 되면,
                    <br />
                    이렇게 완료 화면이 나옵니다. <br /> <br /> 이제 아래의{" "}
                    <br />
                    <strong>‘다음’</strong> 버튼을 눌러주세요.
                  </p>
                </>
              )}
            </div>
          ) : (
            <VoiceRecorder
              key={`voice-recorder-${script.id}`}
              scriptType={ScriptType.TUTORIAL}
              scriptData={script}
              isTutorial={true}
              onRecordingComplete={() => handleRecordingComplete(script.id)}
              onAllScriptsComplete={handleAllTutorialComplete} // 새로 추가
              totalScriptsCount={tutorialScripts.length} // 새로 추가
              completedScriptsCount={completedScripts.size} // 새로 추가
            />
          )}
        </div>
      </div>
    );
  };

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
          <button onClick={goToMain} className={styles.returnHomeButton}>
            처음 화면으로
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.wrapper}>
        {/* 헤더 */}
        {/* <div className={styles.header}>
          <button onClick={goToMain} className={styles.backButton}>
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
        {(currentStep === TutorialStep.SITUATIONAL ||
          currentStep === TutorialStep.FORMAL) && (
          <div>
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
                  style={{
                    width: `${getCompletionRate()}%`,
                  }}
                ></div>
              </div>
              <div className={styles.tutorialDetailedInstruction}>
                전체 녹음 진행도를 보여줍니다.
              </div>
            </div>
          </div>
        )}

        {/* 단계별 카드 렌더링 */}
        <div className={styles.cardContainer}>
          {currentStep === TutorialStep.WELCOME && (
            <div className={styles.card}>
              <TutorialWelcome /> {/* 새 컴포넌트 렌더링 */}
            </div>
          )}

          {currentStep === TutorialStep.ASSISTANT_INTRO && (
            <div className={styles.card}>
              <AssistantIntro />
              {/* 핵심 메시지 */}
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
              {/* 헤더 */}
              <div className={styles.headerSection}>
                <div className={styles.micIcon}>🎤</div>
                <h1 className={styles.pageTitle}>실전 연습을 시작하겠습니다</h1>
              </div>

              {/* 설명 */}
              <div className={styles.explanationSection}>
                <p className={styles.explanationText}>
                  이제 실제로 음성을 녹음해보겠습니다.
                  <br />
                  <br />
                  먼저 마이크 사용 권한을 허용해주세요.
                </p>
              </div>
              {/* 단계 안내 */}
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

        {currentStep === TutorialStep.FORMAL && showTutorialComplete && (
          <div>
            <div className={styles.tutorialDetailedInstruction}>
              🎉 축하합니다! 모든 연습이 끝났습니다! <br />
              이제 본격적인 녹음을 시작해 주세요!
            </div>
            <button onClick={goToMain} className={styles.returnHomeButton}>
              <span>이곳을 눌러주세요!</span>
            </button>
          </div>
        )}

        {/* 네비게이션 */}
        <div className={styles.navigation}>
          <button
            onClick={handlePrev}
            // WELCOME 단계일 때만 비활성화
            disabled={currentStep === TutorialStep.WELCOME} // 수정된 부분
            className={`${styles.navButton} ${
              currentStep === TutorialStep.WELCOME // 수정된 부분: WELCOME 단계일 때만 비활성화 스타일 적용
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
              ? "연습완료!" // 마지막 버튼 문구 변경
              : currentStep === TutorialStep.MIC_PERMISSION &&
                !micPermissionGranted
              ? "권한 필요" // 마이크 권한 없으면 '권한 필요' 표시
              : "다음"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default TutorialComponent;
