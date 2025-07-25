import React, { useEffect, useState } from "react";
import { useRouter } from "next/router";
import styles from "@/styles/MainSelectionPage.module.css";
import Head from "next/head";
import {
  useCurrentSetNumber,
  useMinimalUserQuery,
  useUserQuery,
} from "@/hooks/queries/useUserQueries";
import { useScriptLoader } from "@/hooks/useScriptUtils";

const LOCK_ICON =
  "M12,17A1.5,1.5 0 0,0 13.5,15.5A1.5,1.5 0 0,0 12,14A1.5,1.5 0 0,0 10.5,15.5A1.5,1.5 0 0,0 12,17M17,8H16V6.5C16,4.57 14.43,3 12.5,3A3.5,3.5 0 0,0 9,6.5V8H8A2,2 0 0,0 6,10V20A2,2 0 0,0 8,22H17A2,2 0 0,0 19,20V10A2,2 0 0,0 17,8M11,6.5C11,5.67 11.67,5 12.5,5A1.5,1.5 0 0,1 14,6.5V8H11V6.5Z";

// 서비스별 아이콘과 색상 정의
const SERVICE_CONFIG = {
  건강: {
    icon: "M13.5,4C14,4.4 14,5.6 13.5,6L8.5,11L13.5,16C14,16.4 14,17.6 13.5,18C13.1,18.4 11.9,18.4 11.5,18L5.5,12C5.1,11.6 5.1,10.4 5.5,10L11.5,4C11.9,3.6 13.1,3.6 13.5,4Z",
    color: "cardGreen",
    description: "건강 관련 음성 명령",
  },
  교통: {
    icon: "M18.92,6.01C18.72,5.42 18.16,5 17.5,5H15V4A2,2 0 0,0 13,2H11A2,2 0 0,0 9,4V5H6.5C5.84,5 5.28,5.42 5.08,6.01L3,12V20A1,1 0 0,0 4,21H5A1,1 0 0,0 6,20V19H18V20A1,1 0 0,0 19,21H20A1,1 0 0,0 21,20V12L18.92,6.01M6.5,6.5H17.5L19,11H5L6.5,6.5M7.5,16A1.5,1.5 0 0,1 6,14.5A1.5,1.5 0 0,1 7.5,13A1.5,1.5 0 0,1 9,14.5A1.5,1.5 0 0,1 7.5,16M16.5,16A1.5,1.5 0 0,1 15,14.5A1.5,1.5 0 0,1 16.5,13A1.5,1.5 0 0,1 18,14.5A1.5,1.5 0 0,1 16.5,16Z",
    color: "cardBlue",
    description: "교통수단 이용 관련",
  },
  금융: {
    icon: "M5,6H23V18H5V6M14,9A3,3 0 0,1 17,12A3,3 0 0,1 14,15A3,3 0 0,1 11,12A3,3 0 0,1 14,9M9,8A2,2 0 0,1 7,10V14A2,2 0 0,1 9,16H19A2,2 0 0,1 21,14V10A2,2 0 0,1 19,8H9Z",
    color: "cardYellow",
    description: "은행 업무 관련",
  },
  메시지: {
    icon: "M20,2H4A2,2 0 0,0 2,4V22L6,18H20A2,2 0 0,0 22,16V4A2,2 0 0,0 20,2M6,9V7H18V9H6M14,13V11H18V13H14M6,13V11H12V13H6Z",
    color: "cardPurple",
    description: "메시지 및 통화 관련",
  },
  생활: {
    icon: "M12,3L20,9V21H15V14H9V21H4V9L12,3M12,7.5A1.5,1.5 0 0,0 10.5,9A1.5,1.5 0 0,0 12,10.5A1.5,1.5 0 0,0 13.5,9A1.5,1.5 0 0,0 12,7.5Z",
    color: "cardOrange",
    description: "생활 편의 서비스",
  },
  영상: {
    icon: "M17,10.5V7A1,1 0 0,0 16,6H4A1,1 0 0,0 3,7V17A1,1 0 0,0 4,18H16A1,1 0 0,0 17,17V13.5L21,17.5V6.5L17,10.5Z",
    color: "cardRed",
    description: "영상 콘텐츠 관련",
  },
  의료: {
    icon: "M13.5,4C14,4.4 14,5.6 13.5,6L8.5,11L13.5,16C14,16.4 14,17.6 13.5,18C13.1,18.4 11.9,18.4 11.5,18L5.5,12C5.1,11.6 5.1,10.4 5.5,10L11.5,4C11.9,3.6 13.1,3.6 13.5,4Z",
    color: "cardTeal",
    description: "의료 서비스 관련",
  },
  이동정보: {
    icon: "M12,2A10,10 0 0,1 22,12A10,10 0 0,1 12,22A10,10 0 0,1 2,12A10,10 0 0,1 12,2M12,4A8,8 0 0,0 4,12A8,8 0 0,0 12,20A8,8 0 0,0 20,12A8,8 0 0,0 12,4M12,6A6,6 0 0,1 18,12A6,6 0 0,1 12,18A6,6 0 0,1 6,12A6,6 0 0,1 12,6M12,8A4,4 0 0,0 8,12A4,4 0 0,0 12,16A4,4 0 0,0 16,12A4,4 0 0,0 12,8Z",
    color: "cardIndigo",
    description: "길찾기 및 이동정보",
  },
};

const MainSelectionPage = () => {
  const router = useRouter();

  // 🟢 쿠키 기반 인증 상태 확인
  const { data: minimalUserInfo, isLoading: isUserLoading } =
    useMinimalUserQuery();

  // 🟢 인증된 사용자 이름 가져오기
  const userName = minimalUserInfo?.userName;

  // 진행 상태 (서버)
  const { data: fullUser } = useUserQuery();
  const isTutorialCompleted = fullUser?.currentStatus?.isTutorialCompleted;

  const currentSetNumber = useCurrentSetNumber();
  // 또는 스크립트 로더 사용 (더 간편함)
  const { loadScriptsFromServer, isLoading: isScriptLoading } = useScriptLoader(
    currentSetNumber,
    1 // setId
  );

  console.log("fullUser?", fullUser);

  const [showContent, setShowContent] = useState(false);

  // 각 서비스별 완료 상태 (임시 데이터, 나중에 실제 데이터로 변경)
  const getServiceCompletionStatus = (serviceName: string) => {
    // TODO: 실제 사용자 진행 데이터에서 계산
    // 임시로 랜덤하게 일부 완료된 것처럼 표시
    const mockCompletedServices = ["건강", "메시지"];
    const mockInProgressServices = ["교통", "생활"];

    if (mockCompletedServices.includes(serviceName)) {
      return "completed"; // 완료
    } else if (mockInProgressServices.includes(serviceName)) {
      return "in-progress"; // 일부 완료
    }
    return "not-started"; // 미시작
  };

  // 서비스별 진행률 계산 (임시)
  const getServiceProgress = (serviceName: string) => {
    const status = getServiceCompletionStatus(serviceName);
    switch (status) {
      case "completed":
        return 100;
      case "in-progress":
        return Math.floor(Math.random() * 80) + 10; // 10-90%
      case "not-started":
        return 0;
      default:
        return 0;
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

  // 튜토리얼 페이지로 이동
  const handleTutorial = async () => {
    try {
      if (!minimalUserInfo?.id) {
        console.error("사용자 정보가 없습니다.");
        return;
      }
      //스크립트를 로드
      await loadScriptsFromServer();
      console.log("✅ 스크립트 초기화 완료, 튜토리얼로 이동");
      router.push("/tutorial");
    } catch (error) {
      console.error("❌ 스크립트 초기화 실패:", error);
      alert(
        "입장 중 오류가 발생했습니다. 문제가 계속될 시 관리자에게 문의 해주세요."
      );
    }
  };

  // 서비스별 녹음 페이지로 이동
  const handleServiceSelect = (serviceName: string) => {
    if (!isTutorialCompleted) {
      alert("먼저 튜토리얼을 complete해주세요.");
      return;
    }

    // 서비스별 녹음 페이지로 이동 (예: /recording/건강)
    router.push(`/recording/${encodeURIComponent(serviceName)}`);
  };

  console.log("minimalUserInfo?", minimalUserInfo);
  if (!minimalUserInfo) {
    // minimalUserInfo 로드되지 않았으면 로딩 스피너 표시
    return (
      <>
        <Head>
          <title>녹음하기</title>
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

  // 전체 진행률 계산
  const serviceNames = Object.keys(SERVICE_CONFIG);
  const totalServices = serviceNames.length;
  const completedServices = serviceNames.filter(
    (name) => getServiceCompletionStatus(name) === "completed"
  ).length;
  const overallProgress = Math.round((completedServices / totalServices) * 100);

  return (
    <>
      <Head>
        <title>녹음하기</title>
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
              {userName ? `안녕하세요, ${userName}님!` : "음성 녹음하기"}
            </h1>

            {/* 전체 진행 상황 */}
            {isTutorialCompleted && (
              <div className={styles.overallProgress}>
                <div className={styles.progressBar}>
                  <div
                    className={styles.progressFill}
                    style={{ width: `${overallProgress}%` }}
                  />
                </div>
                <p className={styles.progressText}>
                  전체 진행률: {overallProgress}% ({completedServices}/
                  {totalServices} 서비스 완료)
                </p>
              </div>
            )}
          </header>

          {/* 선택 카드들 */}
          <main className={styles.cardContainer}>
            {/* 튜토리얼 카드 */}
            <div
              onClick={() => {
                triggerHapticFeedback();
                handleTutorial();
              }}
              className={`${styles.card} ${styles.cardTutorial} ${
                isTutorialCompleted ? styles.cardCompleted : ""
              }`}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => handleKeyDown(e, handleTutorial)}
            >
              <div className={styles.cardIcon}>
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M12,17C11.45,17 11,16.55 11,16C11,15.45 11.45,15 12,15C12.55,15 13,15.45 13,16C13,16.55 12.55,17 12,17M13,13H11V7H13V13Z" />
                </svg>
              </div>

              <h2 className={styles.cardTitle}>
                {isTutorialCompleted ? "✓ 사용법 완료" : "사용법 익히기"}
              </h2>

              <p className={styles.cardDescription}>
                {isTutorialCompleted
                  ? "이제 녹음 작업을 시작할 수 있습니다"
                  : "음성 녹음 방법을 쉽게 알려드립니다"}
              </p>

              <div className={styles.cardAction}>
                <span>{isTutorialCompleted ? "다시 보기" : "시작하기"}</span>
                <span className={styles.arrow}>→</span>
              </div>
            </div>

            {/* 서비스별 카드들 */}
            {Object.entries(SERVICE_CONFIG).map(([serviceName, config]) => {
              const completionStatus = getServiceCompletionStatus(serviceName);
              const progress = getServiceProgress(serviceName);
              const isAccessible = isTutorialCompleted;

              return (
                <div
                  key={serviceName}
                  onClick={() => {
                    triggerHapticFeedback();
                    handleServiceSelect(serviceName);
                  }}
                  className={`${styles.card} ${styles[config.color]} ${
                    completionStatus === "completed"
                      ? styles.cardCompleted
                      : completionStatus === "in-progress"
                      ? styles.cardInProgress
                      : ""
                  } ${!isAccessible ? styles.cardDisabled : ""}`}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) =>
                    handleKeyDown(e, () => handleServiceSelect(serviceName))
                  }
                >
                  <div className={styles.cardIcon}>
                    {!isAccessible ? (
                      <svg viewBox="0 0 24 24">
                        <path d={LOCK_ICON} />
                      </svg>
                    ) : (
                      <svg viewBox="0 0 24 24" fill="currentColor">
                        <path d={config.icon} />
                      </svg>
                    )}
                  </div>

                  <h2 className={styles.cardTitle}>
                    {serviceName}
                    {completionStatus === "completed" && " ✓"}
                  </h2>

                  <p className={styles.cardDescription}>
                    {!isAccessible
                      ? "사용법을 먼저 완료해주세요"
                      : config.description}
                  </p>

                  {/* 진행률 표시 */}
                  {isAccessible && progress > 0 && (
                    <div className={styles.serviceProgress}>
                      <div className={styles.serviceProgressBar}>
                        <div
                          className={styles.serviceProgressFill}
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                      <span className={styles.serviceProgressText}>
                        {progress}%
                      </span>
                    </div>
                  )}

                  <div className={styles.cardAction}>
                    <span>
                      {!isAccessible
                        ? ""
                        : completionStatus === "completed"
                        ? "완료됨"
                        : completionStatus === "in-progress"
                        ? "계속하기"
                        : "시작하기"}
                    </span>
                    {isAccessible && <span className={styles.arrow}>→</span>}
                  </div>
                </div>
              );
            })}
          </main>

          {/* 안내 메시지 */}
          {!isTutorialCompleted && (
            <div className={styles.warningMessage}>
              <p>⚠️ 녹음 작업을 시작하려면 먼저 사용법을 완료해주세요.</p>
            </div>
          )}

          {/* 완료 축하 메시지 */}
          {overallProgress === 100 && (
            <div className={styles.congratulationsMessage}>
              <h3>🎉 모든 녹음을 완료했습니다!</h3>
              <p>수고하셨습니다. 제출 완료를 기다리고 있습니다.</p>
            </div>
          )}

          {/* 디버깅 정보 */}
          {process.env.NODE_ENV === "development" && (
            <div className={styles.debugInfo}>
              <h4>🐛 디버그 정보</h4>
              <p>사용자명: {userName || "로딩 중..."}</p>
              <p>튜토리얼 완료: {isTutorialCompleted ? "✅" : "❌"}</p>
              <p>전체 진행률: {overallProgress}%</p>
              <p>
                완료 서비스: {completedServices}/{totalServices}
              </p>
            </div>
          )}

          {/* 하단 정보 */}
          <footer className={styles.footer}>
            <p className={styles.footerText}>
              총 {totalServices}개 서비스 카테고리
            </p>
          </footer>
        </div>
      </div>
    </>
  );
};

export default MainSelectionPage;
