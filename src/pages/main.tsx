import React, { useEffect, useState } from "react";
import { useRouter } from "next/router";
import styles from "@/styles/MainSelectionPage.module.css";
import Head from "next/head";
import {
  useCurrentSetNumber,
  useMinimalUserQuery,
  useUserQuery,
  useAuthStatusQuery,
  useUserCompletionStatusQuery,
} from "@/hooks/queries/useUserQueries";
import { SERVICE_CONFIG, toSlug, ServiceName } from "@/lib/serviceMapping";

const LOCK_ICON =
  "M12,17A1.5,1.5 0 0,0 13.5,15.5A1.5,1.5 0 0,0 12,14A1.5,1.5 0 0,0 10.5,15.5A1.5,1.5 0 0,0 12,17M17,8H16V6.5C16,4.57 14.43,3 12.5,3A3.5,3.5 0 0,0 9,6.5V8H8A2,2 0 0,0 6,10V20A2,2 0 0,0 8,22H17A2,2 0 0,0 19,20V10A2,2 0 0,0 17,8M11,6.5C11,5.67 11.67,5 12.5,5A1.5,1.5 0 0,1 14,6.5V8H11V6.5Z";

// 서비스 순서 정의
const SERVICE_ORDER = Object.keys(SERVICE_CONFIG) as ServiceName[];

const MainSelectionPage = () => {
  const router = useRouter();
  // 인증 상태 확인
  const { data: authStatus, isLoading: authLoading } = useAuthStatusQuery();
  const { data: userCompletionStatus, isLoading: completionLoading } =
    useUserCompletionStatusQuery();
  // 쿠키 기반 인증 상태 확인
  const { data: minimalUserInfo, isLoading: isUserLoading } =
    useMinimalUserQuery();
  const userName = minimalUserInfo?.userName;

  // 진행 상태 (서버)
  const { data: fullUser, isLoading: isFullUserLoading } = useUserQuery();
  const isTutorialCompleted = fullUser?.currentStatus?.isTutorialCompleted;

  // console.log("fullUser?", fullUser);
  // console.log("🔍 완전한 상태 체크:", {
  //   "1. authStatus": authStatus,
  //   "2. authLoading": authLoading,
  //   "3. userCompletionStatus": userCompletionStatus,
  //   "4. completionLoading": completionLoading,
  //   // "5. 쿠키": document.cookie,
  //   "6. useUserQuery enabled":
  //     !!authStatus?.isAuthenticated && !!authStatus?.userId,
  //   "7. fullUser": fullUser,
  //   "8. fullUserLoading": isFullUserLoading,
  // });
  // const [showContent, setShowContent] = useState(false);

  // 각 서비스별 완료 상태 (situational + formal 태스크 모두 확인)
  const getServiceCompletionStatus = (serviceName: string) => {
    if (!fullUser?.participation?.sets?.[0]) return "not-started";

    const currentSet = fullUser.participation.sets[0];
    const situationalTasks = currentSet.tasks?.situational || [];
    const formalTasks = currentSet.tasks?.formal || [];

    // situational과 formal 태스크를 합친 전체 태스크
    const allTasks = [...situationalTasks, ...formalTasks];

    const serviceTasks = allTasks.filter((task) =>
      task.taskKey.startsWith(serviceName)
    );

    if (serviceTasks.length === 0) return "not-started";

    const completedTasks = serviceTasks.filter(
      (task) => task.status === "completed" || task.status === "approved"
    );

    if (completedTasks.length === serviceTasks.length) return "completed";
    if (completedTasks.length > 0) return "in-progress";
    return "not-started";
  };

  // 서비스별 진행률 계산 (situational + formal 태스크 모두 확인)
  const getServiceProgress = (serviceName: string) => {
    if (!fullUser?.participation?.sets?.[0]) return 0;

    const currentSet = fullUser.participation.sets[0];
    const situationalTasks = currentSet.tasks?.situational || [];
    const formalTasks = currentSet.tasks?.formal || [];

    // situational과 formal 태스크를 합친 전체 태스크
    const allTasks = [...situationalTasks, ...formalTasks];

    const serviceTasks = allTasks.filter((task) =>
      task.taskKey.startsWith(serviceName)
    );

    if (serviceTasks.length === 0) return 0;

    const completedTasks = serviceTasks.filter(
      (task) => task.status === "completed" || task.status === "approved"
    );

    return Math.round((completedTasks.length / serviceTasks.length) * 100);
  };
  // 햅틱 피드백 (모바일)
  const triggerHapticFeedback = () => {
    if ("vibrate" in navigator) {
      navigator.vibrate(50);
    }
  };
  console.log("🔍 메인 페이지 상세 상태:", {
    "authStatus 전체": authStatus,
    "authStatus.isAuthenticated": authStatus?.isAuthenticated,
    "authStatus.userId": authStatus?.userId,
    // "쿠키 직접 확인": document.cookie,
    "useUserQuery enabled 조건":
      !!authStatus?.isAuthenticated && !!authStatus?.userId,
  });
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
      console.log("minimalUserInfo?", minimalUserInfo);
      if (!minimalUserInfo?.id) {
        console.error("사용자 정보가 없습니다.");
        return;
      }
      router.push("/tutorial");
    } catch (error) {
      console.error("❌ 스크립트 초기화 실패:", error);
      alert(
        "입장 중 오류가 발생했습니다. 문제가 계속될 시 관리자에게 문의 해주세요."
      );
    }
  };

  // 서비스별 녹음 페이지로 이동
  const handleServiceSelect = (serviceName: ServiceName) => {
    console.log("여기서 말하는 serviceName?", serviceName);

    if (!isTutorialCompleted) {
      alert("먼저 사용법 익히기를 완료해주세요.");
      return;
    }

    if (!isServiceUnlocked(serviceName)) {
      const serviceIndex = SERVICE_ORDER.indexOf(serviceName);
      const previousService = SERVICE_ORDER[serviceIndex - 1];
      alert(`'${previousService}' 주제의 녹음을 먼저 완료해주세요.`);
      return;
    }

    // 서비스별 녹음 페이지로 이동
    const slug = toSlug(serviceName);
    router.push(`/recording/${slug}`);
  };

  // 서비스 해금 상태 확인 함수
  const isServiceUnlocked = (serviceName: ServiceName): boolean => {
    // 튜토리얼이 완료되지 않으면 모든 서비스 잠금
    if (!isTutorialCompleted) {
      return false;
    }

    const serviceIndex = SERVICE_ORDER.indexOf(serviceName);
    if (serviceIndex === -1) return false;

    // 첫 번째 서비스(건강)는 항상 해금
    if (serviceIndex === 0) {
      return true;
    }

    // 이전 서비스가 완료되었는지 확인
    const previousService = SERVICE_ORDER[serviceIndex - 1];
    const previousStatus = getServiceCompletionStatus(previousService);

    return previousStatus === "completed";
  };

  // 해금된 서비스 개수 계산 함수
  const getUnlockedServicesCount = (): number => {
    if (!isTutorialCompleted) return 0;

    let unlockedCount = 0;
    for (const serviceName of SERVICE_ORDER) {
      if (isServiceUnlocked(serviceName)) {
        unlockedCount++;
      } else {
        break; // 잠긴 서비스를 만나면 중단
      }
    }
    return unlockedCount;
  };

  // 다음 해금될 서비스 확인 함수
  const getNextUnlockService = (): string | null => {
    if (!isTutorialCompleted) return SERVICE_ORDER[0]; // 건강

    for (const serviceName of SERVICE_ORDER) {
      if (!isServiceUnlocked(serviceName)) {
        return serviceName;
      }
    }
    return null; // 모든 서비스 해금됨
  };

  console.log("인증 정보 로딩 중?", authStatus, completionLoading);
  // 사용자 인증 정보 로딩 중
  if (!authStatus?.isAuthenticated || completionLoading) {
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
  // fullUser 로딩 중일 때 처리 (하지만 튜토리얼은 접근 가능하게)
  if (isFullUserLoading) {
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
            </header>

            {/* 튜토리얼 카드만 표시 */}
            <main className={styles.cardContainer}>
              <div
                onClick={() => {
                  triggerHapticFeedback();
                  handleTutorial();
                }}
                className={`${styles.card} ${styles.cardTutorial}`}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => handleKeyDown(e, handleTutorial)}
              >
                <div className={styles.cardIcon}>
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M12,17C11.45,17 11,16.55 11,16C11,15.45 11.45,15 12,15C12.55,15 13,15.45 13,16C13,16.55 12.55,17 12,17M13,13H11V7H13V13Z" />
                  </svg>
                </div>

                <h2 className={styles.cardTitle}>사용법 익히기</h2>

                <p className={styles.cardDescription}>
                  음성 녹음 방법을 쉽게 알려드립니다
                </p>

                <div className={styles.cardAction}>
                  <span>시작하기</span>
                  <span className={styles.arrow}>→</span>
                </div>
              </div>

              {/* 로딩 중 메시지 */}
              <div className={styles.loadingContainer}>
                <div className={styles.loadingSpinner}></div>
                <p>사용자 정보를 불러오는 중...</p>
              </div>
            </main>

            {/* 안내 메시지 */}
            <div className={styles.warningMessage}>
              <p>
                💡 먼저 사용법 익히기를 시작해주세요. 완료 후 녹음 작업이
                할당됩니다.
              </p>
            </div>
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
  const unlockedServices = getUnlockedServicesCount();
  const overallProgress =
    fullUser?.currentStatus?.progress?.completedPercentage || 0;

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
                  전체 진행률: {totalServices}개 중 {completedServices}개 완료(
                  {overallProgress}% )
                </p>
                <p className={styles.unlockText}>
                  녹음 가능한 주제: {unlockedServices}/{totalServices}
                  {getNextUnlockService() && (
                    <>
                      <br />
                      <span className={styles.nextUnlock}>
                        다음 주제: {getNextUnlockService()}
                      </span>
                    </>
                  )}
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
            {SERVICE_ORDER.map((serviceName) => {
              const config = SERVICE_CONFIG[serviceName];
              if (!config) return null;

              const completionStatus = getServiceCompletionStatus(serviceName);
              const progress = getServiceProgress(serviceName);
              const isUnlocked = isServiceUnlocked(serviceName);

              return (
                <div
                  key={serviceName}
                  onClick={() => {
                    triggerHapticFeedback();
                    handleServiceSelect(serviceName);
                  }}
                  className={`${styles.card} ${
                    completionStatus === "completed"
                      ? styles.cardCompleted
                      : completionStatus === "in-progress"
                      ? styles.cardInProgress
                      : ""
                  } ${!isUnlocked ? styles.cardLocked : ""}`}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) =>
                    handleKeyDown(e, () => handleServiceSelect(serviceName))
                  }
                >
                  <div className={`${styles.cardIcon}`}>
                    {!isUnlocked ? (
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
                    {!isUnlocked
                      ? `이전 주제 녹음 완료 후 시작할 수 있습니다`
                      : config.description}
                  </p>

                  {/* 진행률 표시 */}
                  {isUnlocked && progress > 0 && (
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
                      {!isUnlocked
                        ? "잠김"
                        : completionStatus === "completed"
                        ? "완료됨"
                        : completionStatus === "in-progress"
                        ? "계속하기"
                        : "시작하기"}
                    </span>
                    {isUnlocked && <span className={styles.arrow}>→</span>}
                  </div>
                </div>
              );
            })}
          </main>

          {/* 안내 메시지 */}
          {!isTutorialCompleted && (
            <div className={styles.warningMessage}>
              <p>
                💡 먼저 사용법 익히기를 완료해주세요. 완료 후 녹음 작업이
                할당됩니다.
              </p>
            </div>
          )}

          {/* 완료 축하 메시지 */}
          {overallProgress === 100 && (
            <div className={styles.congratulationsMessage}>
              <h3>모든 녹음을 완료했습니다!</h3>
              <p>수고하셨습니다.</p>

              <button className={styles.finishAllTasks}>
                <span>모든 작업 완료</span>
              </button>
            </div>
          )}

          {/* 디버깅 정보 */}
          {process.env.NODE_ENV === "development" && (
            <div className={styles.debugInfo}>
              <h4>🐛 디버그 정보</h4>
              <p>인증상태: {authStatus?.isAuthenticated ? "✅" : "❌"}</p>
              <p>인증로딩: {authLoading ? "🔄" : "✅"}</p>
              <p>authStatus 전체: {JSON.stringify(authStatus)}</p>{" "}
              {/* 🔧 추가 */}
              <p>완료상태: {userCompletionStatus ? "✅" : "❌"}</p>
              <p>완료로딩: {completionLoading ? "🔄" : "✅"}</p>
              <p>사용자명: {userName || "로딩 중..."}</p>
              <p>fullUser 존재: {fullUser ? "✅" : "❌"}</p>
              <p>fullUser 로딩: {isFullUserLoading ? "🔄" : "✅"}</p>
              <p>사용자명: {userName || "로딩 중..."}</p>
              <p>튜토리얼 완료: {isTutorialCompleted ? "✅" : "❌"}</p>
              <p>전체 진행률: {overallProgress}%</p>
              <p>
                해금된 서비스: {unlockedServices}/{totalServices}
              </p>
              <p>
                다음 해금 서비스: {getNextUnlockService() || "모든 주제 해금됨"}
              </p>
              <p>현재 세트: {fullUser?.participation?.currentSetNumber || 0}</p>
              <p>
                할당된 세트 수: {fullUser?.participation?.sets?.length || 0}
              </p>
              {/* 각 서비스별 상태 표시 */}
              <div style={{ marginTop: "8px", fontSize: "12px" }}>
                {SERVICE_ORDER.map((service, index) => (
                  <div key={service}>
                    {index + 1}. {service}:{" "}
                    {isServiceUnlocked(service)
                      ? `🔓 ${getServiceCompletionStatus(service)}`
                      : "🔒 잠김"}
                  </div>
                ))}
              </div>
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
