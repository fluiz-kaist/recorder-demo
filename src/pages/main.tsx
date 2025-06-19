import React from "react";
import { useRouter } from "next/router";
import styles from "@/styles/MainSelectionPage.module.css";

const MainSelectionPage = () => {
  const router = useRouter();

  //   const handleIndividualScript = () => {
  //     router.push("/individual-recording");
  //   };

  const handleSituationScript = () => {
    router.push("/situationRecording");
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
          {/* 개별 스크립트 녹음 */}
          {/* <div
            onClick={handleIndividualScript}
            className={`${styles.card} ${styles.cardBlue}`}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                handleIndividualScript();
              }
            }}
          >
            <div className={styles.cardIcon}>
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3zm0 2a1 1 0 0 0-1 1v6a1 1 0 0 0 2 0V5a1 1 0 0 0-1-1zm0 12c-2.5 0-4.5-2-4.5-4.5H6c0 3.3 2.7 6 6 6s6-2.7 6-6h-1.5c0 2.5-2 4.5-4.5 4.5zm-2 2v2h4v-2h-4z" />
              </svg>
            </div>

            <h2 className={styles.cardTitle}>개별 스크립트 녹음</h2>

            <p className={styles.cardDescription}>한 문장씩 녹음합니다.</p>

            <div className={styles.cardAction}>
              <span>선택하기</span>
              <span className={styles.arrow}>→</span>
            </div>
          </div> */}

          {/* 상황 스크립트 녹음 */}
          <div
            onClick={handleSituationScript}
            className={`${styles.card} ${styles.cardGreen}`}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                handleSituationScript();
              }
            }}
          >
            <div className={styles.cardIcon}>
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M20 2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h4l4 4 4-4h4c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z" />
              </svg>
            </div>

            <h2 className={styles.cardTitle}>상황별 녹음</h2>

            <p className={styles.cardDescription}>
              실제 상황을 보고 발화한 내용을 녹음합니다
            </p>

            <div className={styles.cardAction}>
              <span>선택하기</span>
              <span className={styles.arrow}>→</span>
            </div>
          </div>
        </main>

        {/* 하단 정보 */}
        <footer className={styles.footer}>
          <p className={styles.footerText}>
            언제든지 다른 방법으로 바꿀 수 있습니다
          </p>
        </footer>
      </div>
    </div>
  );
};

export default MainSelectionPage;
