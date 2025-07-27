import { useState } from "react";
import styles from "@/styles/AdminDashboard.module.css";
import { formatFirestoreTimestampKST } from "@/utils/time";
import { useAdminRecordings } from "@/hooks/queries/useAdminQueries";
import RecordingTabSearchFilters from "@/components/admin/RecordingTabSeach";
import { AudioRecording } from "@/types/audio";

// 녹음 데이터 탭
const AdminRecordingsTab = () => {
  const [appliedFilters, setAppliedFilters] = useState({
    // 실제 API 요청용
    search: "",
    taskType: "" as "" | "situational" | "formal",
    domain: "",
  });

  const recordingsQuery = useAdminRecordings({
    limit: 50,
    search: appliedFilters.search || undefined,
    taskType: appliedFilters.taskType || undefined,
    domain: appliedFilters.domain || undefined,
  });
  const recordingsData = recordingsQuery.data;

  if (recordingsQuery.isLoading) return <div>로딩 중...</div>;
  if (!recordingsData) return <div>데이터 없음</div>;

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

  console.log("[admin/recordingTab] recordingsData?", recordingsData);

  return (
    <>
      <RecordingTabSearchFilters onFiltersChange={setAppliedFilters} />
      <div className={styles.tableContainer}>
        <div className={styles.tableHeader}>
          <h3>최근 녹음 데이터 ({recordingsData.recordings.length}개)</h3>

          <div className={styles.statsRow}>
            <span>총 {recordingsData.totalCount}개</span>
            <span>
              상황발화: {recordingsData.statistics.byTaskType.situational}개
            </span>
            <span>
              정형발화: {recordingsData.statistics.byTaskType.formal}개
            </span>
          </div>
        </div>

        <div className={styles.table}>
          <div className={styles.tableHead}>
            <div className={styles.tableRow}>
              <div className={styles.tableCell}>사용자</div>
              <div className={styles.tableCell}>태스크</div>
              <div className={styles.tableCell}>타입</div>
              <div className={styles.tableCell}>도메인</div>
              <div className={styles.tableCell}>시간</div>
              <div className={styles.tableCell}>크기</div>
              <div className={styles.tableCell}>품질</div>
              <div className={styles.tableCell}>녹음일</div>
              <div className={styles.tableCell}>다운로드</div>
            </div>
          </div>

          <div className={styles.tableBody}>
            {recordingsData.recordings.map((recording: AudioRecording) => {
              return (
                <div key={recording.id} className={styles.tableRow}>
                  <div className={styles.tableCell}>
                    <span className={styles.userId}>
                      {/* {recording.userId.slice(0, 8)}... */}
                      {recording.speakerInfo.userName}
                    </span>
                  </div>
                  <div className={styles.tableCell}>
                    <span className={styles.taskKey}>{recording.taskKey}</span>
                  </div>
                  <div className={styles.tableCell}>
                    <span
                      className={`${styles.typeBadge} ${
                        recording.taskType === "situational"
                          ? styles.typeSituational
                          : styles.typeFormal
                      }`}
                    >
                      {recording.taskType === "situational" ? "상황" : "정형"}
                    </span>
                  </div>
                  <div className={styles.tableCell}>
                    {recording.textData.domain}
                  </div>
                  <div className={styles.tableCell}>
                    {formatDuration(recording.qualityCheck.duration)}
                  </div>
                  <div className={styles.tableCell}>
                    {formatFileSize(recording.qualityCheck.fileSize)}
                  </div>
                  <div className={styles.tableCell}>
                    <div className={styles.qualityIndicator}>
                      <div
                        className={`${styles.qualityDot} ${
                          recording.qualityCheck.volumeLevel > 0.7
                            ? styles.qualityHigh
                            : recording.qualityCheck.volumeLevel > 0.4
                            ? styles.qualityMedium
                            : styles.qualityLow
                        }`}
                      />
                      <span>
                        {Math.round(recording.qualityCheck.volumeLevel * 100)}%
                      </span>
                    </div>
                  </div>
                  <div className={styles.tableCell}>
                    <pre style={{ margin: 0, whiteSpace: "pre-line" }}>
                      {formatFirestoreTimestampKST(recording.uploadedAt)}
                    </pre>
                  </div>
                  <div className={styles.tableCell}>
                    <a
                      href={recording.audioUrl}
                      download={recording.fileName}
                      className={styles.downloadButton}
                      target="_blank"
                    >
                      다운로드
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
};

export default AdminRecordingsTab;
