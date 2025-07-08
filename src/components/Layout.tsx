import React from "react";
import { useRouter } from "next/router";
import styles from "@/styles/Layout.module.css";
import { useIsAuthenticated } from "@/hooks/queries/useUserQueries";
import { useLogoutUserMutation } from "@/hooks/mutations/useUserMutations";
// import {
//   useIsAdmin,
//   // useAdminPermission,
// } from "@/hooks/queries/useAdminQueries";
// import { useAdminLogoutMutation } from "@/hooks/mutations/useAdminMutations";

interface LayoutProps {
  children: React.ReactNode;
}

const Layout = ({ children }: LayoutProps) => {
  const router = useRouter();
  const logoutMutation = useLogoutUserMutation();
  // const adminLogoutMutation = useAdminLogoutMutation();
  // const [showAdminLogin, setShowAdminLogin] = useState(false);

  // 인증 상태 확인
  const isAuthenticated = useIsAuthenticated();
  // const { isAdmin, adminData } = useIsAdmin();
  // const canManageUsers = useAdminPermission("manageUsers");

  // 홈으로 이동 (인증 상태에 따라 분기)
  // const handleHomeClick = () => {
  //   if (isAdmin) {
  //     router.push("/admin/dashboard");
  //   } else if (isAuthenticated) {
  //     router.push("/main");
  //   } else {
  //     router.push("/");
  //   }
  // };

  const handleHomeClick = () => {
    if (isAuthenticated) {
      router.push("/main");
    } else {
      router.push("/");
    }
  };

  // 사용자 로그아웃 처리
  const handleLogout = async () => {
    if (confirm("로그아웃 하시겠습니까?")) {
      try {
        await logoutMutation.mutateAsync();
        // 성공 시 뮤테이션에서 자동으로 페이지 이동 처리됨
      } catch (error) {
        console.error("로그아웃 실패:", error);
      }
    }
  };

  // 관리자 로그아웃 처리
  // const handleAdminLogout = async () => {
  //   if (confirm("관리자 로그아웃 하시겠습니까?")) {
  //     try {
  //       // await adminLogoutMutation.mutateAsync();
  //     } catch (error) {
  //       console.error("관리자 로그아웃 실패:", error);
  //     }
  //   }
  // };

  // 관리자 로그인 페이지로 이동
  // const handleAdminLoginClick = () => {
  //   // router.push("/admin/login");
  //   alert("관리자 로그인 페이지로 이동합니다.(구현예정)");
  // };

  // 도움말 클릭
  const handleHelp = () => {
    alert("도움말 페이지로 이동합니다.(구현예정)");
    // router.push("/help");
  };

  // 문의하기 클릭
  const handleContact = () => {
    alert("문의하기 페이지로 이동합니다.(구현예정)");
    // router.push("/contact");
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
    <div>
      {/* 헤더 */}
      <header className={styles.header}>
        <div className={styles.headerContainer}>
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
                <path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z" />
              </svg>
            </div>
            <span className={styles.logoText}>
              {/* {isAdmin ? "관리자 - 음성수집" : "음성수집"} */}
              {"음성수집"}
            </span>
          </div>

          {/* 관리자 정보 및 로그아웃 영역 */}
          <div className={styles.authSection}>
            {/* {isAdmin && adminData && (
              <div className={styles.adminInfo}>
                <span className={styles.adminBadge}>관리자</span>
                <span className={styles.adminName}>{adminData.name}</span>
              </div>
            )} */}

            {/* 로그아웃 버튼 */}
            {/* {(isAuthenticated || isAdmin) && (
              <button
                className={styles.logoutButton}
                onClick={() => {
                  triggerHapticFeedback();
                  if (isAdmin) {
                    handleAdminLogout();
                  } else {
                    handleLogout();
                  }
                }}
                onKeyDown={(e) =>
                  handleKeyDown(e, isAdmin ? handleAdminLogout : handleLogout)
                }
              >
                <span className={styles.logoutIcon}>
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.59L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z" />
                  </svg>
                </span>
                <span className={styles.logoutText}>로그아웃</span>
              </button>
            )} */}
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
                  <path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.59L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z" />
                </svg>
              </span>
              <span className={styles.logoutText}>로그아웃</span>
            </button>
          </div>
        </div>
      </header>

      {/* 메인 콘텐츠 */}
      <main>{children}</main>

      {/* 푸터 */}
      <footer className={styles.footer}>
        <div className={styles.footerContainer}>
          {/* 도움말 링크 */}
          <div className={styles.helpSection}>
            <div
              className={styles.helpItem}
              onClick={() => {
                triggerHapticFeedback();
                handleHelp();
              }}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => handleKeyDown(e, handleHelp)}
            >
              <div className={styles.helpIcon}>
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm2.07-7.75l-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H8c0-2.21 1.79-4 4-4s4 1.79 4 4c0 .88-.36 1.68-.93 2.25z" />
                </svg>
              </div>
              <span className={styles.helpText}>도움말</span>
            </div>

            <div
              className={styles.helpItem}
              onClick={() => {
                triggerHapticFeedback();
                handleContact();
              }}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => handleKeyDown(e, handleContact)}
            >
              <div className={styles.helpIcon}>
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z" />
                </svg>
              </div>
              <span className={styles.helpText}>문의하기</span>
            </div>
          </div>

          {/* 구분선 */}
          <div className={styles.divider}></div>

          {/* 관리자 로그인 영역 */}
          {/* {!isAdmin && !isAuthenticated && (
            <div className={styles.adminLoginSection}>
              <div
                className={styles.adminLoginButton}
                onClick={() => {
                  triggerHapticFeedback();
                  handleAdminLoginClick();
                }}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => handleKeyDown(e, handleAdminLoginClick)}
              >
                <div className={styles.adminLoginIcon}>
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11V12z" />
                  </svg>
                </div>
                <span className={styles.adminLoginText}>관리자 로그인</span>
              </div>
            </div>
          )} */}

          {/* 저작권 정보 */}
          <div className={styles.copyright}>
            <p className={styles.copyrightText}>
              © 2024 음성수집 서비스. 모든 권리 보유.
            </p>
            <p className={styles.versionText}>버전 1.0.0</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Layout;
