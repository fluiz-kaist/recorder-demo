// components/script/ScriptRenderer.tsx - 타입별 스크립트 렌더링 컴포넌트
import React from "react";
import {
  ScriptType,
  SituationalScript,
  FormalScript,
  TutorialScript,
} from "@/types/firebase";
import styles from "@/styles/ScriptRecording.module.css";

type AnyScript = SituationalScript | FormalScript | TutorialScript;

interface ScriptRendererProps {
  script: AnyScript;
  scriptType: ScriptType;
  isCompleted: boolean;
}

export const ScriptRenderer: React.FC<ScriptRendererProps> = ({
  script,
  scriptType,
  isCompleted,
}) => {
  // 타입별 아이콘 가져오기
  const getTypeIcon = (type: ScriptType): string => {
    switch (type) {
      case ScriptType.SITUATIONAL:
        return "상황";
      case ScriptType.FORMAL:
        return "포멀";
      case ScriptType.QA_SCENARIO:
        return "시나리오";
      default:
        return "기타";
    }
  };

  // Situational Script 렌더링
  const renderSituationalScript = (script: SituationalScript) => (
    <>
      {/* <div className={styles.categoryBadge}>
        {getTypeIcon(ScriptType.SITUATIONAL)} {script.category}/{script.intent}
      </div> */}
      <div className={styles.titleSection}>
        {/* <h1 className={styles.title}>{script.title}</h1> */}
        {isCompleted && (
          <div className={styles.completedBadge}>✅ 제출완료</div>
        )}
        <p className={styles.description}>{script.description}</p>
      </div>
    </>
  );

  // Formal Script 렌더링
  const renderFormalScript = (script: FormalScript) => (
    <>
      {/* <div className={styles.categoryBadge}>
        {getTypeIcon(ScriptType.FORMAL)} {script.category}/{script.intent}
      </div> */}
      <div className={styles.titleSection}>
        {/* <h1 className={styles.title}>{script.title}</h1> */}
        {isCompleted && (
          <div className={styles.completedBadge}>✅ 제출완료</div>
        )}
      </div>
      <div className={styles.formalSentenceSection}>
        {/* <div className={styles.formalSentenceLabel}>정형화 문장</div> */}
        <div className={styles.formalSentence}>{script.formalSentence}</div>
        <div className={styles.formalInstruction}>위 문장을 읽어주세요</div>
      </div>
    </>
  );

  // 튜토리얼 렌더링
  const renderTutorial = (script: TutorialScript) => (
    <>
      {/* <div className={styles.categoryBadge}>
        {getTypeIcon(ScriptType.TUTORIAL)} 녹음 연습하기
      </div> */}
      <div className={styles.titleSection}>
        <h1 className={styles.title}>{script.title}</h1>
        {isCompleted && (
          <div className={styles.completedBadge}>✅ 제출완료</div>
        )}
      </div>
      <div className={styles.formalSentenceSection}>
        {/* <div className={styles.situationLabel}>상황</div> */}
        <div className={styles.situation}>{script.description}</div>
        {/* <div className={styles.descriptionLabel}>상세 설명</div> */}
        <div className={styles.tutorialInstruction}>{script.explain}</div>
        {/* <div className={styles.qaInstruction}>
          이 상황에서 어떻게 대답하시겠어요?
        </div> */}
      </div>
    </>
  );

  // 타입에 따른 렌더링
  console.log("여기 스크립트 타입?", scriptType);
  switch (scriptType) {
    case ScriptType.SITUATIONAL:
      return renderSituationalScript(script as SituationalScript);
    case ScriptType.FORMAL:
      return renderFormalScript(script as FormalScript);

    case ScriptType.TUTORIAL:
      return renderTutorial(script as TutorialScript);
    default:
      return (
        <div className={styles.unknownScript}>
          <div className={styles.errorMessage}>
            알 수 없는 스크립트 타입입니다.
          </div>
        </div>
      );
  }
};
