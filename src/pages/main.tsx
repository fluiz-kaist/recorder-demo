import React, { useEffect, useState } from "react";
import { useRouter } from "next/router";
import styles from "@/styles/MainSelectionPage.module.css";
import Head from "next/head";
import { useLocalUserQuery } from "@/hooks/queries/useUserQueries";

const MainSelectionPage = () => {
  const router = useRouter();

  // 🟢 쿠키 기반 인증 상태 확인
  const { data: localUser, isLoading } = useLocalUserQuery();

  // 로컬 상태

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

  // 튜토리얼 페이지로 이동
  const handleTutorial = () => {
    router.push("tutorial");
  };

  // 🟢 인증된 사용자 이름 가져오기
  const userName = localUser?.name || "";

  if (isLoading) {
    // localUser 로딩만 체크
    return (
      <>
        <Head>
          <title>음성 녹음 서비스</title>
          <meta
            name="viewport"
            content="width=device-width, initial-scale=1.0, user-scalable=yes"
          />
        </Head>
        <div className={styles.container}>
          <div className={styles.loadingContainer}>
            <div className={styles.loadingSpinner}></div>
            <p>인증 상태를 확인하고 있습니다...</p>
          </div>
        </div>
      </>
    );
  }

  // 🟢 메인 페이지 (완전 인증된 사용자만 여기까지 도달)
  return (
    <>
      <Head>
        <title>음성 녹음 서비스</title>
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1.0, user-scalable=yes"
        />
      </Head>

      <div className={styles.container}>
        <div className={styles.content}>
          {/* 헤더 */}
          <header className={styles.header}>
            <h1 className={styles.title}>
              {userName ? `안녕하세요, ${userName}님!` : "음성 녹음 서비스"}
            </h1>
          </header>

          {/* 선택 카드들 */}
          <main className={styles.cardContainer}>
            <div
              onClick={() => {
                triggerHapticFeedback();
                handleTutorial();
              }}
              className={`${styles.card} ${styles.cardOrange}`}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => handleKeyDown(e, handleTutorial)}
            >
              <div className={styles.cardIcon}>
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M12,17C11.45,17 11,16.55 11,16C11,15.45 11.45,15 12,15C12.55,15 13,15.45 13,16C13,16.55 12.55,17 12,17M13,13H11V7H13V13Z" />
                </svg>
              </div>

              <h2 className={styles.cardTitle}>처음 사용하시나요?</h2>

              <p className={styles.cardDescription}>
                음성 녹음 방법을 쉽게 알려드립니다
              </p>

              <div className={styles.cardAction}>
                <span>사용법 보기</span>
                <span className={styles.arrow}>→</span>
              </div>
            </div>

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

              <h2 className={styles.cardTitle}>정형 녹음</h2>

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
          </main>

          {/* 디버깅 정보 */}
          {process.env.NODE_ENV === "development" && (
            <div className={styles.debugInfo}>
              <h4>🐛 디버그 정보 (미들웨어 보호)</h4>
              <p>✅ 미들웨어를 통과한 인증된 사용자</p>
              <p>사용자명: {localUser?.name || "로딩 중..."}</p>
            </div>
          )}

          {/* 하단 정보 */}
          <footer className={styles.footer}>
            <p className={styles.footerText}></p>
          </footer>
        </div>
      </div>
    </>
  );
};

export default MainSelectionPage;
