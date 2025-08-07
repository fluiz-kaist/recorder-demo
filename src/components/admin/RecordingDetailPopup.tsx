import { useState } from "react";
import { formatFirestoreTimestampKST } from "@/utils/time";
import { AudioRecording } from "@/types/audio";

interface RecordingDetailPopupProps {
  recording: AudioRecording;
}

// 인라인 스타일 객체
const popupStyles = {
  popupContainer: {
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    background: "white",
    borderRadius: "12px",
    boxShadow: "0 10px 40px rgba(0, 0, 0, 0.25)",
    width: "100%", //  전체 폭 사용
    maxWidth: "800px", //  최대 폭 설정
    maxHeight: "calc(100vh - 40px)", // 화면 높이에 맞춤
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
    borderBottom: "2px solid transparent",
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
    overflowY: "auto" as const,
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
  typeSituational: { background: "#e8f5e8", color: "#27ae60" },
  typeFormal: { background: "#fdf2e8", color: "#e67e22" },
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
  volumeLevel: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    position: "relative" as const,
  },
  volumeBar: {
    height: "6px",
    borderRadius: "3px",
    flex: 1,
    background: "#ecf0f1",
    position: "relative" as const,
    overflow: "hidden" as const,
  },
  volumeText: {
    fontSize: "11px",
    fontWeight: 600,
    minWidth: "30px",
    textAlign: "right" as const,
  },
  qualityGrade: {
    padding: "3px 10px",
    borderRadius: "15px",
    fontSize: "11px",
    fontWeight: 600,
    textAlign: "center" as const,
  },
  qualityHigh: { background: "#e8f5e8", color: "#27ae60" },
  qualityMedium: { background: "#fff3cd", color: "#e67e22" },
  qualityLow: { background: "#f8d7da", color: "#e74c3c" },
  verificationStatus: {
    padding: "3px 10px",
    borderRadius: "15px",
    fontSize: "11px",
    fontWeight: 600,
    textAlign: "center" as const,
  },
  statusPending: { background: "#fff3cd", color: "#e67e22" },
  statusApproved: { background: "#e8f5e8", color: "#27ae60" },
  statusRejected: { background: "#f8d7da", color: "#e74c3c" },
  statusNeedsReview: { background: "#e2e3f1", color: "#6c5ce7" },
  rejectionReasons: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "6px",
  },
  rejectionReason: {
    background: "#f8d7da",
    color: "#721c24",
    padding: "8px 12px",
    borderRadius: "6px",
    borderLeft: "3px solid #e74c3c",
    fontSize: "12px",
  },
  popupFooter: {
    padding: "12px 20px",
    borderTop: "1px solid #e5e5e5",
    background: "#f8f9fa",
    display: "flex",
    justifyContent: "center",
  },
  downloadButton: {
    background: "#3498db",
    color: "white",
    padding: "8px 16px",
    borderRadius: "5px",
    textDecoration: "none",
    fontSize: "13px",
    fontWeight: 500,
    transition: "all 0.2s ease",
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
  },
};

const RecordingDetailPopup = ({ recording }: RecordingDetailPopupProps) => {
  const [activeTab, setActiveTab] = useState<
    "basic" | "text" | "quality" | "verification" | "json"
  >("basic");

  // 유틸리티 함수들
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
  };

  const getQualityColor = (level: number) => {
    if (level > 0.7) return "#4CAF50";
    if (level > 0.4) return "#FF9800";
    return "#F44336";
  };

  const getVerificationStatusText = (status: string) => {
    switch (status) {
      case "pending":
        return "검증 대기";
      case "approved":
        return "승인됨";
      case "rejected":
        return "반려됨";
      case "needs_review":
        return "재검토 필요";
      default:
        return status;
    }
  };

  const getVerificationStatusStyle = (status: string) => {
    switch (status) {
      case "pending":
        return {
          ...popupStyles.verificationStatus,
          ...popupStyles.statusPending,
        };
      case "approved":
        return {
          ...popupStyles.verificationStatus,
          ...popupStyles.statusApproved,
        };
      case "rejected":
        return {
          ...popupStyles.verificationStatus,
          ...popupStyles.statusRejected,
        };
      case "needs_review":
        return {
          ...popupStyles.verificationStatus,
          ...popupStyles.statusNeedsReview,
        };
      default:
        return popupStyles.verificationStatus;
    }
  };

  const getQualityGradeStyle = (grade: string) => {
    const baseStyle = popupStyles.qualityGrade;
    switch (grade) {
      case "high":
        return { ...baseStyle, ...popupStyles.qualityHigh };
      case "medium":
        return { ...baseStyle, ...popupStyles.qualityMedium };
      case "low":
        return { ...baseStyle, ...popupStyles.qualityLow };
      default:
        return { ...baseStyle, ...popupStyles.qualityLow };
    }
  };

  return (
    <div>
      {/* 헤더 */}
      <div style={popupStyles.popupHeader}>
        <div style={popupStyles.headerLeft}>
          <h2 style={popupStyles.headerTitle}>녹음 데이터 상세</h2>
          <span style={popupStyles.recordingId}>
            ID: {recording.id.substring(0, 8)}...
          </span>
        </div>
      </div>

      {/* 탭 네비게이션 */}
      <div style={popupStyles.tabNavigation}>
        {[
          { key: "basic", label: "📊 기본" },
          { key: "text", label: "📝 텍스트" },
          { key: "quality", label: "🎯 품질" },
          { key: "verification", label: "✓ 검증" },
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
        {activeTab === "basic" && (
          <div>
            <div style={popupStyles.section}>
              <h3 style={popupStyles.sectionTitle}>🎤 녹음 기본 정보</h3>
              <div style={popupStyles.infoGrid}>
                <div style={popupStyles.infoItem}>
                  <label style={popupStyles.infoLabel}>태스크 키</label>
                  <span
                    style={{ ...popupStyles.infoValue, ...popupStyles.taskKey }}
                  >
                    {recording.taskKey}
                  </span>
                </div>
                <div style={popupStyles.infoItem}>
                  <label style={popupStyles.infoLabel}>태스크 타입</label>
                  <span
                    style={{
                      ...popupStyles.typeBadge,
                      ...(recording.taskType === "situational"
                        ? popupStyles.typeSituational
                        : popupStyles.typeFormal),
                    }}
                  >
                    {recording.taskType === "situational"
                      ? "상황발화"
                      : "정형발화"}
                  </span>
                </div>
                <div style={popupStyles.infoItem}>
                  <label style={popupStyles.infoLabel}>파일명</label>
                  <span style={popupStyles.infoValue}>
                    {recording.fileName}
                  </span>
                </div>
                <div style={popupStyles.infoItem}>
                  <label style={popupStyles.infoLabel}>업로드 시간</label>
                  <span style={popupStyles.infoValue}>
                    {formatFirestoreTimestampKST(recording.uploadedAt)}
                  </span>
                </div>
              </div>
            </div>

            <div style={popupStyles.section}>
              <h3 style={popupStyles.sectionTitle}>👤 화자 정보</h3>
              <div style={popupStyles.infoGrid}>
                <div style={popupStyles.infoItem}>
                  <label style={popupStyles.infoLabel}>사용자명</label>
                  <span style={popupStyles.infoValue}>
                    {recording.speakerInfo?.userName || "이름 없음"}
                  </span>
                </div>
                <div style={popupStyles.infoItem}>
                  <label style={popupStyles.infoLabel}>성별</label>
                  <span style={popupStyles.infoValue}>
                    {recording.speakerInfo?.gender || "불명"}
                  </span>
                </div>
                <div style={popupStyles.infoItem}>
                  <label style={popupStyles.infoLabel}>연령대</label>
                  <span style={popupStyles.infoValue}>
                    {recording.speakerInfo?.ageGroup || "불명"}
                  </span>
                </div>
              </div>
            </div>

            {recording.recordingSession && (
              <div style={popupStyles.section}>
                <h3 style={popupStyles.sectionTitle}>⏱️ 녹음 세션 정보</h3>
                <div style={popupStyles.infoGrid}>
                  <div style={popupStyles.infoItem}>
                    <label style={popupStyles.infoLabel}>실제 녹음 길이</label>
                    <span style={popupStyles.infoValue}>
                      {formatDuration(
                        recording.recordingSession.actualDuration
                      )}
                    </span>
                  </div>
                  <div style={popupStyles.infoItem}>
                    <label style={popupStyles.infoLabel}>총 세션 시간</label>
                    <span style={popupStyles.infoValue}>
                      {formatDuration(
                        recording.recordingSession.sessionDuration
                      )}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "text" && (
          <div>
            <div style={popupStyles.section}>
              <h3 style={popupStyles.sectionTitle}>📋 메타데이터</h3>
              <div style={popupStyles.infoGrid}>
                <div style={popupStyles.infoItem}>
                  <label style={popupStyles.infoLabel}>도메인</label>
                  <span style={popupStyles.infoValue}>
                    {recording.textData?.domain || "도메인 없음"}
                  </span>
                </div>
                <div style={popupStyles.infoItem}>
                  <label style={popupStyles.infoLabel}>의도</label>
                  <span style={popupStyles.infoValue}>
                    {recording.textData?.intent || "의도 없음"}
                  </span>
                </div>
                <div style={popupStyles.infoItem}>
                  <label style={popupStyles.infoLabel}>카테고리</label>
                  <span style={popupStyles.infoValue}>
                    {recording.textData?.category || "카테고리 없음"}
                  </span>
                </div>
              </div>
            </div>

            <div style={popupStyles.section}>
              <h3 style={popupStyles.sectionTitle}>📄 원본 스크립트</h3>
              <div style={popupStyles.textBox}>
                {recording.textData?.originalScript ||
                  "원본 스크립트가 없습니다."}
              </div>
            </div>

            <div style={popupStyles.section}>
              <h3 style={popupStyles.sectionTitle}>🎯 STT 변환 결과</h3>
              <div style={popupStyles.textBox}>
                {recording.textData?.sttTranscription || "STT 결과가 없습니다."}
              </div>
            </div>

            {recording.textData?.manualTranscription && (
              <div style={popupStyles.section}>
                <h3 style={popupStyles.sectionTitle}>✏️ 수동 수정 텍스트</h3>
                <div style={popupStyles.textBox}>
                  {recording.textData.manualTranscription}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "quality" && (
          <div>
            <div style={popupStyles.section}>
              <h3 style={popupStyles.sectionTitle}>📈 기본 품질 지표</h3>
              <div style={popupStyles.infoGrid}>
                <div style={popupStyles.infoItem}>
                  <label style={popupStyles.infoLabel}>재생 시간</label>
                  <span style={popupStyles.infoValue}>
                    {formatDuration(recording.qualityCheck?.duration || 0)}
                  </span>
                </div>
                <div style={popupStyles.infoItem}>
                  <label style={popupStyles.infoLabel}>파일 크기</label>
                  <span style={popupStyles.infoValue}>
                    {formatFileSize(recording.qualityCheck?.fileSize || 0)}
                  </span>
                </div>
                <div style={popupStyles.infoItem}>
                  <label style={popupStyles.infoLabel}>음량 레벨</label>
                  <div style={popupStyles.volumeLevel}>
                    <div
                      style={{
                        ...popupStyles.volumeBar,
                        width: `${
                          (recording.qualityCheck?.volumeLevel || 0) * 100
                        }%`,
                        backgroundColor: getQualityColor(
                          recording.qualityCheck?.volumeLevel || 0
                        ),
                      }}
                    />
                    <span style={popupStyles.volumeText}>
                      {Math.round(
                        (recording.qualityCheck?.volumeLevel || 0) * 100
                      )}
                      %
                    </span>
                  </div>
                </div>
                <div style={popupStyles.infoItem}>
                  <label style={popupStyles.infoLabel}>품질 등급</label>
                  <span
                    style={getQualityGradeStyle(
                      recording.qualityCheck?.qualityGrade || "low"
                    )}
                  >
                    {recording.qualityCheck?.qualityGrade === "high"
                      ? "높음"
                      : recording.qualityCheck?.qualityGrade === "medium"
                      ? "보통"
                      : "낮음"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "verification" && (
          <div>
            <div style={popupStyles.section}>
              <h3 style={popupStyles.sectionTitle}>✅ 검증 상태</h3>
              <div style={popupStyles.infoGrid}>
                <div style={popupStyles.infoItem}>
                  <label style={popupStyles.infoLabel}>검증 상태</label>
                  <span
                    style={getVerificationStatusStyle(
                      recording.verificationStatus
                    )}
                  >
                    {getVerificationStatusText(recording.verificationStatus)}
                  </span>
                </div>
                {recording.verification?.verificationMethod && (
                  <div style={popupStyles.infoItem}>
                    <label style={popupStyles.infoLabel}>검증 방식</label>
                    <span style={popupStyles.infoValue}>
                      {recording.verification.verificationMethod === "auto"
                        ? "자동"
                        : recording.verification.verificationMethod === "manual"
                        ? "수동"
                        : "하이브리드"}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {recording.verification?.rejectionReasons &&
              recording.verification.rejectionReasons.length > 0 && (
                <div style={popupStyles.section}>
                  <h3 style={popupStyles.sectionTitle}>❌ 반려 사유</h3>
                  <div style={popupStyles.rejectionReasons}>
                    {recording.verification.rejectionReasons.map(
                      (reason, index) => (
                        <div key={index} style={popupStyles.rejectionReason}>
                          {reason}
                        </div>
                      )
                    )}
                  </div>
                </div>
              )}

            {recording.verification?.verifierNotes && (
              <div style={popupStyles.section}>
                <h3 style={popupStyles.sectionTitle}>📝 검증자 메모</h3>
                <div style={popupStyles.textBox}>
                  {recording.verification.verifierNotes}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* JSON 탭 내용 추가 */}
      {activeTab === "json" && (
        <div style={popupStyles.section}>
          <h3 style={popupStyles.sectionTitle}>Raw JSON Data</h3>
          <pre
            style={{
              ...popupStyles.textBox,
              maxHeight: "none",
              overflowY: "hidden",
              whiteSpace: "pre-wrap",
              wordBreak: "break-all",
            }}
          >
            <code>{JSON.stringify(recording, null, 2)}</code>
          </pre>
        </div>
      )}

      {/* 푸터 */}
      <div style={popupStyles.popupFooter}>
        <a
          href={recording.audioUrl}
          download={recording.fileName}
          style={popupStyles.downloadButton}
          target="_blank"
          rel="noopener noreferrer"
        >
          📥 다운로드
        </a>
      </div>
    </div>
  );
};

export default RecordingDetailPopup;
