// pages/fInalStepPage.tsx
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
  const { round } = router.query; // URL에서 round 파라미터 추출

  // 라운드별 메시지 설정
  const getRoundMessage = () => {
    if (round === "1") {
      return {
        title: "1회차 작업이 완료되었습니다!",
        mainMessage:
          "상단의 [작업 종료하기]를 눌러 작업을 정상적으로 종료해주세요",
        subMessage: "관리자 승인 후 2회차 작업을 시작할 수 있습니다.",
      };
    } else if (round === "2") {
      return {
        title: "2회차 작업이 완료되었습니다!",
        mainMessage:
          "상단의 [작업 종료하기]를 눌러 작업을 정상적으로 종료해주세요.",
        subMessage: "전체 과정이 완료되었습니다. 참여해 주셔서 감사합니다.",
      };
    } else {
      return {
        title: "모든 작업이 완료되었습니다!",
        mainMessage: "수고하셨습니다.",
        subMessage: "관리자에 의해 승인될 때까지 기다려 주세요.",
      };
    }
  };

  const roundMessage = getRoundMessage();

  const logoutMutation = useLogoutUserMutation();
  // React Query를 사용하여 사용자 정보 가져오기
  const { data: user, isLoading, error } = useUserQuery();
  // 유틸 함수로 사용자 상태 분석
  const userStatus = useUserStatusValidation(user);
  const isFinishedUser = userStatus.status === UserAccessStatus.ALL_COMPLETED;
  const isWaitingForAdminApproval =
    userStatus.status === UserAccessStatus.WAITING_FOR_APPROVAL;

  // 구글 폼 URL (실제 URL로 변경 필요)
  const googleFormUrlForRound1 = "https://forms.gle/FHkLvP67rapjfFAu5";
  const googleFormUrlForRound2 = "https://forms.gle/FHkLvP67rapjfFAu5";

  // 구글 폼으로 이동
  const handleGoToFeedbackForm = () => {
    window.open(
      round === "2" ? googleFormUrlForRound2 : googleFormUrlForRound1,
      "_blank",
      "noopener,noreferrer"
    );
  };

  // 홈으로 돌아가기
  const handleGoHome = async () => {
    localStorage.removeItem("pendingAuth");
    await logoutMutation.mutateAsync();
    router.push("/");
  };

  // 문의하기 (이메일 또는 전화)
  const handleContact = () => {
    // 실제 연락처로 변경 필요
    window.location.href =
      "mailto:seoul.ai.agent@gamil.com?subject=서비스 이용 문의";
  };

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
    // 진행 중이거나 새 사용자인 경우 시작 페이지로
    if (userStatus.canAccessStart) {
      router.push("/"); // 또는 시작 페이지 경로
      return <div>시작 페이지로 이동 중...</div>;
    }
  }

  // 사용자가 참여 가능한 모든 라운드에서의 모든 작업이 끝난 상태인 경우
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
  if (isWaitingForAdminApproval) {
    // 정상적인 1라운드 완료 페이지
    return (
      <div className={styles.container}>
        <div className={styles.contentCard}>
          <div className={styles.iconContainer}>
            <div className={styles.successIcon}>✅</div>
          </div>

          <h1 className={styles.title}>{roundMessage.title}</h1>

          <div className={styles.messageContainer}>
            <p className={styles.message}>
              {user?.profile.userName ? `${user.profile.userName}님, ` : ""}
              {roundMessage.mainMessage}
            </p>
            <p>{roundMessage.subMessage}</p>
            <p className={styles.message}>
              작업 중 불편했던 점이나 개선사항이 있으시면 피드백을 남겨주세요.
            </p>
          </div>
          {/* 음성 녹음 컴포넌트 자리 (사용자가 따로 추가할 예정) */}
          {/* <div className={styles.feedbackSection}>
            <h2 className={styles.sectionTitle}>음성 피드백 남기기</h2>
            <p className={styles.sectionDescription}>
              버튼을 눌러 음성으로 의견을 말씀해주세요.
            </p>


            <div className={styles.voiceRecorderPlaceholder}>
              <SimpleVoiceRecorder />
            </div>
          </div> */}

          <div className={styles.formSection}>
            <h2 className={styles.sectionTitle}>
              {round === "2" ? "최종 설문 조사 작성하기" : "설문 조사 작성하기"}
            </h2>

            <button
              className={styles.primaryButton}
              onClick={handleGoToFeedbackForm}
            >
              {round === "2" ? "최종 설문 작성하기" : "구글 폼 열기"}
            </button>
          </div>
        </div>
      </div>
    );
  }
};

export default CompletionPage;
