// pages/admin/ParticipantsTap.tsx

import styles from "@/styles/AdminDashboard.module.css";
import { formatFirestoreTimestampKST } from "@/utils/time";

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
      <p>녹음 작업을 수행하고 있는 수행자 정보 확인 탭</p>
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

export default ParticipantsTab;
