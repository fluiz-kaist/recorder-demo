// pages/admin/dashboard.tsx
import { useState } from "react";
import { useRouter } from "next/router";
import {
  useAdminDashboard,
  useAdminAuth,
} from "@/hooks/queries/useAdminQueries";
import styles from "@/styles/AdminDashboard.module.css";
import AdminRecordingsTab from "@/components/admin/RecordingTaps";
import { formatFirestoreTimestampKST } from "@/utils/time";
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
    "overview" | "participants" | "recordings" | "upload"
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
          <div className={styles.adminInfo}>관리자: {adminName}</div>
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
              activeTab === "participants" ? styles.active : ""
            }`}
            onClick={() => setActiveTab("participants")}
          >
            참여자 관리
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
        </nav>

        {/* 컨텐츠 영역 */}
        <main className={styles.content}>
          {activeTab === "overview" && (
            <OverviewTab progressData={progress.data} />
          )}
          {activeTab === "participants" && (
            <ParticipantsTab participantsData={participants.data} />
          )}
          {activeTab === "recordings" && <AdminRecordingsTab />}
        </main>
      </div>
    </>
  );
};

// 전체 현황 탭
const OverviewTab = ({ progressData }: { progressData: any }) => {
  if (!progressData) return <div>데이터 없음</div>;

  return (
    <div className={styles.overviewGrid}>
      {/* 통계 카드들 */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <h3>전체 참여자</h3>
          <div className={styles.statNumber}>
            {progressData.totalParticipants}
          </div>
        </div>
        <div className={styles.statCard}>
          <h3>등록 완료</h3>
          <div className={styles.statNumber}>
            {progressData.registeredParticipants}
          </div>
        </div>
        <div className={styles.statCard}>
          <h3>녹음 시작</h3>
          <div className={styles.statNumber}>
            {progressData.activeParticipants}
          </div>
        </div>
        <div className={styles.statCard}>
          <h3>완료자</h3>
          <div className={styles.statNumber}>
            {progressData.completedParticipants}
          </div>
        </div>
      </div>

      {/* 진행률 분포 */}
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

      {/* 최근 활동 */}
      <div className={styles.section}>
        <h3>최근 활동</h3>
        <div className={styles.activityGrid}>
          <div className={styles.activityItem}>
            <span>24시간</span>
            <strong>{progressData.recentActivity.last24Hours}명</strong>
          </div>
          <div className={styles.activityItem}>
            <span>7일</span>
            <strong>{progressData.recentActivity.last7Days}명</strong>
          </div>
          <div className={styles.activityItem}>
            <span>30일</span>
            <strong>{progressData.recentActivity.last30Days}명</strong>
          </div>
        </div>
      </div>
    </div>
  );
};

// 참여자 관리 탭
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
        <h3>참여자 목록 (최근 {participantsData.participants.length}명)</h3>
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
