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

  // Situational Script 렌더링 (새 데이터 구조)
  const renderSituationalScript = (script: SituationalScript) => (
    <>
      <div className={styles.titleSection}>
        {/* 서비스 정보 표시 */}
        {/* <div className={styles.serviceInfo}>
          <span className={styles.serviceName}>{script.service_name}</span>
          <span className={styles.serviceTarget}>
            {" "}
            • {script.service_target}
          </span>
        </div> */}

        {/* 태스크 이름 */}
        {/* <h2 className={styles.taskName}>{script.task_name}</h2> */}

        {/* 메인 콘텐츠 */}
        <div
          className={`${styles.mainContent} ${
            isCompleted ? styles.completedOverlay : ""
          }`}
        >
          {script.main_content}
          {/* 상세 지침 */}
          {script.detailed_instruction && (
            <div className={styles.detailedInstruction}>
              <div className={styles.instructionLabel}>💡추가 안내</div>
              <div className={styles.instructionText}>
                {script.detailed_instruction}
              </div>
            </div>
          )}
          {isCompleted && <div className={styles.completedText}>제출 완료</div>}
        </div>
      </div>
    </>
  );

  // Formal Script 렌더링 (새 데이터 구조)
  const renderFormalScript = (script: FormalScript) => (
    <>
      <div className={styles.titleSection}>
        {/* {isCompleted && (
          <div className={styles.completedBadge}>✅ 제출완료</div>
        )} */}

        {/* 서비스 정보 표시 */}
        <div className={styles.serviceInfo}>
          <span className={styles.serviceName}>{script.service_name}</span>
          <span className={styles.serviceTarget}>
            {" "}
            • {script.service_target}
          </span>
        </div>

        {/* 태스크 이름 */}
        <h2 className={styles.taskName}>{script.task_name}</h2>
      </div>

      <div
        className={`${styles.formalSentenceSection} ${
          isCompleted ? styles.completedOverlay : ""
        }`}
      >
        {/* <div className={styles.formalSentenceLabel}>정형화 문장</div> */}
        <div className={styles.formalSentence}>{script.formal_script}</div>
        <div className={styles.formalInstruction}>위 문장을 읽어주세요</div>
        {isCompleted && <div className={styles.completedText}>제출 완료</div>}
        {/* Set ID 정보 (필요시) */}
        {/* <div className={styles.setInfo}>
          <span className={styles.setId}>세트 {script["set-id"]}</span>
        </div> */}
      </div>
    </>
  );

  // 튜토리얼 렌더링 (기존과 동일)
  const renderTutorial = (script: TutorialScript) => {
    console.log("?", script);

    return (
      <>
        <div className={styles.titleSection}>
          <h1 className={styles.title}>{script.title}</h1>
          {/* {isCompleted && (
            <div className={styles.completedBadge}>✅ 제출완료</div>
          )} */}
        </div>

        {script.type === ScriptType.FORMAL ? (
          <div
            className={`${styles.formalSentenceSection} ${
              isCompleted ? styles.completedOverlay : ""
            }`}
          >
            <div
              className={styles.formal}
              dangerouslySetInnerHTML={{ __html: script.description }}
            ></div>

            <div
              className={styles.tutorialInstruction}
              dangerouslySetInnerHTML={{ __html: script.explain }}
            ></div>

            {isCompleted && (
              <div className={styles.completedText}>제출 완료</div>
            )}
          </div>
        ) : (
          <>
            <p className={styles.tutorialDetailedInstruction}>
              아래와 같은 상황이 주어집니다.
            </p>
            <div
              className={`${styles.mainContent} ${
                isCompleted ? styles.completedOverlay : ""
              }`}
            >
              <div
                dangerouslySetInnerHTML={{ __html: script.description }}
              ></div>
              <div
                className={styles.tutorialInstruction}
                dangerouslySetInnerHTML={{ __html: script.explain }}
              ></div>
              {isCompleted && (
                <div className={styles.completedText}>제출 완료</div>
              )}
            </div>

            <div className={styles.tutorialDetailedInstruction}>
              🎤
              <br />
              <span style={{ color: "green", fontWeight: "bold" }}>
                초록 버튼
              </span>
              을 누른 후{" "}
              <span style={{ color: "red", fontWeight: "bold" }}>
                빨간 버튼
              </span>
              이 보일 때
              <br />
              그때부터 말씀해주세요!
            </div>
          </>
        )}
      </>
    );
  };

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
