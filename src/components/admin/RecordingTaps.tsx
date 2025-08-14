import { useState, useEffect } from "react";
import styles from "@/styles/AdminDashboard.module.css";
import { formatFirestoreTimestampKST } from "@/utils/time";
import { useAdminRecordings } from "@/hooks/queries/useAdminQueries";
import RecordingTabSearchFilters from "@/components/admin/RecordingTabSeach";
import { AudioRecording, VerificationStatus } from "@/types/audio";

// 페이지네이션 컴포넌트
const Pagination = ({
  currentPage,
  totalPages,
  hasNextPage,
  hasPrevPage,
  onPageChange,
}: {
  currentPage: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
  onPageChange: (page: number) => void;
}) => {
  // 표시할 페이지 번호들 계산 (현재 페이지 기준 ±2)
  const getPageNumbers = () => {
    const pages = [];
    const start = Math.max(1, currentPage - 2);
    const end = Math.min(totalPages, currentPage + 2);

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    return pages;
  };

  return (
    <div className={styles.pagination}>
      {/* 첫 페이지 */}
      <button
        onClick={() => onPageChange(1)}
        disabled={currentPage === 1}
        className={`${styles.pageButton} ${
          currentPage === 1 ? styles.disabled : ""
        }`}
      >
        ««
      </button>

      {/* 이전 페이지 */}
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={!hasPrevPage}
        className={`${styles.pageButton} ${
          !hasPrevPage ? styles.disabled : ""
        }`}
      >
        ‹
      </button>

      {/* 페이지 번호들 */}
      {getPageNumbers().map((page) => (
        <button
          key={page}
          onClick={() => onPageChange(page)}
          className={`${styles.pageButton} ${
            page === currentPage ? styles.active : ""
          }`}
        >
          {page}
        </button>
      ))}

      {/* 다음 페이지 */}
      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={!hasNextPage}
        className={`${styles.pageButton} ${
          !hasNextPage ? styles.disabled : ""
        }`}
      >
        ›
      </button>

      {/* 마지막 페이지 */}
      <button
        onClick={() => onPageChange(totalPages)}
        disabled={currentPage === totalPages}
        className={`${styles.pageButton} ${
          currentPage === totalPages ? styles.disabled : ""
        }`}
      >
        »»
      </button>
    </div>
  );
};

// 페이지 크기 선택 컴포넌트
const PageSizeSelector = ({
  pageSize,
  onPageSizeChange,
}: {
  pageSize: number;
  onPageSizeChange: (size: number) => void;
}) => {
  const pageSizes = [20, 50, 100, 200];

  return (
    <div className={styles.pageSizeSelector}>
      <label>페이지당 항목 수:</label>
      <select
        value={pageSize}
        onChange={(e) => onPageSizeChange(Number(e.target.value))}
        className={styles.pageSizeSelect}
      >
        {pageSizes.map((size) => (
          <option key={size} value={size}>
            {size}개
          </option>
        ))}
      </select>
    </div>
  );
};

// 녹음 데이터 탭 (페이지네이션 포함)
const AdminRecordingsTab = () => {
  // 페이지네이션 상태
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  // 필터 상태
  const [appliedFilters, setAppliedFilters] = useState({
    search: "",
    taskType: "" as "" | "situational" | "formal",
    domain: "",
    searchField: "userName",
  });

  // 오디오 재생 상태
  const [currentlyPlaying, setCurrentlyPlaying] = useState<string | null>(null);
  const [audioElements, setAudioElements] = useState<
    Map<string, HTMLAudioElement>
  >(new Map());

  // 페이지네이션 파라미터 포함한 API 호출
  const recordingsQuery = useAdminRecordings({
    page: currentPage, // 현재 페이지
    limit: pageSize, // 페이지 크기
    search: appliedFilters.search || undefined,
    taskType: appliedFilters.taskType || undefined,
    domain: appliedFilters.domain || undefined,
    searchField: appliedFilters.searchField || undefined, // 이 줄 추가
  });

  const recordingsData = recordingsQuery.data;

  const handleShowDetail = (recording: AudioRecording) => {
    const popup = window.open(
      `/recording-detail/${recording.id}`,
      `recording-${recording.id}`,
      "width=800,height=700,scrollbars=yes,resizable=yes"
    );

    if (popup) {
      const sendData = () => {
        popup.postMessage(
          {
            type: "RECORDING_DATA",
            recording: recording,
          },
          window.location.origin
        );
      };

      setTimeout(sendData, 1000); // 1초 후
    }
  };

  

  //  페이지 크기가 변경되면 첫 페이지로 리셋
  useEffect(() => {
    setCurrentPage(1);
  }, [pageSize]);

  // 페이지 변경 핸들러
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    // 스크롤을 테이블 상단으로 이동
    document.querySelector(`.${styles.tableContainer}`)?.scrollIntoView({
      behavior: "smooth",
    });
  };

  // 페이지 크기 변경 핸들러
  const handlePageSizeChange = (size: number) => {
    setPageSize(size);
  };

  // 3. handleShowDetail

  //  오디오 재생/정지 핸들러
  const handlePlayAudio = (recording: AudioRecording) => {
    const recordingId = recording.id;

    // 현재 재생 중인 다른 오디오가 있으면 정지
    if (currentlyPlaying && currentlyPlaying !== recordingId) {
      const currentAudio = audioElements.get(currentlyPlaying);
      if (currentAudio) {
        currentAudio.pause();
        currentAudio.currentTime = 0;
      }
    }

    // 현재 오디오 요소 가져오기 또는 생성
    let audio = audioElements.get(recordingId);

    if (!audio) {
      // 새 오디오 엘리먼트 생성
      const newAudio = new Audio(recording.audioUrl);
      newAudio.preload = "metadata";

      // 오디오 이벤트 리스너 추가
      newAudio.addEventListener("ended", () => {
        setCurrentlyPlaying(null);
      });

      newAudio.addEventListener("error", () => {
        console.error("오디오 재생 오류:", recording.fileName);
        setCurrentlyPlaying(null);
        alert("오디오 파일을 재생할 수 없습니다.");
      });

      // Map에 저장
      setAudioElements((prev) => new Map(prev).set(recordingId, newAudio));
      audio = newAudio;
    }

    // 재생/정지 토글
    if (currentlyPlaying === recordingId) {
      audio.pause();
      audio.currentTime = 0;
      setCurrentlyPlaying(null);
    } else {
      audio
        .play()
        .then(() => {
          setCurrentlyPlaying(recordingId);
        })
        .catch((err) => {
          console.error("재생 실패:", err);
          alert("오디오 재생에 실패했습니다.");
        });
    }
  };
  // 컴포넌트 언마운트 시 모든 오디오 정리
  useEffect(() => {
    return () => {
      audioElements.forEach((audio) => {
        audio.pause();
        audio.src = "";
      });
    };
  }, [audioElements]);

  // `AdminRecordingsTab` 컴포넌트 내부에 추가
  const VerificationStatusBadge = ({
    status,
  }: {
    status: VerificationStatus;
  }) => {
    let badgeText = "";
    let badgeStyle = "";

    switch (status) {
      case VerificationStatus.PENDING:
        badgeText = "검증 대기";
        badgeStyle = styles.badgePending;
        break;
      case VerificationStatus.APPROVED:
        badgeText = "검증 통과";
        badgeStyle = styles.badgeApproved;
        break;
      case VerificationStatus.REJECTED:
        badgeText = "검증 반려";
        badgeStyle = styles.badgeRejected;
        break;
      case VerificationStatus.NEEDS_RETRY:
        badgeText = "재시도 필요";
        badgeStyle = styles.badgeNeedsRetry;
        break;
      default:
        badgeText = "알 수 없음";
        badgeStyle = styles.badgeUnknown;
    }

    return <span className={`${styles.badge} ${badgeStyle}`}>{badgeText}</span>;
  };

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

  // 로딩 상태
  if (recordingsQuery.isLoading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.spinner}></div>
        <p>녹음 데이터를 불러오는 중...</p>
      </div>
    );
  }

  // 에러 상태
  if (recordingsQuery.isError) {
    return (
      <div className={styles.errorContainer}>
        <p>❌ 데이터를 불러오는데 실패했습니다.</p>
        <button
          onClick={() => recordingsQuery.refetch()}
          className={styles.retryButton}
        >
          다시 시도
        </button>
      </div>
    );
  }

  // 데이터 없음
  if (!recordingsData) {
    return <div className={styles.noDataContainer}>데이터가 없습니다.</div>;
  }

  console.log("[admin/recordingTab] recordingsData?", recordingsData);

  return (
    <>
      {/* 검색 필터 */}
      <RecordingTabSearchFilters onFiltersChange={setAppliedFilters} />

      <div className={styles.tableContainer}>
        {/* 헤더 정보 */}
        <div className={styles.tableHeader}>
          <div className={styles.titleRow}>
            <h3>
              녹음 데이터 목록
              {appliedFilters.search &&
                ` - "${appliedFilters.search}" 검색 결과`}
            </h3>
            <PageSizeSelector
              pageSize={pageSize}
              onPageSizeChange={handlePageSizeChange}
            />
          </div>

          {/* 통계 정보 */}
          <div className={styles.statsRow}>
            <span className={styles.totalCount}>
              📊 총{" "}
              <strong>{recordingsData.totalCount.toLocaleString()}</strong>개
            </span>
            <span className={styles.currentShowing}>
              (현재 {recordingsData.recordings.length}개 표시)
            </span>
            <span>(현재 페이지에서의) </span>
            <span className={styles.taskStats}>
              상황발화:{" "}
              <strong>
                {recordingsData.statistics.byTaskType.situational}
              </strong>
              개
            </span>
            <span className={styles.taskStats}>
              정형발화:{" "}
              <strong>{recordingsData.statistics.byTaskType.formal}</strong>개
            </span>
          </div>

          {/* 페이지 정보 */}
          <div className={styles.pageInfo}>
            📄 {recordingsData.pagination.currentPage} /{" "}
            {recordingsData.pagination.totalPages} 페이지
            {appliedFilters.search && (
              <span className={styles.searchInfo}>
                🔍 검색 결과: {recordingsData.totalCount}개 발견
              </span>
            )}
          </div>
        </div>

        {/* 테이블 */}
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
              <div className={styles.tableCell}>검증 상태</div>
              <div className={styles.tableCell}>액션</div>
            </div>
          </div>

          <div className={styles.tableBody}>
            {recordingsData.recordings.length === 0 ? (
              <div className={styles.emptyState}>
                <p>🔍 검색 조건에 맞는 녹음 데이터가 없습니다.</p>
                {appliedFilters.search && <p>다른 검색어를 시도해보세요.</p>}
              </div>
            ) : (
              recordingsData.recordings.map((recording: AudioRecording) => (
                <div key={recording.id} className={styles.tableRow}>
                  <div className={styles.tableCell}>
                    {/* 1. 새로운 함수 `checkSttIssue`를 호출하여 STT 이슈 여부를 확인합니다.
        2. 그 결과에 따라 CSS 클래스를 동적으로 적용합니다.
      */}
                    <span className={styles.userId}>
                      {recording.speakerInfo?.userName || "이름 없음"}
                      {checkSttIssue(recording.textData.sttTranscription) && (
                        <span className={styles.sttIssueIcon} title="STT 이슈">
                          ⚠️
                        </span>
                      )}
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
                    {recording.textData?.domain || "도메인 없음"}
                  </div>
                  <div className={styles.tableCell}>
                    {formatDuration(recording.qualityCheck?.duration || 0)}
                  </div>
                  <div className={styles.tableCell}>
                    {formatFileSize(recording.qualityCheck?.fileSize || 0)}
                  </div>
                  <div className={styles.tableCell}>
                    <div className={styles.qualityIndicator}>
                      <div
                        className={`${styles.qualityDot} ${
                          (recording.qualityCheck?.volumeLevel || 0) > 0.7
                            ? styles.qualityHigh
                            : (recording.qualityCheck?.volumeLevel || 0) > 0.4
                            ? styles.qualityMedium
                            : styles.qualityLow
                        }`}
                      />
                      <span>
                        {Math.round(
                          (recording.qualityCheck?.volumeLevel || 0) * 100
                        )}
                        %
                      </span>
                    </div>
                  </div>
                  <div className={styles.tableCell}>
                    <span className={styles.timestamp}>
                      {formatFirestoreTimestampKST(recording.uploadedAt)}
                    </span>
                  </div>
                  <div className={styles.tableCell}>
                    <VerificationStatusBadge
                      status={recording.verificationStatus}
                    />
                  </div>
                  {/* 액션 버튼들 (상세보기 + 다운로드) */}
                  <div className={styles.tableCell}>
                    <div className={styles.actionButtons}>
                      <button
                        onClick={(e) => handleShowDetail(recording)}
                        className={styles.detailButton}
                      >
                        상세보기
                      </button>

                      <button
                        onClick={() => handlePlayAudio(recording)}
                        className={`${styles.playButton} ${
                          currentlyPlaying === recording.id
                            ? styles.playing
                            : ""
                        }`}
                        title={
                          currentlyPlaying === recording.id ? "정지" : "재생"
                        }
                      >
                        {currentlyPlaying === recording.id ? "⏸️" : "▶️"}
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* 🔥 페이지네이션 UI */}
        {recordingsData.pagination.totalPages > 1 && (
          <div className={styles.paginationContainer}>
            <Pagination
              currentPage={recordingsData.pagination.currentPage}
              totalPages={recordingsData.pagination.totalPages}
              hasNextPage={recordingsData.pagination.hasNextPage}
              hasPrevPage={recordingsData.pagination.hasPrevPage}
              onPageChange={handlePageChange}
            />

            {/* 페이지 정보 텍스트 */}
            <div className={styles.paginationInfo}>
              {recordingsData.totalCount > 0 && (
                <span>
                  {(recordingsData.pagination.currentPage - 1) * pageSize + 1} -{" "}
                  {Math.min(
                    recordingsData.pagination.currentPage * pageSize,
                    recordingsData.totalCount
                  )}{" "}
                  / {recordingsData.totalCount.toLocaleString()} 항목
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default AdminRecordingsTab;

function checkSttIssue(sttText: string) {
  // 'sttText'가 특정 문자열과 일치하는지 확인하고 true/false를 반환합니다.
  const isDefault = sttText === "클라이언트에서 STT 결과를 보내지 않았습니다";
  // 조건에 따라 '🧧' 또는 '👌'를 반환하는 대신, 불리언(true/false)을 반환합니다.
  return isDefault;
}
