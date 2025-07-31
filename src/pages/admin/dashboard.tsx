// pages/admin/dashboard.tsx
import { useState } from "react";
import { useRouter } from "next/router";
import {
  useAdminDashboard,
  useAdminAuth,
  calculateConversionRates,
  getParticipationStageColor,
} from "@/hooks/queries/useAdminQueries";
import styles from "@/styles/AdminDashboard.module.css";
import AdminRecordingsTab from "@/components/admin/RecordingTaps";
import { formatFirestoreTimestampKST } from "@/utils/time";
import ApplicantsTab from "@/components/admin/ApplicantsTabs";
// 로그아웃 버튼 컴포넌트
export const AdminLogoutButton = () => {
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logoutAdmin", {
        method: "POST",
        credentials: "include",
      });

      // 로그인 페이지로 이동
      router.push("/admin/login");
    } catch (error) {
      console.error("로그아웃 실패:", error);
      // 실패해도 로그인 페이지로 이동
      router.push("/admin/login");
    }
  };

  return (
    <button
      onClick={handleLogout}
      style={{
        padding: "8px 16px",
        backgroundColor: "#dc2626",
        color: "white",
        border: "none",
        borderRadius: "4px",
        cursor: "pointer",
        fontSize: "14px",
      }}
    >
      로그아웃
    </button>
  );
};

const AdminDashboard = () => {
  const { data: authData, isLoading: authLoading } = useAdminAuth();
  const { adminName } = authData;
  const { participants, progress, isLoading, hasError, isReady } =
    useAdminDashboard();
  const [activeTab, setActiveTab] = useState<
    | "overview"
    | "applicants"
    | "participants"
    | "recordings"
    | "upload"
    | "test-task-manager"
  >("overview");
  const router = useRouter();

  // 인증 체크
  if (authLoading) {
    return <div className={styles.loading}>인증 확인 중...</div>;
  }

  if (isLoading) {
    return <div className={styles.loading}>데이터 로딩 중...</div>;
  }

  if (hasError) {
    return <div className={styles.error}>데이터 로딩에 실패했습니다.</div>;
  }

  return (
    <>
      <div className={styles.container}>
        {/* 헤더 */}
        <header className={styles.header}>
          <h1 className={styles.title}>관리자 대시보드</h1>
          <div className={styles.adminInfo}>
            <span>관리자: {adminName}</span>
            <AdminLogoutButton />
          </div>
        </header>

        {/* 탭 네비게이션 */}
        <nav className={styles.tabNav}>
          <button
            className={`${styles.tabButton} ${
              activeTab === "overview" ? styles.active : ""
            }`}
            onClick={() => setActiveTab("overview")}
          >
            전체 현황
          </button>
          <button
            className={`${styles.tabButton} ${
              activeTab === "applicants" ? styles.active : ""
            }`}
            onClick={() => setActiveTab("applicants")}
          >
            참가 신청자
          </button>
          <button
            className={`${styles.tabButton} ${
              activeTab === "participants" ? styles.active : ""
            }`}
            onClick={() => setActiveTab("participants")}
          >
            작업 수행자
          </button>
          <button
            className={`${styles.tabButton} ${
              activeTab === "recordings" ? styles.active : ""
            }`}
            onClick={() => setActiveTab("recordings")}
          >
            녹음 데이터
          </button>
          <button
            className={`${styles.tabButton} ${
              activeTab === "upload" ? styles.active : ""
            }`}
            onClick={() => router.push("upload")}
          >
            사용자 업로드
          </button>
          <button
            className={`${styles.tabButton} ${
              activeTab === "test-task-manager" ? styles.active : ""
            }`}
            onClick={() => router.push("manage-tasks")}
          >
            [테스트]진도 설정
          </button>
        </nav>

        {/* 컨텐츠 영역 */}
        <main className={styles.content}>
          {activeTab === "overview" && (
            <OverviewTab
              participantsData={participants.data}
              progressData={progress.data}
            />
          )}
          {activeTab === "applicants" && <ApplicantsTab />}
          {activeTab === "participants" && (
            <ParticipantsTab participantsData={participants.data} />
          )}
          {activeTab === "recordings" && <AdminRecordingsTab />}
        </main>
      </div>
    </>
  );
};

// 전체 현황 탭 - 3단계 통계 반영
const OverviewTab = ({
  participantsData,
  progressData,
}: {
  participantsData: any;
  progressData: any;
}) => {
  if (!participantsData || !progressData) return <div>데이터 없음</div>;

  const statistics = participantsData.statistics;
  const conversionRates = calculateConversionRates(statistics);

  return (
    <div className={styles.overviewGrid}>
      {/* 3단계 통계 카드들 */}
      <div className={styles.statsGrid}>
        <div
          className={styles.statCard}
          style={{
            borderLeft: `4px solid ${getParticipationStageColor("applicant")}`,
          }}
        >
          <h3>참가 신청자</h3>
          <div className={styles.statNumber}>
            {statistics.totalApplicants.toLocaleString()}
          </div>
          <div className={styles.statDescription}>화이트리스트 등록</div>
        </div>

        <div
          className={styles.statCard}
          style={{
            borderLeft: `4px solid ${getParticipationStageColor("registered")}`,
          }}
        >
          <h3>가입 완료자</h3>
          <div className={styles.statNumber}>
            {statistics.totalRegisteredUsers.toLocaleString()}
          </div>
          <div className={styles.statDescription}>
            사이트 가입 완료 ({conversionRates.applicantToRegistered}%)
          </div>
        </div>

        <div
          className={styles.statCard}
          style={{
            borderLeft: `4px solid ${getParticipationStageColor("active")}`,
          }}
        >
          <h3>작업 참여자</h3>
          <div className={styles.statNumber}>
            {statistics.activeParticipants.toLocaleString()}
          </div>
          <div className={styles.statDescription}>
            실제 작업 시작 ({conversionRates.registeredToActive}%)
          </div>
        </div>

        <div
          className={styles.statCard}
          style={{ borderLeft: "4px solid #10b981" }}
        >
          <h3>작업 완료자</h3>
          <div className={styles.statNumber}>
            {statistics.completedParticipants.toLocaleString()}
          </div>
          <div className={styles.statDescription}>전체 작업 완료</div>
        </div>
      </div>

      {/* 전환율 시각화 */}
      <div className={styles.section}>
        <h3>참여 단계별 전환율</h3>
        <div className={styles.conversionFlow}>
          <div className={styles.conversionStage}>
            <div
              className={styles.stageBox}
              style={{
                backgroundColor: getParticipationStageColor("applicant"),
              }}
            >
              <div className={styles.stageNumber}>
                {statistics.totalApplicants}
              </div>
              <div className={styles.stageLabel}>신청자</div>
            </div>
          </div>

          <div className={styles.conversionArrow}>
            <span>{conversionRates.applicantToRegistered}%</span>→
          </div>

          <div className={styles.conversionStage}>
            <div
              className={styles.stageBox}
              style={{
                backgroundColor: getParticipationStageColor("registered"),
              }}
            >
              <div className={styles.stageNumber}>
                {statistics.totalRegisteredUsers}
              </div>
              <div className={styles.stageLabel}>가입자</div>
            </div>
          </div>

          <div className={styles.conversionArrow}>
            <span>{conversionRates.registeredToActive}%</span>→
          </div>

          <div className={styles.conversionStage}>
            <div
              className={styles.stageBox}
              style={{ backgroundColor: getParticipationStageColor("active") }}
            >
              <div className={styles.stageNumber}>
                {statistics.activeParticipants}
              </div>
              <div className={styles.stageLabel}>활동자</div>
            </div>
          </div>
        </div>
      </div>

      {/* 진행률 분포 (기존 로직 유지) */}
      {progressData && (
        <div className={styles.section}>
          <h3>진행률 분포</h3>
          <div className={styles.progressBars}>
            <div className={styles.progressItem}>
              <span>시작 안함</span>
              <div className={styles.progressBar}>
                <div
                  className={styles.progressFill}
                  style={{
                    width: `${
                      (progressData.progressDistribution.notStarted /
                        progressData.totalParticipants) *
                      100
                    }%`,
                    backgroundColor: "#6b7280",
                  }}
                />
              </div>
              <span>{progressData.progressDistribution.notStarted}명</span>
            </div>
            <div className={styles.progressItem}>
              <span>진행 중</span>
              <div className={styles.progressBar}>
                <div
                  className={styles.progressFill}
                  style={{
                    width: `${
                      ((progressData.progressDistribution.inProgress["1-25"] +
                        progressData.progressDistribution.inProgress["26-50"] +
                        progressData.progressDistribution.inProgress["51-75"] +
                        progressData.progressDistribution.inProgress["76-99"]) /
                        progressData.totalParticipants) *
                      100
                    }%`,
                    backgroundColor: "#3b82f6",
                  }}
                />
              </div>
              <span>
                {progressData.progressDistribution.inProgress["1-25"] +
                  progressData.progressDistribution.inProgress["26-50"] +
                  progressData.progressDistribution.inProgress["51-75"] +
                  progressData.progressDistribution.inProgress["76-99"]}
                명
              </span>
            </div>
            <div className={styles.progressItem}>
              <span>완료</span>
              <div className={styles.progressBar}>
                <div
                  className={styles.progressFill}
                  style={{
                    width: `${
                      (progressData.progressDistribution.completed /
                        progressData.totalParticipants) *
                      100
                    }%`,
                    backgroundColor: "#10b981",
                  }}
                />
              </div>
              <span>{progressData.progressDistribution.completed}명</span>
            </div>
          </div>
        </div>
      )}

      {/* 최근 활동 */}
      <div className={styles.section}>
        <h3>최근 활동</h3>
        <div className={styles.activityGrid}>
          <div className={styles.activityItem}>
            <span>7일 내 활동</span>
            <strong>{statistics.activeInLast7Days}명</strong>
          </div>
          <div className={styles.activityItem}>
            <span>작업 시작</span>
            <strong>{statistics.startedParticipants}명</strong>
          </div>
          <div className={styles.activityItem}>
            <span>전체 전환율</span>
            <strong>{conversionRates.applicantToActive}%</strong>
          </div>
        </div>
      </div>
    </div>
  );
};

// 참여자 관리 탭 (기존 로직 유지)
const ParticipantsTab = ({ participantsData }: { participantsData: any }) => {
  if (!participantsData) return <div>데이터 없음</div>;

  const getStatusBadge = (status: string) => {
    const statusClass =
      {
        not_started: styles.statusGray,
        in_progress: styles.statusBlue,
        completed: styles.statusGreen,
        inactive: styles.statusRed,
      }[status] || styles.statusGray;

    const statusText =
      {
        not_started: "시작 안함",
        in_progress: "진행 중",
        completed: "완료",
        inactive: "비활성",
      }[status] || status;

    return (
      <span className={`${styles.statusBadge} ${statusClass}`}>
        {statusText}
      </span>
    );
  };

  return (
    <div className={styles.tableContainer}>
      <div className={styles.tableHeader}>
        <h3>
          작업 수행자 목록 (총{" "}
          {participantsData.statistics.totalRegisteredUsers}명 중{" "}
          {participantsData.participants.length}명 표시)
        </h3>
        <div className={styles.quickStats}>
          <span>
            활동자: {participantsData.statistics.activeParticipants}명
          </span>
          <span>
            완료자: {participantsData.statistics.completedParticipants}명
          </span>
        </div>
      </div>

      <div className={styles.table}>
        <div className={styles.tableHead}>
          <div className={styles.tableRow}>
            <div className={styles.tableCell}>이름</div>
            <div className={styles.tableCell}>성별</div>
            <div className={styles.tableCell}>연령대</div>
            <div className={styles.tableCell}>진행률</div>
            <div className={styles.tableCell}>녹음 수</div>
            <div className={styles.tableCell}>상태</div>
            <div className={styles.tableCell}>마지막 접속</div>
          </div>
        </div>

        <div className={styles.tableBody}>
          {participantsData.participants.map((participant: any) => (
            <div key={participant.userId} className={styles.tableRow}>
              <div className={styles.tableCell}>
                {participant.userName || "미설정"}
                <button
                  className={styles.copyButton}
                  onClick={() =>
                    navigator.clipboard.writeText(participant.userId)
                  }
                  title="ID 복사"
                >
                  📋
                </button>
              </div>
              <div className={styles.tableCell}>{participant.gender}</div>
              <div className={styles.tableCell}>{participant.ageGroup}</div>
              <div className={styles.tableCell}>
                <div className={styles.progressContainer}>
                  <div className={styles.progressBar}>
                    <div
                      className={styles.progressFill}
                      style={{
                        width: `${participant.overallProgress}%`,
                        backgroundColor:
                          participant.overallProgress === 100
                            ? "#10b981"
                            : "#3b82f6",
                      }}
                    />
                  </div>
                  <span className={styles.progressText}>
                    {participant.overallProgress}%
                  </span>
                </div>
              </div>
              <div className={styles.tableCell}>
                {participant.totalRecordings}
              </div>
              <div className={styles.tableCell}>
                {getStatusBadge(participant.status)}
              </div>
              <div className={styles.tableCell}>
                {participant.lastAccessAt
                  ? formatFirestoreTimestampKST(participant.lastAccessAt)
                  : "정보 없음"}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
