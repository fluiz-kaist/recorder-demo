// components/admin/ParticipantsTab.tsx 또는 dashboard.tsx의 ParticipantsTab 부분
import { useState, useMemo } from "react";
import { formatFirestoreTimestampKST } from "@/utils/time";
import styles from "@/styles/AdminDashboard.module.css";
import { User } from "@/types/user";
import { ParticipantDetail } from "@/pages/api/admin/participants/[userId]";
import { ParticipantOverview } from "@/pages/api/admin/participants/overview";

// 정렬 타입 정의
type SortField =
  | "lastAccessAt"
  | "createdAt"
  | "userName"
  | "overallProgress"
  | "totalRecordings"
  | "status";
type SortOrder = "asc" | "desc";

interface SortConfig {
  field: SortField;
  order: SortOrder;
}
type StatusKey = "completed" | "in_progress" | "not_started" | "inactive";
// 참여자 정렬 함수
const sortParticipants = (participants: any[], sortConfig: SortConfig) => {
  return [...participants].sort((a, b) => {
    let comparison = 0;

    switch (sortConfig.field) {
      case "lastAccessAt":
        const lastAccessA = new Date(a.lastAccessAt).getTime();
        const lastAccessB = new Date(b.lastAccessAt).getTime();
        comparison = lastAccessA - lastAccessB;
        break;

      case "createdAt":
        const createdA = new Date(a.createdAt).getTime();
        const createdB = new Date(b.createdAt).getTime();
        comparison = createdA - createdB;
        break;

      case "userName":
        const nameA = a.userName || "";
        const nameB = b.userName || "";
        comparison = nameA.localeCompare(nameB, "ko-KR");
        break;

      case "overallProgress":
        comparison = a.overallProgress - b.overallProgress;
        break;

      case "totalRecordings":
        comparison = a.totalRecordings - b.totalRecordings;
        break;

      case "status":
        const statusPriority = {
          completed: 4,
          in_progress: 3,
          not_started: 2,
          inactive: 1,
        };

        const aStatus = a.status as StatusKey;
        const bStatus = b.status as StatusKey;
        comparison = statusPriority[aStatus] - statusPriority[bStatus];
        break;

      default:
        const defaultLastAccessA = new Date(a.lastAccessAt).getTime();
        const defaultLastAccessB = new Date(b.lastAccessAt).getTime();
        comparison = defaultLastAccessA - defaultLastAccessB;
        break;
    }

    return sortConfig.order === "desc" ? -comparison : comparison;
  });
};

// 참여자 관리 탭 (정렬 기능 추가)
const ParticipantsTab = ({ participantsData }: { participantsData: any }) => {
  // 정렬 상태 관리
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    field: "lastAccessAt", // 기본값: 최근 접속 시간
    order: "desc", // 기본값: 내림차순 (최신순)
  });

  console.log("participantsData?", participantsData);

  // 정렬된 참여자 목록 (메모이제이션으로 성능 최적화)
  // useMemo를 조건부 렌더링 로직보다 먼저 호출
  const sortedParticipants = useMemo(() => {
    return sortParticipants(participantsData.participants, sortConfig);
  }, [participantsData.participants, sortConfig]);

  // 정렬 버튼 클릭 핸들러
  const handleSort = (field: SortField) => {
    setSortConfig((prev) => ({
      field,
      // 같은 필드를 다시 클릭하면 순서 토글, 다른 필드면 desc로 시작
      order: prev.field === field && prev.order === "desc" ? "asc" : "desc",
    }));
  };
  // 조건부 랜더링 로직
  if (!participantsData) return <div>데이터 없음</div>;

  // 현재 정렬 상태 표시용 아이콘
  const getSortIcon = (field: SortField) => {
    if (sortConfig.field !== field) return "↕️"; // 정렬 안됨
    return sortConfig.order === "desc" ? "↓" : "↑";
  };

  // 현재 정렬 필드인지 확인
  const isActiveSort = (field: SortField) => sortConfig.field === field;

  const handleShowDetail = (participant: ParticipantOverview) => {
    console.log("여기 participant?", participant);
    const popup = window.open(
      `/participant-detail/${participant.userId}`,
      `participant-${participant.userId}`,
      "width=800,height=700,scrollbars=yes,resizable=yes"
    );

    if (popup) {
      const sendData = () => {
        popup.postMessage(
          {
            type: "RECORDING_DATA",
            participant: participant, //overview데이터를 새 팝업 창에 전달
          },
          window.location.origin
        );
      };

      //  단순하게 여러 번 전송

      setTimeout(sendData, 1500); // 1.5초 후
    }
  };

  const getStatusBadge = (participantData: ParticipantOverview) => {
    const { currentSetNumber, status } = participantData;
    const statusClass =
      {
        not_started: styles.statusGray,
        in_progress: styles.statusBlue,
        completed: styles.statusGreen,
        inactive: styles.statusRed,
      }[status] || styles.statusGray;

    let statusText =
      {
        not_started: "시작 안함",
        in_progress: "진행 중",
        completed: "완료",
        inactive: "비활성",
      }[status] || status;

    statusText = `${currentSetNumber}회차 ${statusText}`;

    return (
      <span className={`${styles.statusBadge} ${statusClass}`}>
        {statusText}
      </span>
    );
  };

  return (
    <div className={styles.tableContainer}>
      <p>녹음 작업을 수행하고 있는 수행자 정보 확인 탭</p>

      {/* 정렬 버튼들 */}
      <div className={styles.sortButtons}>
        <button
          className={`${styles.sortButton} ${
            isActiveSort("lastAccessAt") ? styles.activeSortButton : ""
          }`}
          onClick={() => handleSort("lastAccessAt")}
        >
          최근 활동순 정렬 {getSortIcon("lastAccessAt")}
        </button>
        <button
          className={`${styles.sortButton} ${
            isActiveSort("createdAt") ? styles.activeSortButton : ""
          }`}
          onClick={() => handleSort("createdAt")}
        >
          계정 생성일 정렬 {getSortIcon("createdAt")}
        </button>
        <button
          className={`${styles.sortButton} ${
            isActiveSort("overallProgress") ? styles.activeSortButton : ""
          }`}
          onClick={() => handleSort("overallProgress")}
        >
          진행률순 {getSortIcon("overallProgress")}
        </button>
        <button
          className={`${styles.sortButton} ${
            isActiveSort("totalRecordings") ? styles.activeSortButton : ""
          }`}
          onClick={() => handleSort("totalRecordings")}
        >
          녹음수순 {getSortIcon("totalRecordings")}
        </button>
        <button
          className={`${styles.sortButton} ${
            isActiveSort("status") ? styles.activeSortButton : ""
          }`}
          onClick={() => handleSort("status")}
        >
          상태순 {getSortIcon("status")}
        </button>
      </div>

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
            <div
              className={`${styles.tableCell} ${styles.sortableHeader}`}
              onClick={() => handleSort("userName")}
            >
              이름 {getSortIcon("userName")}
            </div>
            <div className={styles.tableCell}>성별</div>
            <div className={styles.tableCell}>연령대</div>
            <div
              className={`${styles.tableCell} ${styles.sortableHeader}`}
              onClick={() => handleSort("overallProgress")}
            >
              진행률 {getSortIcon("overallProgress")}
            </div>
            <div
              className={`${styles.tableCell} ${styles.sortableHeader}`}
              onClick={() => handleSort("totalRecordings")}
            >
              녹음 수 {getSortIcon("totalRecordings")}
            </div>
            <div
              className={`${styles.tableCell} ${styles.sortableHeader}`}
              onClick={() => handleSort("status")}
            >
              상태 {getSortIcon("status")}
            </div>
            <div
              className={`${styles.tableCell} ${styles.sortableHeader}`}
              onClick={() => handleSort("lastAccessAt")}
            >
              마지막 접속 {getSortIcon("lastAccessAt")}
            </div>

            <div
              className={`${styles.tableCell} ${styles.sortableHeader}`}
              // onClick={() => handleSort("lastAccessAt")}
            >
              상세보기
            </div>
          </div>
        </div>

        <div className={styles.tableBody}>
          {sortedParticipants.map((participant: any) => (
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
                {getStatusBadge(participant)}
              </div>
              <div className={styles.tableCell}>
                {participant.lastAccessAt
                  ? formatFirestoreTimestampKST(participant.lastAccessAt)
                  : "정보 없음"}
              </div>

              <div className={styles.tableCell}>
                <button
                  onClick={(e) => handleShowDetail(participant)}
                  className={styles.detailButton}
                >
                  상세보기
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ParticipantsTab;
