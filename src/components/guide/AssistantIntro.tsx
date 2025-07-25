// components/tutorial/AssistantIntro.tsx - 비서 소개 전용 컴포넌트
import React from "react";
import styles from "@/styles/AssistantIntro.module.css";

const AssistantIntro: React.FC = () => {
  return (
    <div className={styles.container}>
      {/* 비서 아이콘 */}
      <div className={styles.iconSection}>
        <div className={styles.assistantIcon}>🤖</div>
      </div>

      {/* 메인 타이틀 */}
      <div className={styles.titleSection}>
        <h1 className={styles.mainTitle}>똑똑한 비서가 생겼습니다!</h1>
      </div>

      {/* 설명 */}
      <div className={styles.descriptionSection}>
        <p className={styles.mainDescription}>
          이제{" "}
          <span className={styles.highlight}>
            당신의 핸드폰 앱을<br></br> <strong>직접 조작</strong>해주는 비서
          </span>
          가 생겼습니다.
        </p>
      </div>

      {/* 기능 소개 */}
      <div className={styles.featuresSection}>
        <div className={styles.featureCard}>
          <div className={styles.featureIcon}>🚆</div>
          <div className={styles.featureContent}>
            <h3 className={styles.featureTitle}>기차표 예매</h3>
            <p className={styles.featureDescription}>
              [기차표 예매해줘]라고 말하면 대신 앱을 켜서 예매해드려요
            </p>
          </div>
        </div>

        <div className={styles.featureCard}>
          <div className={styles.featureIcon}>🚕</div>
          <div className={styles.featureContent}>
            <h3 className={styles.featureTitle}>택시 호출</h3>
            <p className={styles.featureDescription}>
              [택시 불러줘]라고 말하면 앱을 조작해서 대신 불러드려요
            </p>
          </div>
        </div>

        <div className={styles.featureCard}>
          <div className={styles.featureIcon}>🛒</div>
          <div className={styles.featureContent}>
            <h3 className={styles.featureTitle}>온라인 쇼핑몰 주문하기</h3>
            <p className={styles.featureDescription}>
              [전구 주문해줘]라고 말하면 대신 핸드폰 앱을 켜서 주문해줘요
            </p>
          </div>
        </div>
      </div>

      {/* 핵심 메시지 */}
      <div className={styles.keyMessageSection}>
        <div className={styles.keyMessage}>
          <p>마치 옆에 있는 가족이나 지인이 대신 핸드폰을 조작해주는 것처럼,</p>
          <p>
            <strong>말로만 부탁하시면 모든 일을 처리해드립니다.</strong>
          </p>
        </div>
      </div>
      <p className={styles.callToActionText}>
        계속해서 [다음] 버튼을 눌러서 진행해주세요!
      </p>
    </div>
  );
};

export default AssistantIntro;
