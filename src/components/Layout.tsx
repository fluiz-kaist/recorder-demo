import React, { useState, useEffect } from "react";
import { useRouter } from "next/router";
import styles from "@/styles/Layout.module.css";
import { useIsAuthenticated } from "@/hooks/queries/useUserQueries";
import { useLogoutUserMutation } from "@/hooks/mutations/useUserMutations";
import AssistantIntro from "@/components/guide/AssistantIntro";
import VoiceGuide from "@/components/guide/VoiceGuide";
import MicPermission from "@/components/guide/MicPermission";
import { useUserQuery } from "@/hooks/queries/useUserQueries";
import { useTaskTracking } from "@/hooks/useTaskTracking";
import { useUserStatusValidation } from "@/utils/userStatusValidation";

interface LayoutProps {
  children: React.ReactNode;
}

const Layout = ({ children }: LayoutProps) => {
  const [isAdmin, setIsAdmin] = useState(false);

  //guide
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [guideModalType, setGuideModalType] = useState<
    "assistant" | "voice" | "method"
  >("assistant");
  const [micPermissionGranted, setMicPermissionGranted] = useState(false);

  const router = useRouter();
  const logoutMutation = useLogoutUserMutation();

  // 특정 경로에서만 "처음 화면으로" 버튼을 보여줄 경로들
  const showHomeButtonPaths = ["/tutorial", "/scripts", "/recording"];
  const shouldShowHomeButton = showHomeButtonPaths.some((path) =>
    router.asPath.startsWith(path)
  );
  // console.log("router.pathname?", router.pathname);

  // 인증 상태 확인
  const isAuthenticated = useIsAuthenticated();

  const { data: user, isLoading } = useUserQuery();

  const { submitPendingData, endTracking, clearAllTrackingData } =
    useTaskTracking();
  // 사용자 상태 분석
  const userStatus = useUserStatusValidation(user);

  useEffect(() => {
    if (!isLoading && user && userStatus) {
      const isOnCompletionPage = router.asPath.startsWith("/completion"); // ← asPath 사용
      const isAdminRoute = router.pathname.includes("/admin");
      const isIndexPage = router.pathname === "/";

      // 관리자 페이지, 완료 페이지, 인덱스 페이지는 제외
      if (isAdminRoute || isOnCompletionPage || isIndexPage) {
        return;
      }

      // 시작 페이지 접근 불가능한 사용자는 리다이렉트
      if (!userStatus.canAccessStart && userStatus.shouldRedirect) {
        console.log(
          `사용자 상태(${userStatus.status})에 따라 리다이렉트:`,
          userStatus.redirectPath
        );
        router.replace(userStatus.redirectPath!);
      }
    }
  }, [user, isLoading, userStatus, router]);

  useEffect(() => {
    const checkAdminCookie = () => {
      if (typeof document !== "undefined") {
        const cookies = document.cookie.split(";");
        const adminCookie = cookies.find((cookie) =>
          cookie.trim().startsWith("admin-token=")
        );
        // console.log("쿠키?", adminCookie);

        if (adminCookie) {
          const adminToken = adminCookie.split("=")[1]?.trim();
          // console.log("?adminToken", adminToken);
          // admin-token이 존재하고 값이 있으면 관리자로 인식
          setIsAdmin(!!adminToken && adminToken.startsWith("admin-"));
        } else {
          setIsAdmin(false);
        }
      }
    };

    checkAdminCookie();
  }, []);

  const handleHomeClick = () => {
    if (isAuthenticated) {
      router.push("/main");
    } else {
      router.push("/");
    }
  };

  // 사용자 로그아웃 처리
  const handleLogout = async () => {
    if (confirm("작업을 끝내시겠습니까?")) {
      localStorage.removeItem("pendingAuth");
      await logoutMutation.mutateAsync();
      router.push("/");
    }
  };

  // 도움말 클릭
  const handleHelp = () => {
    alert("도움말 페이지로 이동합니다.(구현예정)");
  };

  // 문의하기 클릭
  const handleContact = () => {
    alert("문의하기 페이지로 이동합니다.(구현예정)");
  };

  const handleAdminLogout = () => {
    if (confirm("관리자 로그아웃 하시겠습니까?")) {
      document.cookie =
        "admin=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
      setIsAdmin(false);
      router.push("/admin/login");
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

  const goBack = () => {
    triggerHapticFeedback();
    router.push("/");
  };

  //guide

  const requestMicPermission = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
      setMicPermissionGranted(true);
      triggerHapticFeedback();
    } catch (error) {
      alert("마이크 권한이 필요합니다. 브라우저 설정을 확인해 주세요.");
    }
  };

  const openGuideModal = (type: "assistant" | "voice" | "method") => {
    setGuideModalType(type);
    setShowGuideModal(true);
  };

  // 추적 데이터 처리 함수 추가
  const handleLogoutWithTracking = async () => {
    try {
      // 현재 진행 중인 추적 종료
      endTracking("logout");

      // 모든 미제출 데이터 제출
      const result = await submitPendingData();
      console.log(`로그아웃 ; ${result.totalCount}개 제출 완료`);

      // 혹시 남은 데이터 정리
      clearAllTrackingData();
    } catch (error) {
      console.error("로그아웃 시 추적 데이터 처리 실패:", error);
      // 실패해도 로그아웃은 진행
    }

    // 기존 로그아웃 실행
    handleLogout();
  };

  // 버튼에서 사용
  <button
    className={styles.logoutButton}
    onClick={() => {
      triggerHapticFeedback();
      handleLogoutWithTracking();
    }}
    onKeyDown={(e) => handleKeyDown(e, handleLogoutWithTracking)}
  >
    <span className={styles.logoutIcon}>
      <svg viewBox="0 0 24 24" fill="currentColor">
        <path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.59L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z" />
      </svg>
    </span>
    <span className={styles.logoutText}>작업 종료하기</span>
  </button>;

  const renderGuideModal = () => {
    if (!showGuideModal) return null;

    let modalContent;
    switch (guideModalType) {
      case "assistant":
        modalContent = <AssistantIntro />;
        break;
      case "voice":
        modalContent = <VoiceGuide />;
        break;
      case "method":
        modalContent = (
          <MicPermission
            isGranted={micPermissionGranted}
            onRequestPermission={requestMicPermission}
          />
        );
        break;
    }

    return (
      <div
        className={styles.modalOverlay}
        onClick={() => setShowGuideModal(false)}
      >
        <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
          <div className={styles.modalHeader}>
            <h2>
              {guideModalType === "assistant"
                ? "비서 소개"
                : guideModalType === "voice"
                ? "음성 안내"
                : "마이크 사용법"}
            </h2>
            <button
              className={styles.modalCloseButton}
              onClick={() => setShowGuideModal(false)}
            >
              창 닫기
            </button>
          </div>
          <div className={styles.modalContent}>{modalContent}</div>
          <div
            style={{
              display: "flex",
              justifyContent: "center", // 가로 중앙
              alignItems: "center", // 세로 중앙
              flexDirection: "column", // 수직 정렬 시
            }}
          >
            <button
              className={styles.modalCloseButton}
              onClick={() => setShowGuideModal(false)}
            >
              녹음하러 가기
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div>
      {/* 헤더 */}
      <header className={styles.header}>
        <div className={styles.headerContainer}>
          {/* 로고 영역 또는 처음 화면으로 버튼 */}
          {shouldShowHomeButton ? (
            <button
              className={styles.logoutButton}
              onClick={() => {
                triggerHapticFeedback();
                handleHomeClick();
              }}
              onKeyDown={(e) => handleKeyDown(e, handleLogout)}
            >
              <span className={styles.logoutIcon}>
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" />
                </svg>
              </span>
              <span className={styles.logoutText}>처음 화면으로</span>
            </button>
          ) : (
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
                <span className={styles.logoText}>음성 녹음</span>
              </div>
            </div>
          )}

          {/* 로그아웃 영역 */}
          <div className={styles.buttonSection}>
            {isAdmin && (
              <button
                className={styles.logoutButton}
                onClick={() => {
                  triggerHapticFeedback();
                  handleAdminLogout();
                }}
                onKeyDown={(e) => handleKeyDown(e, handleAdminLogout)}
                style={{ marginRight: "8px" }}
              >
                <span className={styles.logoutIcon}>
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2C13.1 2 14 2.9 14 4C14 5.1 13.1 6 12 6C10.9 6 10 5.1 10 4C10 2.9 10.9 2 12 2ZM21 9V7L15 1H5C3.89 1 3 1.89 3 3V21C3 22.11 3.89 23 5 23H19C20.11 23 21 22.11 21 21V9M19 9H14V4H5V21H19V9Z" />
                  </svg>
                </span>
                <span className={styles.logoutText}>관리자 로그아웃</span>
              </button>
            )}
            <button
              className={styles.logoutButton}
              onClick={() => {
                triggerHapticFeedback();
                handleLogoutWithTracking();
              }}
              onKeyDown={(e) => handleKeyDown(e, handleLogoutWithTracking)}
            >
              <span className={styles.logoutIcon}>
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.59L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z" />
                </svg>
              </span>
              <span className={styles.logoutText}>작업 종료하기</span>
            </button>
          </div>
        </div>
      </header>

      {/* 가이드 모달 */}
      {renderGuideModal()}

      {/* 메인 콘텐츠 */}
      <main>{children}</main>

      {/* 푸터 */}
      <footer className={styles.footer}>
        <div className={styles.footerContainer}>
          {/* 푸터 - 도움말 버튼 */}
          {shouldShowHomeButton ? (
            <div className={styles.footerButtons}>
              <button
                className={styles.footerButton}
                onClick={() => openGuideModal("assistant")}
              >
                비서 소개
              </button>
              <button
                className={styles.footerButton}
                onClick={() => openGuideModal("voice")}
              >
                녹음 안내
              </button>
              <button
                className={styles.footerButton}
                onClick={() => openGuideModal("method")}
              >
                마이크
                <br />
                사용
              </button>
            </div>
          ) : (
            <></>
          )}

          {/* 구분선 */}
          <div className={styles.divider}></div>
          <div
            className={styles.adminItem}
            onClick={() => router.push("/admin/login")}
            role="button"
            tabIndex={0}
            onKeyDown={(e) =>
              handleKeyDown(e, () => router.push("/admin/login"))
            }
          >
            <div className={styles.adminIcon}>
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M10 17v-6h4v6h5v-8h3L12 3 2 12h3v8z" />
              </svg>
            </div>
            <span className={styles.adminText}>관리자 로그인</span>
          </div>
          {/* 저작권 정보 */}
          <div className={styles.copyright}>
            <p className={styles.copyrightText}>© 2025 Fluiz, 서울AI재단</p>
            <p className={styles.versionText}>버전 1.0.0</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Layout;
