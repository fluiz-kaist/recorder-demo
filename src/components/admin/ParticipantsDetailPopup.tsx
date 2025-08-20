import { useState } from "react";
import { formatFirestoreTimestampKST } from "@/utils/time";
import { User } from "@/types/user";
import { ParticipantDetail } from "@/pages/api/admin/participants/[userId]";
import { useAdminParticipantDetail } from "@/hooks/queries/useAdminQueries";
import { ParticipantOverview } from "@/pages/api/admin/participants/overview";
import { getDisplaySetId } from "@/utils/converter";
interface ParticipantsPopupProps {
  participant: ParticipantOverview;
}

// 기존 인라인 스타일 객체 재활용
const popupStyles = {
  popupContainer: {
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    background: "white",
    // borderRadius: "12px",
    // boxShadow: "0 10px 40px rgba(0, 0, 0, 0.25)",
    width: "100%",
    maxWidth: "910px",
    maxHeight: "calc(100vh - 40px)",
    display: "flex",
    flexDirection: "column" as const,
    overflow: "hidden",
    border: "1px solid #e5e5e5",
    margin: "20px auto",
  },
  popupHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "16px 20px 12px",
    borderBottom: "1px solid #e5e5e5",
    background: "linear-gradient(135deg, #f8f9fa 0%, #ffffff 100%)",
    userSelect: "none" as const,
  },
  headerLeft: { display: "flex", flexDirection: "column" as const },
  headerTitle: {
    margin: "0 0 2px 0",
    fontSize: "16px",
    fontWeight: 600,
    color: "#2c3e50",
  },
  recordingId: {
    fontSize: "11px",
    color: "#7f8c8d",
    fontFamily: "Monaco, Menlo, monospace",
    background: "#ecf0f1",
    padding: "1px 6px",
    borderRadius: "3px",
  },
  tabNavigation: {
    display: "flex",
    borderBottom: "1px solid #e5e5e5",
    background: "#f8f9fa",
    padding: "0 20px",
  },
  tabButton: {
    background: "none",
    border: "none",
    padding: "12px 16px",
    fontSize: "12px",
    fontWeight: 500,
    color: "#7f8c8d",
    cursor: "pointer",
    borderBottomWidth: "2px",
    transition: "all 0.2s ease",
    whiteSpace: "nowrap" as const,
  },
  tabButtonActive: {
    color: "#3498db",
    borderBottomColor: "#3498db",
    background: "white",
  },
  popupContent: {
    flex: 1,
    // overflowY: "auto" as const,
    padding: "20px",
    background: "white",
  },
  section: { marginBottom: "24px" },
  sectionTitle: {
    margin: "0 0 12px 0",
    fontSize: "14px",
    fontWeight: 600,
    color: "#2c3e50",
    paddingBottom: "6px",
    borderBottom: "1px solid #ecf0f1",
  },
  infoGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" },
  infoItem: { display: "flex", flexDirection: "column" as const },
  infoLabel: {
    fontSize: "11px",
    fontWeight: 500,
    color: "#7f8c8d",
    marginBottom: "3px",
    textTransform: "uppercase" as const,
    letterSpacing: "0.3px",
  },
  infoValue: { fontSize: "13px", color: "#2c3e50", fontWeight: 500 },
  taskKey: {
    fontFamily: "Monaco, Menlo, monospace",
    background: "#e8f4fd",
    color: "#2980b9",
    padding: "3px 6px",
    borderRadius: "3px",
    fontSize: "12px",
  },
  typeBadge: {
    display: "inline-block",
    padding: "3px 10px",
    borderRadius: "15px",
    fontSize: "11px",
    fontWeight: 600,
    textAlign: "center" as const,
    minWidth: "50px",
  },
  statusActive: { background: "#e8f5e8", color: "#27ae60" },
  statusInactive: { background: "#f8d7da", color: "#e74c3c" },
  statusPending: { background: "#fff3cd", color: "#e67e22" },
  statusCompleted: { background: "#e8f5e8", color: "#27ae60" },
  textBox: {
    background: "#f8f9fa",
    border: "1px solid #e5e5e5",
    borderRadius: "6px",
    padding: "12px",
    fontSize: "13px",
    lineHeight: 1.5,
    color: "#2c3e50",
    whiteSpace: "pre-wrap" as const,
    wordBreak: "break-word" as const,
    minHeight: "50px",
    maxHeight: "120px",
    overflowY: "auto" as const,
  },
  progressBar: {
    height: "8px",
    borderRadius: "4px",
    background: "#ecf0f1",
    position: "relative" as const,
    overflow: "hidden" as const,
  },
  progressFill: {
    height: "100%",
    borderRadius: "4px",
    transition: "width 0.3s ease",
  },
  progressText: {
    fontSize: "11px",
    fontWeight: 600,
    marginTop: "4px",
    textAlign: "center" as const,
  },
  roundCard: {
    background: "#f8f9fa",
    border: "1px solid #e5e5e5",
    borderRadius: "6px",
    padding: "12px",
    marginBottom: "8px",
  },
  roundHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "8px",
  },
  roundNumber: {
    fontWeight: 600,
    color: "#2c3e50",
    fontSize: "14px",
  },
  settingItem: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "8px 0",
    borderBottom: "1px solid #ecf0f1",
  },
  settingLabel: {
    fontSize: "13px",
    color: "#2c3e50",
  },
  settingValue: {
    fontSize: "12px",
    fontWeight: 600,
    padding: "2px 8px",
    borderRadius: "12px",
    background: "#e8f4fd",
    color: "#2980b9",
  },
};

const ParticipantsDetailPopup = ({ participant }: ParticipantsPopupProps) => {
  const [activeTab, setActiveTab] = useState<
    | "profile"
    | "status"
    | "rounds"
    | "recordings"
    | "setDetails"
    | "statistics"
    | "settings"
    | "json"
  >("profile");

  // 추가 필요
  const {
    data: participantDetail,
    isLoading,
    error,
  } = useAdminParticipantDetail(participant.userId);

  if (isLoading) return <div>로딩 중...</div>;
  if (error || !participantDetail)
    return <div>데이터를 불러올 수 없습니다.</div>;
  if (!participantDetail) {
    return (
      <div style={popupStyles.popupContainer}>
        <div style={popupStyles.popupContent}>
          <div>데이터를 불러오는 중...</div>
        </div>
      </div>
    );
  }

  // 유틸리티 함수들
  const formatPercent = (value: number) => `${Math.round(value)}%`;
  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
  };

  const getRoundStatusText = (status: string) => {
    switch (status) {
      case "assigned":
        return "할당됨";
      case "in_progress":
        return "진행중";
      case "completed":
        return "완료";
      case "submitted":
        return "제출됨";
      case "approved":
        return "승인됨";
      case "rejected":
        return "반려됨";
      default:
        return status;
    }
  };

  const getRoundStatusStyle = (status: string) => {
    const baseStyle = popupStyles.typeBadge;
    switch (status) {
      case "assigned":
        return { ...baseStyle, ...popupStyles.statusPending };
      case "in_progress":
        return { ...baseStyle, background: "#e2e3f1", color: "#6c5ce7" };
      case "completed":
      case "approved":
        return { ...baseStyle, ...popupStyles.statusCompleted };
      case "rejected":
        return { ...baseStyle, ...popupStyles.statusInactive };
      default:
        return { ...baseStyle, ...popupStyles.statusPending };
    }
  };

  const getProgressModeText = (mode: string) => {
    switch (mode) {
      case "mixed":
        return "혼합형";
      case "separated":
        return "분리형";
      default:
        return mode;
    }
  };

  console.log("❤️❤️❤️❤️❤️❤️❤️❤️participantDetail?", participantDetail);

  return (
    <div style={popupStyles.popupContainer}>
      {/* 헤더 */}
      <div style={popupStyles.popupHeader}>
        <div style={popupStyles.headerLeft}>
          <h2 style={popupStyles.headerTitle}>참여자 상세 정보</h2>
          <span style={popupStyles.recordingId}>
            ID: {participantDetail.id.substring(0, 12)}...
          </span>
        </div>
      </div>

      {/* 탭 네비게이션 */}
      <div style={popupStyles.tabNavigation}>
        {[
          { key: "profile", label: "👤 프로필" },
          { key: "status", label: "📊 현재상태" },
          { key: "rounds", label: "🔄 참여회차" },
          { key: "recordings", label: "🎤 녹음기록" },
          { key: "setDetails", label: "📋 세트상세" },
          { key: "statistics", label: "📈 통계" },
          { key: "settings", label: "⚙️ 설정" },
          { key: "json", label: "📖 JSON" },
        ].map((tab) => (
          <button
            key={tab.key}
            style={{
              ...popupStyles.tabButton,
              ...(activeTab === tab.key ? popupStyles.tabButtonActive : {}),
            }}
            onClick={() => setActiveTab(tab.key as any)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 탭 내용 */}
      <div style={popupStyles.popupContent}>
        {activeTab === "profile" && (
          <div>
            <div style={popupStyles.section}>
              <h3 style={popupStyles.sectionTitle}>👤 기본 프로필</h3>
              <div style={popupStyles.infoGrid}>
                <div style={popupStyles.infoItem}>
                  <label style={popupStyles.infoLabel}>사용자명</label>
                  <span style={popupStyles.infoValue}>
                    {participantDetail.profile.userName}
                  </span>
                </div>
                <div style={popupStyles.infoItem}>
                  <label style={popupStyles.infoLabel}>성별</label>
                  <span style={popupStyles.infoValue}>
                    {participantDetail.profile.gender}
                  </span>
                </div>
                <div style={popupStyles.infoItem}>
                  <label style={popupStyles.infoLabel}>연령대</label>
                  <span style={popupStyles.infoValue}>
                    {participantDetail.profile.ageGroup}
                  </span>
                </div>
                <div style={popupStyles.infoItem}>
                  <label style={popupStyles.infoLabel}>승인된 사용자 ID</label>
                  <span
                    style={{ ...popupStyles.infoValue, ...popupStyles.taskKey }}
                  >
                    {participantDetail.profile.authorizedUserId}
                  </span>
                </div>
              </div>
            </div>

            <div style={popupStyles.section}>
              <h3 style={popupStyles.sectionTitle}>📅 계정 정보</h3>
              <div style={popupStyles.infoGrid}>
                <div style={popupStyles.infoItem}>
                  <label style={popupStyles.infoLabel}>동의 여부</label>
                  <span
                    style={{
                      ...popupStyles.typeBadge,
                      ...(participantDetail.profile.hasConsented
                        ? popupStyles.statusActive
                        : popupStyles.statusInactive),
                    }}
                  >
                    {participantDetail.profile.hasConsented
                      ? "동의함"
                      : "미동의"}
                  </span>
                </div>
                <div style={popupStyles.infoItem}>
                  <label style={popupStyles.infoLabel}>계정 생성일</label>
                  <span style={popupStyles.infoValue}>
                    {formatFirestoreTimestampKST(
                      participantDetail.profile.createdAt
                    )}
                  </span>
                </div>
                <div style={popupStyles.infoItem}>
                  <label style={popupStyles.infoLabel}>동의일시</label>
                  <span style={popupStyles.infoValue}>
                    {participantDetail.profile.consentedAt
                      ? formatFirestoreTimestampKST(
                          participantDetail.profile.consentedAt
                        )
                      : "미동의"}
                  </span>
                </div>
                <div style={popupStyles.infoItem}>
                  <label style={popupStyles.infoLabel}>최종 접속</label>
                  <span style={popupStyles.infoValue}>
                    {formatFirestoreTimestampKST(
                      participantDetail.profile.lastAccessAt
                    )}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "status" && (
          <div>
            <div style={popupStyles.section}>
              <h3 style={popupStyles.sectionTitle}>현재 진행 상태</h3>
              <div style={popupStyles.infoGrid}>
                {/* <div style={popupStyles.infoItem}>
                  <label style={popupStyles.infoLabel}>온보딩 완료</label>
                  <span
                    style={{
                      ...popupStyles.typeBadge,
                      ...(participantDetail.currentStatus.isOnboardingCompleted
                        ? popupStyles.statusActive
                        : popupStyles.statusInactive),
                    }}
                  >
                    {participantDetail.currentStatus.isOnboardingCompleted
                      ? "완료"
                      : "미완료"}
                  </span>
                </div> */}
                <div style={popupStyles.infoItem}>
                  <label style={popupStyles.infoLabel}>
                    튜토리얼(가이드) 진행 완료 여부
                  </label>
                  <span
                    style={{
                      ...popupStyles.typeBadge,
                      ...(participantDetail.currentStatus.isTutorialCompleted
                        ? popupStyles.statusActive
                        : popupStyles.statusInactive),
                    }}
                  >
                    {participantDetail.currentStatus.isTutorialCompleted
                      ? "완료"
                      : "미완료"}
                  </span>
                </div>
                <div style={popupStyles.infoItem}>
                  <label style={popupStyles.infoLabel}>현재 회차</label>
                  <span style={popupStyles.infoValue}>
                    {participantDetail.currentStatus.currentRoundNumber}회차
                  </span>
                </div>
                <div style={popupStyles.infoItem}>
                  <label style={popupStyles.infoLabel}>녹음 시작 가능</label>
                  <span
                    style={{
                      ...popupStyles.typeBadge,
                      ...(participantDetail.currentStatus.canStartRecording
                        ? popupStyles.statusActive
                        : popupStyles.statusInactive),
                    }}
                  >
                    {participantDetail.currentStatus.canStartRecording
                      ? "가능"
                      : "불가능"}
                  </span>
                </div>
              </div>
            </div>

            <div style={popupStyles.section}>
              <h3 style={popupStyles.sectionTitle}>📊 현재 회차 진행률</h3>
              <div
                style={{ ...popupStyles.infoGrid, gridTemplateColumns: "1fr" }}
              >
                <div style={popupStyles.infoItem}>
                  <label style={popupStyles.infoLabel}>완료율</label>
                  <div style={popupStyles.progressBar}>
                    <div
                      style={{
                        ...popupStyles.progressFill,
                        width: `${participantDetail.currentStatus.currentRoundProgress.completedPercentage}%`,
                        background: "#27ae60",
                      }}
                    />
                  </div>
                  <div style={popupStyles.progressText}>
                    {formatPercent(
                      participantDetail.currentStatus.currentRoundProgress
                        .completedPercentage
                    )}
                  </div>
                </div>

                <div style={popupStyles.infoItem}>
                  <label style={popupStyles.infoLabel}>제출율</label>
                  <div style={popupStyles.progressBar}>
                    <div
                      style={{
                        ...popupStyles.progressFill,
                        width: `${participantDetail.currentStatus.currentRoundProgress.submittedPercentage}%`,
                        background: "#3498db",
                      }}
                    />
                  </div>
                  <div style={popupStyles.progressText}>
                    {formatPercent(
                      participantDetail.currentStatus.currentRoundProgress
                        .submittedPercentage
                    )}
                  </div>
                </div>

                <div style={popupStyles.infoItem}>
                  <label style={popupStyles.infoLabel}>승인율</label>
                  <div style={popupStyles.progressBar}>
                    <div
                      style={{
                        ...popupStyles.progressFill,
                        width: `${participantDetail.currentStatus.currentRoundProgress.approvedPercentage}%`,
                        background: "#e67e22",
                      }}
                    />
                  </div>
                  <div style={popupStyles.progressText}>
                    {formatPercent(
                      participantDetail.currentStatus.currentRoundProgress
                        .approvedPercentage
                    )}
                  </div>
                </div>
              </div>
            </div>

            {participantDetail.currentStatus.nextTask && (
              <div style={popupStyles.section}>
                <h3 style={popupStyles.sectionTitle}>⏭️ 다음 작업</h3>
                <div style={popupStyles.infoGrid}>
                  <div style={popupStyles.infoItem}>
                    <label style={popupStyles.infoLabel}>작업 키</label>
                    <span
                      style={{
                        ...popupStyles.infoValue,
                        ...popupStyles.taskKey,
                      }}
                    >
                      {participantDetail.currentStatus.nextTask.taskKey}
                    </span>
                  </div>
                  <div style={popupStyles.infoItem}>
                    <label style={popupStyles.infoLabel}>작업 타입</label>
                    <span
                      style={{
                        ...popupStyles.typeBadge,
                        ...(participantDetail.currentStatus.nextTask
                          .taskType === "situational"
                          ? popupStyles.statusActive
                          : popupStyles.statusPending),
                      }}
                    >
                      {participantDetail.currentStatus.nextTask.taskType ===
                      "situational"
                        ? "상황발화"
                        : "정형발화"}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "rounds" && (
          <div>
            <div style={popupStyles.section}>
              <h3 style={popupStyles.sectionTitle}>🔄 참여 회차 목록</h3>
              {participantDetail.roundSummaries.length > 0 ? (
                participantDetail.roundSummaries.map((round) => (
                  <div key={round.roundNumber} style={popupStyles.roundCard}>
                    <div style={popupStyles.roundHeader}>
                      <span style={popupStyles.roundNumber}>
                        {round.roundNumber}회차 (세트 {getDisplaySetId(round)})
                      </span>
                      <span style={getRoundStatusStyle(round.status)}>
                        {getRoundStatusText(round.status)}
                      </span>
                    </div>
                    <div style={popupStyles.infoGrid}>
                      <div style={popupStyles.infoItem}>
                        <label style={popupStyles.infoLabel}>할당일</label>
                        <span style={popupStyles.infoValue}>
                          {formatFirestoreTimestampKST(round.assignedAt)}
                        </span>
                      </div>
                      <div style={popupStyles.infoItem}>
                        <label style={popupStyles.infoLabel}>승인율</label>
                        <span style={popupStyles.infoValue}>
                          {formatPercent(round.progressSummary.approvalRate)}
                        </span>
                      </div>
                      <div style={popupStyles.infoItem}>
                        <label style={popupStyles.infoLabel}>총 작업 수</label>
                        <span style={popupStyles.infoValue}>
                          {round.progressSummary.totalTasks}개
                        </span>
                      </div>
                      <div style={popupStyles.infoItem}>
                        <label style={popupStyles.infoLabel}>
                          승인 작업 수
                        </label>
                        <span style={popupStyles.infoValue}>
                          {round.progressSummary.approvedTasks}개
                        </span>
                      </div>
                    </div>
                    {round.completedAt && (
                      <div style={{ marginTop: "8px" }}>
                        <label style={popupStyles.infoLabel}>완료일</label>
                        <span style={popupStyles.infoValue}>
                          {formatFirestoreTimestampKST(round.completedAt)}
                        </span>
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div style={popupStyles.textBox}>참여한 회차가 없습니다.</div>
              )}
            </div>
          </div>
        )}

        {activeTab === "recordings" && (
          <div>
            <div style={popupStyles.section}>
              <h3 style={popupStyles.sectionTitle}>
                🎤 녹음 기록 ({participantDetail.recordingHistory.length}개)
              </h3>
              {participantDetail.recordingHistory.length > 0 ? (
                participantDetail.recordingHistory.map((recording, index) => (
                  <div
                    key={recording.recordingId}
                    style={popupStyles.roundCard}
                  >
                    <div style={popupStyles.roundHeader}>
                      <span style={popupStyles.roundNumber}>
                        {recording.taskKey}
                      </span>
                      <span
                        style={{
                          ...popupStyles.typeBadge,
                          ...(recording.taskType === "situational"
                            ? popupStyles.statusActive
                            : popupStyles.statusPending),
                        }}
                      >
                        {recording.taskType === "situational"
                          ? "상황발화"
                          : "정형발화"}
                      </span>
                    </div>
                    <div style={popupStyles.infoGrid}>
                      <div style={popupStyles.infoItem}>
                        <label style={popupStyles.infoLabel}>녹음 ID</label>
                        <span
                          style={{
                            ...popupStyles.infoValue,
                            ...popupStyles.taskKey,
                          }}
                        >
                          {recording.recordingId.substring(0, 8)}...
                        </span>
                      </div>
                      <div style={popupStyles.infoItem}>
                        <label style={popupStyles.infoLabel}>완료일시</label>
                        <span style={popupStyles.infoValue}>
                          {formatFirestoreTimestampKST(recording.completedAt)}
                        </span>
                      </div>
                      <div style={popupStyles.infoItem}>
                        <label style={popupStyles.infoLabel}>녹음 시간</label>
                        <span style={popupStyles.infoValue}>
                          {formatDuration(recording.duration)}
                        </span>
                      </div>
                      <div style={popupStyles.infoItem}>
                        <label style={popupStyles.infoLabel}>품질 점수</label>
                        <span style={popupStyles.infoValue}>
                          {Math.round(recording.qualityScore)}점
                        </span>
                      </div>
                      <div style={popupStyles.infoItem}>
                        <label style={popupStyles.infoLabel}>상태</label>
                        <span style={getRoundStatusStyle(recording.status)}>
                          {getRoundStatusText(recording.status)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div style={popupStyles.textBox}>녹음 기록이 없습니다.</div>
              )}
            </div>
          </div>
        )}

        {activeTab === "setDetails" && (
          <div>
            <div style={popupStyles.section}>
              <h3 style={popupStyles.sectionTitle}>📋 세트별 상세 진행률</h3>
              {participantDetail.setDetails.length > 0 ? (
                participantDetail.setDetails.map((setDetail) => (
                  <div key={setDetail.setNumber} style={popupStyles.roundCard}>
                    <div style={popupStyles.roundHeader}>
                      <span style={popupStyles.roundNumber}>
                        {setDetail.setNumber}회차 - 세트 {setDetail.setId}
                      </span>
                      <span style={getRoundStatusStyle(setDetail.status)}>
                        {getRoundStatusText(setDetail.status)}
                      </span>
                    </div>

                    <div style={popupStyles.infoGrid}>
                      <div style={popupStyles.infoItem}>
                        <label style={popupStyles.infoLabel}>전체 진행률</label>
                        <div style={popupStyles.progressBar}>
                          <div
                            style={{
                              ...popupStyles.progressFill,
                              width: `${setDetail.progressPercentage}%`,
                              background: "#3498db",
                            }}
                          />
                        </div>
                        <div style={popupStyles.progressText}>
                          {setDetail.completedTasks}/{setDetail.totalTasks} (
                          {setDetail.progressPercentage}%)
                        </div>
                      </div>
                    </div>

                    <div style={{ marginTop: "12px" }}>
                      <h4
                        style={{
                          ...popupStyles.sectionTitle,
                          fontSize: "12px",
                          margin: "0 0 8px 0",
                        }}
                      >
                        작업 타입별 상세
                      </h4>
                      <div style={popupStyles.infoGrid}>
                        <div style={popupStyles.infoItem}>
                          <label style={popupStyles.infoLabel}>상황발화</label>
                          <span style={popupStyles.infoValue}>
                            {setDetail.situationalProgress.completed}/
                            {setDetail.situationalProgress.total}개
                          </span>
                        </div>
                        <div style={popupStyles.infoItem}>
                          <label style={popupStyles.infoLabel}>정형발화</label>
                          <span style={popupStyles.infoValue}>
                            {setDetail.formalProgress.completed}/
                            {setDetail.formalProgress.total}개
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div style={popupStyles.textBox}>세트 정보가 없습니다.</div>
              )}
            </div>
          </div>
        )}

        {activeTab === "statistics" && (
          <div>
            <div style={popupStyles.section}>
              <h3 style={popupStyles.sectionTitle}>📊 현재 회차 통계</h3>
              <div style={popupStyles.infoGrid}>
                <div style={popupStyles.infoItem}>
                  <label style={popupStyles.infoLabel}>회차 번호</label>
                  <span style={popupStyles.infoValue}>
                    {participantDetail.statistics.current.roundNumber}회차
                  </span>
                </div>
                <div style={popupStyles.infoItem}>
                  <label style={popupStyles.infoLabel}>전체 작업 수</label>
                  <span style={popupStyles.infoValue}>
                    {participantDetail.statistics.current.totalTasks}개
                  </span>
                </div>
                <div style={popupStyles.infoItem}>
                  <label style={popupStyles.infoLabel}>완료 작업 수</label>
                  <span style={popupStyles.infoValue}>
                    {participantDetail.statistics.current.completedTasks}개
                  </span>
                </div>
                <div style={popupStyles.infoItem}>
                  <label style={popupStyles.infoLabel}>승인 작업 수</label>
                  <span style={popupStyles.infoValue}>
                    {participantDetail.statistics.current.approvedTasks}개
                  </span>
                </div>
                <div style={popupStyles.infoItem}>
                  <label style={popupStyles.infoLabel}>총 녹음 시간</label>
                  <span style={popupStyles.infoValue}>
                    {Math.floor(
                      participantDetail.statistics.current.recordingTime / 60
                    )}
                    분 {participantDetail.statistics.current.recordingTime % 60}
                    초
                  </span>
                </div>
                <div style={popupStyles.infoItem}>
                  <label style={popupStyles.infoLabel}>완료율</label>
                  <span style={popupStyles.infoValue}>
                    {formatPercent(
                      participantDetail.statistics.current.completedPercentage
                    )}
                  </span>
                </div>
                <div style={popupStyles.infoItem}>
                  <label style={popupStyles.infoLabel}>승인율</label>
                  <span style={popupStyles.infoValue}>
                    {formatPercent(
                      participantDetail.statistics.current.approvedPercentage
                    )}
                  </span>
                </div>
                <div style={popupStyles.infoItem}>
                  <label style={popupStyles.infoLabel}>최종 업데이트</label>
                  <span style={popupStyles.infoValue}>
                    {formatFirestoreTimestampKST(
                      participantDetail.statistics.current.lastUpdatedAt
                    )}
                  </span>
                </div>
              </div>
            </div>

            {participantDetail.statistics.overall && (
              <div style={popupStyles.section}>
                <h3 style={popupStyles.sectionTitle}>📈 전체 누적 통계</h3>
                <div style={popupStyles.infoGrid}>
                  <div style={popupStyles.infoItem}>
                    <label style={popupStyles.infoLabel}>총 참여 회차</label>
                    <span style={popupStyles.infoValue}>
                      {
                        participantDetail.statistics.overall
                          .totalParticipationRounds
                      }
                      회차
                    </span>
                  </div>
                  <div style={popupStyles.infoItem}>
                    <label style={popupStyles.infoLabel}>총 완료 작업</label>
                    <span style={popupStyles.infoValue}>
                      {participantDetail.statistics.overall.totalTasksCompleted}
                      개
                    </span>
                  </div>
                  <div style={popupStyles.infoItem}>
                    <label style={popupStyles.infoLabel}>총 승인 작업</label>
                    <span style={popupStyles.infoValue}>
                      {participantDetail.statistics.overall.totalTasksApproved}
                      개
                    </span>
                  </div>
                  <div style={popupStyles.infoItem}>
                    <label style={popupStyles.infoLabel}>총 녹음 시간</label>
                    <span style={popupStyles.infoValue}>
                      {Math.floor(
                        participantDetail.statistics.overall
                          .totalRecordingTime / 3600
                      )}
                      시간{" "}
                      {Math.floor(
                        (participantDetail.statistics.overall
                          .totalRecordingTime %
                          3600) /
                          60
                      )}
                      분
                    </span>
                  </div>
                  <div style={popupStyles.infoItem}>
                    <label style={popupStyles.infoLabel}>평균 품질 점수</label>
                    <span style={popupStyles.infoValue}>
                      {participantDetail.statistics.overall.averageQualityScore.toFixed(
                        1
                      )}
                      점
                    </span>
                  </div>
                  <div style={popupStyles.infoItem}>
                    <label style={popupStyles.infoLabel}>전체 승인율</label>
                    <span style={popupStyles.infoValue}>
                      {formatPercent(
                        participantDetail.statistics.overall.overallApprovalRate
                      )}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "settings" && (
          <div>
            <div style={popupStyles.section}>
              <h3 style={popupStyles.sectionTitle}>⚙️ 사용자 설정</h3>

              <div style={popupStyles.settingItem}>
                <span style={popupStyles.settingLabel}>녹음 후 자동 제출</span>
                <span
                  style={{
                    ...popupStyles.settingValue,
                    ...(participantDetail.settings.autoSubmitAfterRecording
                      ? { background: "#e8f5e8", color: "#27ae60" }
                      : { background: "#f8d7da", color: "#e74c3c" }),
                  }}
                >
                  {participantDetail.settings.autoSubmitAfterRecording
                    ? "사용"
                    : "미사용"}
                </span>
              </div>

              <div style={popupStyles.settingItem}>
                <span style={popupStyles.settingLabel}>자동 승인 허용</span>
                <span
                  style={{
                    ...popupStyles.settingValue,
                    ...(participantDetail.settings.allowAutoApproval
                      ? { background: "#e8f5e8", color: "#27ae60" }
                      : { background: "#f8d7da", color: "#e74c3c" }),
                  }}
                >
                  {participantDetail.settings.allowAutoApproval
                    ? "허용"
                    : "비허용"}
                </span>
              </div>

              <div style={popupStyles.settingItem}>
                <span style={popupStyles.settingLabel}>수동 검토 필수</span>
                <span
                  style={{
                    ...popupStyles.settingValue,
                    ...(participantDetail.settings.requireManualReview
                      ? { background: "#fff3cd", color: "#e67e22" }
                      : { background: "#e8f4fd", color: "#2980b9" }),
                  }}
                >
                  {participantDetail.settings.requireManualReview
                    ? "필수"
                    : "선택"}
                </span>
              </div>

              <div style={popupStyles.settingItem}>
                <span style={popupStyles.settingLabel}>선호 진행 방식</span>
                <span style={popupStyles.settingValue}>
                  {getProgressModeText(
                    participantDetail.settings.preferredProgressMode
                  )}
                </span>
              </div>

              <div style={popupStyles.settingItem}>
                <span style={popupStyles.settingLabel}>최대 참여 회차</span>
                <span style={popupStyles.settingValue}>
                  {participantDetail.settings.maxAllowedRounds}회차
                </span>
              </div>
            </div>
          </div>
        )}

        {activeTab === "json" && (
          <div style={popupStyles.section}>
            <h3 style={popupStyles.sectionTitle}>Raw JSON Data</h3>
            <div
              style={{
                background: "#1e1e1e",
                color: "#d4d4d4",
                padding: "16px",
                borderRadius: "8px",
                fontSize: "12px",
                lineHeight: 1.5,
                maxHeight: "600px",
                overflowY: "auto",
                fontFamily: "Monaco, Menlo, 'Courier New', monospace",
              }}
            >
              <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>
                <code>{JSON.stringify(participantDetail, null, 3)}</code>
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ParticipantsDetailPopup;
