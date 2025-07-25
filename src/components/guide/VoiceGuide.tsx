// components/tutorial/VoiceGuide.tsx - 음성 녹음 안내 전용 컴포넌트
import React from "react";
import styles from "@/styles/VoiceGuide.module.css";

const VoiceGuide: React.FC = () => {
  return (
    <div className={styles.container}>
      {/* 헤더 */}
      <div className={styles.headerSection}>
        <div className={styles.headerIcon}>🎤</div>
        <h1 className={styles.mainTitle}>비서에게 말하는 방법</h1>
      </div>

      {/* 사용 방법 단계 */}
      <div className={styles.stepsSection}>
        <div className={styles.stepCard}>
          <div className={styles.stepIcon}>
            <div className={styles.stepNumber}>1</div>
          </div>
          <div className={styles.stepContent}>
            <h3 className={styles.stepTitle}>마이크 버튼을 눌러주세요</h3>
            <p className={styles.stepDescription}>
              화면에 있는 마이크 모양 버튼을 손가락으로 눌러주세요
            </p>
          </div>
          <div className={styles.stepVisual}>🔴</div>
        </div>

        <div className={styles.stepCard}>
          <div className={styles.stepIcon}>
            <div className={styles.stepNumber}>2</div>
          </div>
          <div className={styles.stepContent}>
            <h3 className={styles.stepTitle}>자연스럽게 말씀해주세요</h3>
            <p className={styles.stepDescription}>
              평소 가족에게 부탁하듯이 편안하게 말씀하시면 됩니다
            </p>
          </div>
          <div className={styles.stepVisual}>💬</div>
        </div>

        <div className={styles.stepCard}>
          <div className={styles.stepIcon}>
            <div className={styles.stepNumber}>3</div>
          </div>
          <div className={styles.stepContent}>
            <h3 className={styles.stepTitle}>
              말이 끝나면 다시 버튼을 눌러주세요
            </h3>
            <p className={styles.stepDescription}>
              녹음한 음성을 확인하고 제출해주세요.
            </p>
          </div>
          <div className={styles.stepVisual}>✅</div>
        </div>
      </div>

      {/* 음성 녹음 팁 */}
      <div className={styles.tipsSection}>
        <h3 className={styles.tipsTitle}>📢 음성 녹음 팁</h3>
        <div className={styles.tipsList}>
          <div className={styles.tipItem}>
            <span className={styles.tipIcon}>🤫</span>
            <span className={styles.tipText}>
              <strong>조용한 곳에서</strong> 말씀해주세요
            </span>
          </div>
          <div className={styles.tipItem}>
            <span className={styles.tipIcon}>📏</span>
            <span className={styles.tipText}>
              핸드폰을 입에서 <strong>15-20cm 정도</strong> 떨어뜨려 주세요
            </span>
          </div>
          <div className={styles.tipItem}>
            <span className={styles.tipIcon}>⏱️</span>
            <span className={styles.tipText}>
              <strong>최소 3초 이상</strong> 말씀해주세요
            </span>
          </div>
          {/* <div className={styles.tipItem}>
            <span className={styles.tipIcon}>🐌</span>
            <span className={styles.tipText}>
              또박또박 <strong>천천히</strong> 말씀해주세요
            </span>
          </div> */}
        </div>
      </div>
      <p className={styles.callToActionText}>
        계속해서 [다음] 버튼을 눌러서 진행해주세요!
      </p>
    </div>
  );
};

export default VoiceGuide;
