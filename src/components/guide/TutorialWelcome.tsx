// components/tutorial/TutorialWelcome.tsx - 튜토리얼 시작 안내 컴포넌트 (수정된 내용)
import React from "react";
import styles from "@/styles/TutorialWelcome.module.css"; // 기존 CSS 모듈 파일 재사용 또는 수정

const TutorialWelcome: React.FC = () => {
  return (
    <div className={styles.container}>
      <div className={styles.iconSection}>
        <div className={styles.mainIcon}>🗣️</div>{" "}
        {/* 목소리/말하기 관련 아이콘 */}
      </div>

      <div className={styles.titleSection}>
        <h1 className={styles.mainTitle}>
          <span className={styles.highlight}>특별한 비서</span>에게
          <br />
          <span className={styles.highlight}>시키는 말</span>을 남겨주세요!
        </h1>
      </div>

      <div className={styles.descriptionSection}>
        <p className={styles.descriptionText}>
          <span className={styles.highlight}>일상적인 상황</span>
          에 대해
          <br />
          <strong>평소처럼 편하게 말씀</strong>해주세요.
          <br />
          사용자님의{" "}
          <span className={styles.highlight}>자연스러운 시키는 말</span>이<br />
          비서를 더 똑똑하게 만들 수 있습니다!
        </p>
      </div>

      <div className={styles.featureListSection}>
        <h2 className={styles.listTitle}>연습 과정은 이렇게 진행됩니다:</h2>
        <ul className={styles.featureList}>
          <li>
            <span className={styles.listItemIcon}>1️⃣</span>
            <span className={styles.listItemText}>
              &lt;비서&gt;가 어떤 일을 할 수 있는지 알아봅니다.
            </span>
          </li>
          <li>
            <span className={styles.listItemIcon}>2️⃣</span>
            <span className={styles.listItemText}>
              <strong>목소리를 녹음하는 방법</strong>을 쉽고 자세히 안내해
              드립니다.
            </span>
          </li>
          <li>
            <span className={styles.listItemIcon}>3️⃣</span>
            <span className={styles.listItemText}>
              실제 상황처럼 <strong>목소리로 비서에게 말하는 연습</strong>을
              해봅니다.
            </span>
          </li>
        </ul>
      </div>

      <div className={styles.callToActionSection}>
        <p className={styles.callToActionText}>
          시작해볼까요?
          <br />
          아래 [다음] 버튼을 눌러서 진행해주세요!
        </p>
      </div>
    </div>
  );
};

export default TutorialWelcome;
