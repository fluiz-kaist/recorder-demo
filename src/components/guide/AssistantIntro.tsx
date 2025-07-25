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
          핸드폰 앱을 다뤄주는 비서를 소개합니다
        </h1>
      </div>

      {/* 설명 */}
      <div className={styles.descriptionSection}>
        <p className={styles.mainDescription}>
          이 비서는 <strong>여러분의 말을 듣고, </strong>
          <span className={styles.highlight}>
            스마트폰 앱을 자동으로 실행하고 조작
          </span>
          합니다.
        </p>
      </div>

      {/* 기능 소개 */}
      <div className={styles.featuresSection}>
        <div className={styles.featureCard}>
          <div className={styles.featureIcon}>🚆</div>
          <div className={styles.featureContent}>
            <h3 className={styles.featureTitle}>기차표 예매</h3>
            <p className={styles.featureDescription}>
              비서가 앱을 열고 기차표를 대신 예매해줍니다
            </p>
          </div>
        </div>

        <div className={styles.featureCard}>
          <div className={styles.featureIcon}>🚕</div>
          <div className={styles.featureContent}>
            <h3 className={styles.featureTitle}>택시 호출</h3>
            <p className={styles.featureDescription}>
              비서가 택시 앱을 실행해 호출까지 도와줍니다
            </p>
          </div>
        </div>

        <div className={styles.featureCard}>
          <div className={styles.featureIcon}>🛒</div>
          <div className={styles.featureContent}>
            <h3 className={styles.featureTitle}>온라인 쇼핑몰 주문하기</h3>
            <p className={styles.featureDescription}>
              온라인 쇼핑 앱을 열고 주문을 대신 진행합니다
            </p>
          </div>
        </div>
      </div>

      {/* 핵심 메시지 */}
      <div className={styles.keyMessageSection}>
        <div className={styles.keyMessage}>
          <p>
            이제 이 비서를 상상하면서, <u>어떤 말을 하실지</u> 녹음하는 연습을
            해보겠습니다.
          </p>
          <p>
            <strong>평소처럼 부탁하듯 말씀해 주세요.</strong>
          </p>
        </div>
      </div>
      <p className={styles.next}>계속해서 [다음] 버튼을 눌러서 진행해주세요!</p>
    </div>
  );
};

export default AssistantIntro;
