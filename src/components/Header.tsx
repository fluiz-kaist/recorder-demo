import React from "react";
import { useRouter } from "next/router";
import styles from "@/styles/Header.module.css";

const Header = () => {
  const router = useRouter();

  // 홈으로 이동
  const handleHomeClick = () => {
    router.push("/");
  };

  // 로그아웃 처리
  const handleLogout = () => {
    // 로그아웃 로직 구현
    if (confirm("로그아웃 하시겠습니까?")) {
      // 실제 로그아웃 처리 로직
      console.log("로그아웃 처리");
      router.push("/login");
    }
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
    <header className={styles.header}>
      <div className={styles.container}>
        {/* 로고 영역 */}
        <div 
          className={styles.logo}
          onClick={() => {
            triggerHapticFeedback();
            handleHomeClick();
          }}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => handleKeyDown(e, handleHomeClick)}
        >
          <div className={styles.logoIcon}>
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z"/>
            </svg>
          </div>
          <span className={styles.logoText}>음성수집</span>
        </div>

        {/* 로그아웃 버튼 */}
        <button
          className={styles.logoutButton}
          onClick={() => {
            triggerHapticFeedback();
            handleLogout();
          }}
          onKeyDown={(e) => handleKeyDown(e, handleLogout)}
        >
          <span className={styles.logoutIcon}>
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.59L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z"/>
            </svg>
          </span>
          <span className={styles.logoutText}>로그아웃</span>
        </button>
      </div>
    </header>
  );
};

export default Header;