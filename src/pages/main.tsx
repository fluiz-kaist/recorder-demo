import React from "react";
import { useRouter } from "next/router";
import styles from "@/styles/MainSelectionPage.module.css";

const MainSelectionPage = () => {
  const router = useRouter();

  // 상황별 스크립트 녹음
  const handleSituationScript = () => {
    router.push("/script/situational");
  };

  // 정형화 스크립트 녹음
  const handleFormalScript = () => {
    router.push("/script/formal");
  };

  // 햅틱 피드백 (모바일)
  const triggerHapticFeedback = () => {
    if ("vibrate" in navigator) {
      navigator.vibrate(50);
    }
  };

  // 키보드 접근성을 위한 핸들러
  const handleKeyDown = (e: React.KeyboardEvent, handler: () => void) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      triggerHapticFeedback();
      handler();
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.content}>
        {/* 헤더 */}
        <header className={styles.header}>
          <h1 className={styles.title}>음성 수집 페이지</h1>
          <p className={styles.subtitle}>원하는 녹음 방법을 선택해주세요</p>
        </header>

        {/* 선택 카드들 */}
        <main className={styles.cardContainer}>
          {/* 정형화 스크립트 녹음 */}
          <div
            onClick={() => {
              triggerHapticFeedback();
              handleFormalScript();
            }}
            className={`${styles.card} ${styles.cardBlue}`}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => handleKeyDown(e, handleFormalScript)}
          >
            <div className={styles.cardIcon}>
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z" />
              </svg>
            </div>

            <h2 className={styles.cardTitle}>정형화 녹음</h2>

            <p className={styles.cardDescription}>
              주어진 문장을 자연스럽게 읽어주세요
            </p>

            <div className={styles.cardAction}>
              <span>선택하기</span>
              <span className={styles.arrow}>→</span>
            </div>
          </div>
          {/* 상황별 스크립트 녹음 */}
          <div
            onClick={() => {
              triggerHapticFeedback();
              handleSituationScript();
            }}
            className={`${styles.card} ${styles.cardGreen}`}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => handleKeyDown(e, handleSituationScript)}
          >
            <div className={styles.cardIcon}>
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M20 2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h4l4 4 4-4h4c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z" />
              </svg>
            </div>

            <h2 className={styles.cardTitle}>상황별 녹음</h2>

            <p className={styles.cardDescription}>
              상황을 보고 발화한 내용을 녹음합니다
            </p>

            <div className={styles.cardAction}>
              <span>선택하기</span>
              <span className={styles.arrow}>→</span>
            </div>
          </div>

          {/* 질의응답 스크립트 녹음 */}
          {/* <div
            onClick={() => {
              triggerHapticFeedback();
              handleQAScript();
            }}
            className={`${styles.card} ${styles.cardPurple}`}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => handleKeyDown(e, handleQAScript)}
          >
            <div className={styles.cardIcon}>
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M10,19H13V22H10V19M12,2C17.35,2.22 19.68,7.62 16.5,11.67C15.67,12.67 14.33,13.33 13.67,14.17C13,15 13,16 13,17H10C10,15.33 10,13.92 10.67,12.92C11.33,11.92 12.67,11.33 13.5,10.67C15.92,8.43 15.32,5.26 12,5A3,3 0 0,0 9,8H6A6,6 0 0,1 12,2Z" />
              </svg>
            </div>

            <h2 className={styles.cardTitle}>질의응답 녹음</h2>

            <p className={styles.cardDescription}>
              ❓ 질문에 대한 답변을 자유롭게 말씀해주세요
            </p>

            <div className={styles.cardAction}>
              <span>선택하기</span>
              <span className={styles.arrow}>→</span>
            </div>
          </div> */}
        </main>

        {/* 하단 정보 */}
        <footer className={styles.footer}>
          <p className={styles.footerText}></p>
        </footer>
      </div>
    </div>
  );
};

export default MainSelectionPage;
