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
        <h1 className={styles.mainTitle}>
          여러분을 대신해
          <br />
          핸드폰을 다뤄주는 비서를 소개합니다
        </h1>
      </div>

      {/* 설명 */}
      <div className={styles.descriptionSection}>
        <p className={styles.mainDescription}>
          이 비서는 <strong>여러분의 말을 듣고, </strong>
          <span className={styles.highlight}>일을 대신해</span>줍니다.
        </p>
      </div>

      {/* 기능 소개 */}
      <div className={styles.featuresSection}>
        <div className={styles.featureCard}>
          <div className={styles.featureIcon}>🚆</div>
          <div className={styles.featureContent}>
            <h3 className={styles.featureTitle}>기차표 예매</h3>
            <p className={styles.featureDescription}>
              말씀만 하시면 비서가 핸드폰으로 기차표를 대신 예매해 드립니다.
            </p>
          </div>
        </div>

        <div className={styles.featureCard}>
          <div className={styles.featureIcon}>🚕</div>
          <div className={styles.featureContent}>
            <h3 className={styles.featureTitle}>택시 호출</h3>
            <p className={styles.featureDescription}>
              비서가 택시 앱을 실행해 택시를 불러 드립니다.
            </p>
          </div>
        </div>

        <div className={styles.featureCard}>
          <div className={styles.featureIcon}>🛒</div>
          <div className={styles.featureContent}>
            <h3 className={styles.featureTitle}>온라인 쇼핑몰 주문하기</h3>
            <p className={styles.featureDescription}>
              온라인 쇼핑몰에 들어가 물건 주문까지 대신 진행해 드립니다.
            </p>
          </div>
        </div>

        <div className={styles.featureCard}>
          <div className={styles.featureIcon}>❗ </div>
          <div className={styles.featureContent}>
            <h3 className={styles.featureTitle}>참고하세요</h3>
            <p className={styles.featureDescription}>
              비서는 핸드폰을 직접 다뤄주는 역할을 합니다. 그래서{" "}
              <u>[어떻게 하는지]를 물어보실 필요는 없습니다.</u>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AssistantIntro;
