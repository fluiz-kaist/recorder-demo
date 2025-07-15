// components/script/TutorialComponent.tsx - 튜토리얼 전용 컴포넌트
import React, { useState } from "react";
import { useRouter } from "next/router";
import styles from "@/styles/Tutorial.module.css";
import VoiceRecorder from "@/components/voiceRecorder";
import { ScriptType, TutorialScript } from "@/types/firebase";
import { ScriptRenderer } from "@/components/script/ScriptRenderer";
import { useScrollToTop } from "@/hooks/useScrollToTop";

interface TutorialComponentProps {
  scriptType: ScriptType;
}

const tutorialScripts = [
  {
    id: 0,
    category: "tutorial",
    type: "formal",
    title: "정형 발화 연습하기",
    description: "서울역에서 부산역 가는 기차를 예매해줘",
    explain:
      "위 문장을 평소처럼 자연스럽게 읽어주세요. \n한 말투로 말씀하셔도 괜찮습니다.",
  },
  {
    id: 1,
    category: "tutorial",
    type: "situational",
    title: "상황 녹음 연습하기",
    description: "시청으로 가는 택시를 부르고 싶을 때, 어떻게 말씀하시겠어요?",
    explain:
      "예를 들어, 택시를 부르고 싶다면 '시청 가는 택시 불러줘'처럼 자연스럽게 말씀하시면 됩니다. 편한 말투로 이야기해보세요!",
  },
];

const TutorialComponent: React.FC<TutorialComponentProps> = ({
  scriptType = "tutorial",
}) => {
  const router = useRouter();
  const [scripts] = useState<TutorialScript[]>(tutorialScripts);
  const [scriptIndex, setScriptIndex] = useState(0);
  const [completedScripts, setCompletedScripts] = useState<Set<number>>(
    new Set()
  );

  // 스크롤 훅 사용
  const scrollToTop = useScrollToTop();

  // 햅틱 피드백 (모바일)
  const triggerHapticFeedback = () => {
    if ("vibrate" in navigator) {
      navigator.vibrate(50);
    }
  };

  const handleRecordingComplete = (scriptId: number) => {
    // 완료된 스크립트 추가
    setCompletedScripts((prev) => new Set([...prev, scriptId]));
  };

  const handleNextScript = () => {
    if (scriptIndex < scripts.length - 1) {
      triggerHapticFeedback();
      setScriptIndex((prev) => prev + 1);
      scrollToTop(); // 훅 사용
    }
  };

  const handlePrevScript = () => {
    if (scriptIndex > 0) {
      triggerHapticFeedback();
      setScriptIndex((prev) => prev - 1);
      scrollToTop(); // 훅 사용
    }
  };

  const goBack = () => {
    triggerHapticFeedback();
    router.push("/");
  };

  const getCurrentScript = (): TutorialScript | undefined => {
    return scripts[scriptIndex];
  };

  const getProgressPercentage = (): number => {
    if (scripts.length === 0) return 0;
    return Math.round((completedScripts.size / scripts.length) * 100);
  };

  // 페이지 제목 가져오기
  const getPageTitle = (): string => {
    return "녹음 연습하기";
  };

  // 현재 스크립트가 완료되었는지 확인하는 함수
  const isCurrentScriptCompleted = (scriptId: number): boolean => {
    return completedScripts.has(scriptId);
  };

  const currentScript = getCurrentScript();

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

        {/* 전체 진행률 */}
        <div className={styles.progressCard}>
          <div className={styles.progressHeader}>
            <span className={styles.progressLabel}>연습 진행률</span>
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

        {/* 메인 콘텐츠 */}
        <div className={styles.mainCard}>
          <div className={styles.recordingGuide}>
            <h4>음성 녹음 안내</h4>
            <ul>
              <li>
                <b>조용한 곳에서</b> 녹음해 주세요
              </li>
              <li>스마트폰을 입에서 15-20cm 거리에 두세요</li>
              <li>최소 3초 이상 말씀해 주세요</li>
            </ul>

            <h4>음성 녹음 방법</h4>
            <ul>
              <li>
                녹음을 하기 위해서 먼저 마이크 사용을 허락해주셔야 합니다.
                [허용] 버튼이 나오면 눌러주세요.
              </li>
              <li>
                이 사이트에서 마이크를 사용하도록 허용하시겠습니까? 라는 창이
                보이면, <b>[허용] 또는 [Allow] 버튼을 눌러주세요.</b>
              </li>
            </ul>
          </div>
          {currentScript && (
            <>
              {/* 스크립트 렌더러 - 타입별로 다른 UI 렌더링 */}
              <ScriptRenderer
                script={currentScript}
                scriptType={ScriptType.TUTORIAL}
                isCompleted={currentScriptCompleted}
              />

              {/* 녹음 섹션 */}
              <div className={styles.recordingSection}>
                {currentScriptCompleted ? (
                  // 완료된 스크립트 표시
                  <div className={styles.completedSection}>
                    <div className={styles.completedIcon}>🎉</div>
                    <div className={styles.completedMessage}>
                      연습 녹음을 완료했습니다!
                    </div>
                    <div className={styles.reRecordPrompt}>
                      다시 연습하시겠어요?
                    </div>
                    <VoiceRecorder
                      key={`voice-recorder-${scriptIndex}`}
                      scriptType={ScriptType.TUTORIAL}
                      scriptData={currentScript}
                      isCompltedScript={currentScriptCompleted}
                      isTutorial={true}
                      onRecordingComplete={() =>
                        handleRecordingComplete(currentScript.id)
                      }
                    />
                  </div>
                ) : (
                  // 미완료 스크립트 표시
                  <>
                    <VoiceRecorder
                      key={`voice-recorder-${scriptIndex}`}
                      scriptType={ScriptType.TUTORIAL}
                      scriptData={currentScript}
                      isTutorial={true}
                      onRecordingComplete={() =>
                        handleRecordingComplete(currentScript.id)
                      }
                    />
                  </>
                )}
              </div>

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
                  <div className={styles.statsLabel}>완료한 연습</div>
                  <div className={styles.statsValue}>
                    {completedScripts.size} / {scripts.length}
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
      </div>
    </div>
  );
};
export default TutorialComponent;
