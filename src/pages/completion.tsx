// pages/fInalStepPage.tsx
import React from "react";
import { useRouter } from "next/router";
import styles from "@/styles/FinalStepPage.module.css";
import { useUserQuery } from "@/hooks/queries/useUserQueries";
import { useLogoutUserMutation } from "@/hooks/mutations/useUserMutations";
import {
  useUserStatusValidation,
  UserAccessStatus,
} from "@/utils/userStatusValidation";

const CompletionPage: React.FC = () => {
  const router = useRouter();
  const logoutMutation = useLogoutUserMutation();
  const { data: user, isLoading, error } = useUserQuery();
  const userStatus = useUserStatusValidation(user);

  // --- 1) 안전한 round 파싱 ---------------------------------------------------
  // router.query.round can be string | string[] | undefined
  const rawRound = router.query.round;
  const roundStr = Array.isArray(rawRound) ? rawRound[0] : rawRound;
  // Only "1" | "2" are valid; default to "1" when missing/invalid
  const roundSafe: "1" | "2" = roundStr === "2" ? "2" : "1";

  // Early guard: wait until router is ready so query params are stable
  if (!router.isReady) {
    return (
      <div className={styles.container}>
        <div className={styles.loadingContainer}>
          <div className={styles.loadingSpinner}></div>
          <p className={styles.loadingText}>페이지를 준비하고 있습니다...</p>
        </div>
      </div>
    );
  }

  // --- 2) 라운드별 설정을 맵으로 관리 ------------------------------------------
  const ROUND_CONFIG = {
    "1": {
      title: "1회차 작업이 완료되었습니다!",
      mainMessage:
        "상단의 [작업 종료하기]를 눌러 작업을 정상적으로 종료해주세요",
      subMessage: "관리자 승인 후 2회차 작업을 시작할 수 있습니다.",
      formUrl: "https://forms.gle/NnSwbsHdFyk1HdsSA",
      buttonLabel: "설문 조사 작성하기",
      sectionTitle: "설문 조사 작성하기",
    },
    "2": {
      title: "2회차 작업이 완료되었습니다!",
      mainMessage:
        "상단의 [작업 종료하기]를 눌러 작업을 정상적으로 종료해주세요.",
      subMessage: "전체 과정이 완료되었습니다. 참여해 주셔서 감사합니다.",
      formUrl: "https://forms.gle/UDa7vQ1SCjWGfBLb6",
      buttonLabel: "최종 설문 작성하기",
      sectionTitle: "최종 설문 조사 작성하기",
    },
  } as const;

  const roundCfg = ROUND_CONFIG[roundSafe];

  // --- 3) 사용자 정보/상태 ------------------------------------------------------

  const isFinishedUser = userStatus.status === UserAccessStatus.ALL_COMPLETED;
  const isWaitingForAdminApproval =
    userStatus.status === UserAccessStatus.WAITING_FOR_APPROVAL;

  // --- 4) 액션 핸들러 -----------------------------------------------------------
  const handleGoToFeedbackForm = () => {
    // (선택) userId/name을 구글폼 prefill로 넘기고 싶다면 아래처럼 붙여도 됩니다.
    // const prefill = user?.id ? `?entry.123456=${encodeURIComponent(user.id)}` : "";
    // window.open(`${roundCfg.formUrl}${prefill}`, "_blank", "noopener,noreferrer");
    window.open(roundCfg.formUrl, "_blank", "noopener,noreferrer");
  };

  const handleGoHome = async () => {
    localStorage.removeItem("pendingAuth");
    await logoutMutation.mutateAsync();
    router.push("/");
  };

  const handleContact = () => {
    window.location.href =
      "mailto:seoul.ai.agent@gmail.com?subject=%EC%84%9C%EB%B9%84%EC%8A%A4%20%EC%9D%B4%EC%9A%A9%20%EB%AC%B8%EC%9D%98";
  };

  // --- 5) 로딩/에러/접근가드 ----------------------------------------------------
  if (isLoading) {
    return (
      <div className={styles.container}>
        <div className={styles.loadingContainer}>
          <div className={styles.loadingSpinner}></div>
          <p className={styles.loadingText}>정보를 불러오는 중입니다...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.container}>
        <div className={styles.errorContainer}>
          <h1 className={styles.errorTitle}>오류가 발생했습니다</h1>
          <p className={styles.errorMessage}>
            사용자 정보를 불러올 수 없습니다. 잠시 후 다시 시도해주세요.
          </p>
          <button
            className={styles.primaryButton}
            onClick={() => window.location.reload()}
          >
            다시 시도
          </button>
        </div>
      </div>
    );
  }

  // 완료 페이지 접근 권한이 없는 경우 리다이렉트
  if (!userStatus.isWaitingApproval && !userStatus.isCompleted && user) {
    if (userStatus.canAccessStart) {
      router.push("/");
      return <div>시작 페이지로 이동 중...</div>;
    }
  }

  // 모든 라운드 종료된 사용자
  if (isFinishedUser) {
    return (
      <div className={styles.container}>
        <div className={styles.contentCard}>
          <div className={styles.iconContainer}>
            <div className={styles.warningIcon}>⚠️</div>
          </div>

          <h1 className={styles.title}>더 이상 작업을 진행할 수 없습니다.</h1>

          <div className={styles.messageContainer}>
            <p className={styles.message}>
              현재 참가자님은 모든 작업이 완료되어 더 이상 참가할 수 없습니다.
            </p>
            <p className={styles.subMessage}>
              문의가 있으실 경우 아래 문의하기 버튼을 눌러주세요.
            </p>
          </div>

          <div className={styles.buttonGroup}>
            <button className={styles.primaryButton} onClick={handleContact}>
              문의하기
            </button>
            <button className={styles.secondaryButton} onClick={handleGoHome}>
              작업 종료하기
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --- 6) 정상 완료 페이지 (대기/승인 대기 상태) ---------------------------------
  if (isWaitingForAdminApproval) {
    return (
      <div className={styles.container}>
        <div className={styles.contentCard}>
          <div className={styles.iconContainer}>
            <div className={styles.successIcon}>✅</div>
          </div>

          <h1 className={styles.title}>{roundCfg.title}</h1>

          <div className={styles.messageContainer}>
            <p className={styles.message}>
              {user?.profile.userName ? `${user.profile.userName}님, ` : ""}
              {roundCfg.mainMessage}
            </p>
            <p>{roundCfg.subMessage}</p>
            <p className={styles.message}>
              작업 중 불편했던 점이나 개선사항이 있으시면 피드백을 남겨주세요.
            </p>
          </div>

          <div className={styles.formSection}>
            <h2 className={styles.sectionTitle}>{roundCfg.sectionTitle}</h2>
            <button
              className={styles.primaryButton}
              onClick={handleGoToFeedbackForm}
            >
              {roundCfg.buttonLabel}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Fallback (이외 상태)
  return (
    <div className={styles.container}>
      <div className={styles.contentCard}>
        <div className={styles.iconContainer}>
          <div className={styles.successIcon}>ℹ️</div>
        </div>

        <h1 className={styles.title}>모든 작업이 완료되었습니다!</h1>

        <div className={styles.messageContainer}>
          <p className={styles.message}>수고하셨습니다.</p>
          <p className={styles.subMessage}>
            관리자에 의해 승인될 때까지 기다려 주세요.
          </p>
        </div>

        <div className={styles.buttonGroup}>
          <button className={styles.secondaryButton} onClick={handleGoHome}>
            작업 종료하기
          </button>
          <button className={styles.primaryButton} onClick={handleContact}>
            문의하기
          </button>
        </div>
      </div>
    </div>
  );
};

export default CompletionPage;
