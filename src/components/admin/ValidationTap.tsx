import { useState, useRef } from "react";
import styles from "@/styles/AdminDashboard.module.css";
import LLMValidationReview from "@/components/admin/LLMValidationReview";
import { ValidationResultItem } from "@/components/admin/LLMValidationReview";
import { VerificationStatus } from "@/types/audio";
// LLM 검증 요청 인터페이스
interface LLMValidationRequest {
  recordingIds?: string[];
  dateRange?: {
    from: string;
    to: string;
  };
  filters?: {
    verificationStatus?: VerificationStatus; // enum 사용
    domain?: string;
    taskType?: "situational" | "formal";
    limit?: number;
  };
  testMode?: boolean;
}

// LLM 검증 응답 인터페이스
interface LLMValidationResponse {
  success: boolean;
  data?: {
    processedCount: number;
    approvedCount: number;
    rejectedCount: number;
    recordingIds: string[];
    processingTime: number;
    details?: any[];
  };
  message?: string;
}

interface ValidationUpdateResponse {
  success: boolean;
  data?: {
    updatedCount: number;
    approvedCount: number;
    rejectedCount: number;
    skippedCount: number;
    recordingIds: string[];
    processingTime: number;
  };
  message?: string;
  errors?: Array<{
    recordingId: string;
    error: string;
  }>;
}

interface LLMValidationFiltersProps {
  onValidationRequest: (request: LLMValidationRequest) => void;
  onLoadExistingData: (request: LLMValidationRequest) => void;
  isProcessing: boolean;
  isLoading?: boolean;
}

const LLMValidationFilters = ({
  onValidationRequest,
  onLoadExistingData,
  isProcessing,
  isLoading,
}: LLMValidationFiltersProps) => {
  // 필터 상태들
  const [validationMode, setValidationMode] = useState<
    "dateRange" | "recordingIds"
  >("dateRange");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [recordingIds, setRecordingIds] = useState("");
  const [verificationStatus, setVerificationStatus] = useState<
    "pending" | "approved" | "rejected" | ""
  >("");
  const [domain, setDomain] = useState("");
  const [taskType, setTaskType] = useState<"situational" | "formal" | "">("");
  const [limit, setLimit] = useState<number>(100);
  const [testMode, setTestMode] = useState(false);

  const recordingIdsRef = useRef<HTMLTextAreaElement>(null);

  // 도메인 옵션들 (기존 컴포넌트에서 가져온 구조)
  const domainOptions = [
    "음식점",
    "쇼핑몰",
    "병원",
    "은행",
    "학교",
    "카페",
    "호텔",
  ];

  // 검증 상태 옵션들
  const verificationStatusOptions = [
    { value: VerificationStatus.PENDING, label: "검토 대기" },
    { value: VerificationStatus.APPROVED, label: "승인됨" },
    { value: VerificationStatus.REJECTED, label: "거부됨" },
  ];

  // 필터 초기화
  const handleClearFilters = () => {
    setDateFrom("");
    setDateTo("");
    setRecordingIds("");
    setVerificationStatus("");
    setDomain("");
    setTaskType("");
    setLimit(100);
    setTestMode(false);
  };

  // 오늘 날짜를 기본값으로 설정
  const setTodayRange = () => {
    const today = new Date().toISOString().split("T")[0];
    setDateFrom(today);
    setDateTo(today);
  };

  // 최근 7일 설정
  const setWeekRange = () => {
    const today = new Date();
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    setDateFrom(weekAgo.toISOString().split("T")[0]);
    setDateTo(today.toISOString().split("T")[0]);
  };

  // 활성 필터 개수 계산
  const activeFiltersCount = [
    validationMode === "dateRange" ? dateFrom && dateTo : recordingIds.trim(),
    verificationStatus,
    domain,
    taskType,
  ].filter(Boolean).length;

  const handleExecuteValidation = () => {
    // 1. 입력값 검증
    if (validationMode === "dateRange") {
      if (!dateFrom || !dateTo) {
        alert("날짜 범위를 선택해주세요.");
        return;
      }
    } else {
      if (!recordingIds.trim()) {
        alert("검증할 레코딩 ID를 입력해주세요.");
        return;
      }
    }

    // 2. request 객체 생성
    const request: LLMValidationRequest = {
      testMode,
    };

    if (validationMode === "dateRange") {
      request.dateRange = {
        from: dateFrom,
        to: dateTo,
      };
    } else {
      request.recordingIds = recordingIds
        .split(",")
        .map((id) => id.trim())
        .filter((id) => id.length > 0);
    }

    // 필터 조건 추가
    const filters: any = {};
    if (verificationStatus) filters.verificationStatus = verificationStatus;
    if (domain) filters.domain = domain;
    if (taskType) filters.taskType = taskType;
    if (limit) filters.limit = limit;

    if (Object.keys(filters).length > 0) {
      request.filters = filters;
    }

    // 3. 부모 함수 호출 (API 호출은 부모가 담당)
    onValidationRequest(request);
  };

  const handleLoadExistingData = () => {
    // 검증 로직 (기존과 동일)
    if (validationMode === "dateRange") {
      if (!dateFrom || !dateTo) {
        alert("날짜 범위를 선택해주세요.");
        return;
      }
    } else {
      if (!recordingIds.trim()) {
        alert("검증할 레코딩 ID를 입력해주세요.");
        return;
      }
    }

    // request 객체 생성
    const request: LLMValidationRequest = {
      testMode,
    };

    if (validationMode === "dateRange") {
      request.dateRange = {
        from: dateFrom,
        to: dateTo,
      };
    } else {
      request.recordingIds = recordingIds
        .split(",")
        .map((id) => id.trim())
        .filter((id) => id.length > 0);
    }

    // 필터 조건 추가
    const filters: any = {};
    if (verificationStatus) filters.verificationStatus = verificationStatus;
    if (domain) filters.domain = domain;
    if (taskType) filters.taskType = taskType;
    if (limit) filters.limit = limit;

    if (Object.keys(filters).length > 0) {
      request.filters = filters;
    }

    // 부모 함수 호출
    onLoadExistingData(request);
  };

  return (
    <div className={styles.filtersContainer}>
      {/* 검증 모드 선택 */}
      <div className={styles.searchSection}>
        <div className={styles.searchInputGroup}>
          <button
            type="button"
            onClick={() =>
              setValidationMode(
                validationMode === "dateRange" ? "recordingIds" : "dateRange"
              )
            }
            className={styles.searchModeToggle}
            title={`현재: ${
              validationMode === "dateRange" ? "날짜 범위" : "ID 목록"
            } 검증`}
          >
            {validationMode === "dateRange" ? "📅" : "🆔"}
          </button>

          {validationMode === "dateRange" ? (
            <div className={styles.dateRangeGroup}>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className={styles.searchInput}
              />
              <span className={styles.dateRangeSeparator}>~</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className={styles.searchInput}
              />
              <button
                onClick={setTodayRange}
                className={styles.datePresetButton}
                type="button"
              >
                오늘
              </button>
              <button
                onClick={setWeekRange}
                className={styles.datePresetButton}
                type="button"
              >
                최근 7일
              </button>
            </div>
          ) : (
            <textarea
              ref={recordingIdsRef}
              placeholder="검증할 레코딩 ID를 쉼표로 구분하여 입력하세요&#10;예: rec1, rec2, rec3"
              value={recordingIds}
              onChange={(e) => setRecordingIds(e.target.value)}
              className={styles.recordingIdsInput}
              rows={3}
            />
          )}
        </div>

        <div className={styles.searchHelp}>
          💡{" "}
          {validationMode === "dateRange"
            ? "날짜 범위를 선택하여 해당 기간의 레코딩을 검증합니다"
            : "특정 레코딩 ID들을 쉼표로 구분하여 입력하세요"}
        </div>
      </div>

      {/* 필터 섹션 */}
      <div className={styles.filtersSection}>
        <div className={styles.filtersRow}>
          {/* 검증 상태 필터 */}
          <div className={styles.filterGroup}>
            <label className={styles.filterLabel}>검증 상태</label>
            <select
              value={verificationStatus}
              onChange={(e) => setVerificationStatus(e.target.value as any)}
              className={styles.filterSelect}
            >
              <option value="">모든 상태</option>
              {verificationStatusOptions.map((status) => (
                <option key={status.value} value={status.value}>
                  {status.label}
                </option>
              ))}
            </select>
          </div>

          {/* 도메인 필터 */}
          {/* <div className={styles.filterGroup}>
            <label className={styles.filterLabel}>도메인</label>
            <select
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              className={styles.filterSelect}
            >
              <option value="">모든 도메인</option>
              {domainOptions.map((domainOption) => (
                <option key={domainOption} value={domainOption}>
                  {domainOption}
                </option>
              ))}
            </select>
          </div> */}

          {/* 태스크 타입 필터 */}
          {/* <div className={styles.filterGroup}>
            <label className={styles.filterLabel}>발화 타입</label>
            <select
              value={taskType}
              onChange={(e) => setTaskType(e.target.value as any)}
              className={styles.filterSelect}
            >
              <option value="">모든 타입</option>
              <option value="situational">🗣️ 상황발화</option>
              <option value="formal">📝 정형발화</option>
            </select>
          </div> */}

          {/* 처리 제한 */}
          <div className={styles.filterGroup}>
            <label className={styles.filterLabel}>처리 제한</label>
            <select
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
              className={styles.filterSelect}
            >
              <option value={50}>50개</option>
              <option value={100}>100개</option>
              <option value={200}>200개</option>
              <option value={500}>500개</option>
              <option value={1000}>1000개</option>
            </select>
          </div>
        </div>

        {/* 추가 옵션 */}
        <div className={styles.filtersRow}>
          <div className={styles.filterGroup}>
            <label className={styles.filterLabel}>
              <input
                type="checkbox"
                checked={testMode}
                onChange={(e) => setTestMode(e.target.checked)}
                className={styles.checkbox}
              />
              테스트 모드 (실제 LLM 호출 없이 더미 데이터로 테스트)
            </label>
          </div>
        </div>

        {/* 액션 버튼들 */}
        <div className={styles.filterActions}>
          <div className={styles.activeFilters}>
            {activeFiltersCount > 0 && (
              <span className={styles.activeFiltersCount}>
                🔧 {activeFiltersCount}개 필터 활성
              </span>
            )}
          </div>

          <div className={styles.actionButtons}>
            <button
              onClick={handleClearFilters}
              className={styles.clearButton}
              disabled={activeFiltersCount === 0 || isProcessing}
            >
              🧹 필터 초기화
            </button>

            <button
              onClick={handleExecuteValidation}
              className={`${styles.searchButton} ${
                isProcessing ? styles.searching : ""
              }`}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <>
                  <span className={styles.searchSpinner}>🔄</span>
                  검증 진행 중...
                </>
              ) : (
                "🤖 LLM 검증 시작"
              )}
            </button>

            <button
              onClick={handleLoadExistingData}
              className={`${styles.loadDataButton}`}
              disabled={isProcessing || isLoading}
            >
              {isLoading ? <>데이터 로딩 중...</> : "📋 기존 데이터 불러오기"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// 메인 LLM 검증 탭 컴포넌트
const AdminLLMValidationTab = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastResult, setLastResult] = useState<LLMValidationResponse | null>(
    null
  );
  const [processingLog, setProcessingLog] = useState<string[]>([]);

  const [showReviewSection, setShowReviewSection] = useState(false);
  const [reviewData, setReviewData] = useState<ValidationResultItem[]>([]);
  const [updateResult, setUpdateResult] =
    useState<ValidationUpdateResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const [verificationStatus, setVerificationStatus] = useState<
    VerificationStatus | ""
  >("");
  // 검증 상태 옵션들 - enum 기반
  const verificationStatusOptions = [
    { value: VerificationStatus.PENDING, label: "🔄 검토 대기" },
    { value: VerificationStatus.APPROVED, label: "✅ 승인됨" },
    { value: VerificationStatus.REJECTED, label: "❌ 거부됨" },
    { value: VerificationStatus.NEEDS_RETRY, label: "🔁 재시도 필요" },
  ];

  // LLM 검증 요청 처리
  const handleValidationRequest = async (request: LLMValidationRequest) => {
    setIsProcessing(true);
    setProcessingLog([]);

    // 이전 결과들 초기화
    setReviewData([]);
    setShowReviewSection(false);
    setLastResult(null);
    setUpdateResult(null);

    const log = (message: string) => {
      const timestamp = new Date().toLocaleTimeString();
      setProcessingLog((prev) => [...prev, `[${timestamp}] ${message}`]);
    };

    try {
      log("🚀 LLM 검증 요청을 시작합니다...");
      log(
        `📋 검증 모드: ${
          request.recordingIds ? "특정 ID 목록" : "날짜 범위 필터링"
        }`
      );
      log(`🧪 테스트 모드: ${request.testMode ? "활성" : "비활성"}`);

      const response = await fetch("/api/admin/recordings/llm-validation/run", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(request),
      });

      const result: LLMValidationResponse = await response.json();

      if (result.success) {
        log(`✅ 검증 완료: ${result.data?.processedCount}개 처리`);
        log(
          `📊 승인: ${result.data?.approvedCount}개, 반려: ${result.data?.rejectedCount}개`
        );
        log(`⏱️ 처리 시간: ${result.data?.processingTime}ms`);
        const tokenUsage = (result.data as any)?.totalTokenUsage;
        if (tokenUsage) {
          log(`🪙 토큰 사용: ${tokenUsage.total}개`);
        }

        if (result.data?.details && result.data.details.length > 0) {
          const convertedData = result.data.details.map((item: any) => ({
            ...item,
            verificationStatus: item.isApproved
              ? VerificationStatus.APPROVED
              : VerificationStatus.REJECTED,
          }));

          setReviewData(convertedData);
          setShowReviewSection(true);
        }
      } else {
        log(`❌ 검증 실패: ${result.message}`);
      }

      setLastResult(result);
    } catch (error) {
      log(`❌ 요청 실패: ${error}`);
      setLastResult({
        success: false,
        message: `네트워크 오류가 발생했습니다: ${error}`,
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReviewComplete = (result: ValidationUpdateResponse) => {
    setUpdateResult(result);
    setShowReviewSection(false);
    // 로그 업데이트 로직
  };

  const handleCloseReview = () => {
    setShowReviewSection(false);
  };

  // 기존 데이터 로딩 함수 추가
  // 수정된 handleLoadExistingData 함수
  const handleLoadExistingData = async (request: LLMValidationRequest) => {
    setIsLoading(true);
    setProcessingLog([]);

    // 이전 결과들 초기화
    setReviewData([]);
    setShowReviewSection(false);
    setLastResult(null);
    setUpdateResult(null);

    const log = (message: string) => {
      const timestamp = new Date().toLocaleTimeString();
      setProcessingLog((prev) => [...prev, `[${timestamp}] ${message}`]);
    };

    try {
      log("📋 기존 데이터를 불러오는 중...");
      log(
        `📋 검색 모드: ${
          request.recordingIds ? "특정 ID 목록" : "날짜 범위 필터링"
        }`
      );

      // GET API 호출
      const queryParams = new URLSearchParams();

      if (request.dateRange) {
        queryParams.append("dateFrom", request.dateRange.from);
        queryParams.append("dateTo", request.dateRange.to);
      }

      if (request.recordingIds) {
        queryParams.append("recordingIds", request.recordingIds.join(","));
      }

      if (request.filters) {
        Object.entries(request.filters).forEach(([key, value]) => {
          if (value !== undefined && value !== "") {
            queryParams.append(key, String(value));
          }
        });
      }

      const response = await fetch(
        `/api/admin/recordings/llm-validation/get?${queryParams.toString()}`
      );
      const result = await response.json();

      if (result.success && result.data) {
        // API에서 반환된 데이터는 이미 필터링된 상태
        const filteredRecordings = result.data.recordings;

        log(`✅ 데이터 로딩 완료: ${filteredRecordings.length}개 발견`);

        // 실제 반환된 데이터 기준으로 카운트 계산
        const actualPendingCount = filteredRecordings.filter(
          (r: any) => r.verificationStatus === "pending"
        ).length;
        const actualApprovedCount = filteredRecordings.filter(
          (r: any) => r.verificationStatus === "approved"
        ).length;
        const actualRejectedCount = filteredRecordings.filter(
          (r: any) => r.verificationStatus === "rejected"
        ).length;

        log(
          `📊 필터링된 결과 - 대기: ${actualPendingCount}개, 승인: ${actualApprovedCount}개, 반려: ${actualRejectedCount}개`
        );

        // 기존 데이터를 ValidationResultItem 형태로 변환
        const convertedData = filteredRecordings.map((recording: any) => {
          // 상태 결정 로직
          const getVerificationStatus = (): VerificationStatus => {
            // 1. verification.isApproved가 명시적으로 설정된 경우
            if (recording.verification?.isApproved !== undefined) {
              return recording.verification.isApproved
                ? VerificationStatus.APPROVED
                : VerificationStatus.REJECTED;
            }

            // 2. verificationStatus 필드 사용 (enum 값 검증)
            if (
              Object.values(VerificationStatus).includes(
                recording.verificationStatus
              )
            ) {
              return recording.verificationStatus as VerificationStatus;
            }

            // 3. 기본값
            return VerificationStatus.PENDING;
          };

          const status = getVerificationStatus();

          // isApproved 결정
          const getIsApproved = (): boolean | undefined => {
            switch (status) {
              case VerificationStatus.APPROVED:
                return true;
              case VerificationStatus.REJECTED:
                return false;
              case VerificationStatus.PENDING:
              case VerificationStatus.NEEDS_RETRY:
                return undefined;
              default:
                return undefined;
            }
          };
          return {
            recordingId: recording.id,
            verificationStatus:
              recording.verificationStatus || VerificationStatus.PENDING,
            isApproved:
              recording.verification?.isApproved ??
              recording.verificationStatus === "approved",
            reasoning:
              recording.verification?.verifierNotes || "아직 검증하지 않았음",
            confidence: 1.0, // 기존 데이터는 신뢰도 100%로 설정
            textData: {
              originalScript: recording.textData.originalScript || "",
              sttTranscription: recording.textData.sttTranscription || "",
              domain: recording.textData.domain || "",
              intent: recording.textData.intent || "",
              category: recording.textData.category || "",
            },
          };
        });

        log("🔍 기존 데이터를 검토할 수 있습니다.");
        setReviewData(convertedData);
        setShowReviewSection(true);

        // 결과 요약 - 실제 필터링된 데이터 기준으로 수정
        setLastResult({
          success: true,
          data: {
            processedCount: filteredRecordings.length, // 실제 반환된 개수
            approvedCount: actualApprovedCount, // 실제 승인 개수
            rejectedCount: actualRejectedCount, // 실제 반려 개수
            recordingIds: filteredRecordings.map((r: any) => r.id),
            processingTime: 0,
            details: convertedData,
          },
          message: `필터 조건에 맞는 데이터 ${filteredRecordings.length}개를 불러왔습니다.`,
        });
      } else {
        log(`❌ 데이터 로딩 실패: ${result.message}`);
        setLastResult({
          success: false,
          message: result.message || "데이터를 불러올 수 없습니다.",
        });
      }
    } catch (error) {
      log(`❌ 요청 실패: ${error}`);
      setLastResult({
        success: false,
        message: `네트워크 오류가 발생했습니다: ${error}`,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={styles.tableContainer}>
      {/* 헤더 */}
      <div className={styles.tableHeader}>
        <div className={styles.titleRow}>
          <h3>🤖 LLM 검증 시스템</h3>
        </div>
        <div className={styles.statsRow}>
          <span>AI를 활용한 자동 음성 인식 결과 검증</span>
        </div>
      </div>
      {/* 사용법 안내 */}
      <div className={styles.usageGuide}>
        <h4>💡 사용법</h4>
        <ul>
          <li>
            <strong>날짜 범위 모드:</strong> 특정 날짜 범위의 레코딩들을 일괄
            검증
          </li>
          <li>
            <strong>ID 목록 모드:</strong> 특정 레코딩 ID들만 선택적으로 검증
          </li>
          <li>
            <strong>테스트 모드:</strong> 실제 LLM 호출 없이 더미 데이터로 동작
            확인
          </li>
          <li>
            <strong>필터 조건:</strong> 검증 상태, 도메인, 발화 타입으로 대상
            범위 제한
          </li>
        </ul>
      </div>
      {/* LLM 검증 필터 */}
      <LLMValidationFilters
        onValidationRequest={handleValidationRequest}
        onLoadExistingData={handleLoadExistingData}
        isProcessing={isProcessing}
        isLoading={isLoading}
      />

      {/* 결과 표시 */}
      {lastResult && (
        <div className={styles.resultContainer}>
          {lastResult.success ? (
            <></>
          ) : (
            <div className={styles.errorResult}>
              <p>❌ {lastResult.message}</p>
            </div>
          )}
        </div>
      )}

      {updateResult && (
        <div className={styles.updateResultContainer}>
          <h4>🔄 업데이트 결과</h4>

          {updateResult.success ? (
            <div className={styles.successResult}>
              <div className={styles.resultStats}>
                <div className={styles.statItem}>
                  <span className={styles.statLabel}>업데이트됨</span>
                  <span className={styles.statValue}>
                    {updateResult.data?.updatedCount}개
                  </span>
                </div>
                <div className={styles.statItem}>
                  <span className={styles.statLabel}>최종 승인</span>
                  <span className={styles.statValue}>
                    {updateResult.data?.approvedCount}개
                  </span>
                </div>
                <div className={styles.statItem}>
                  <span className={styles.statLabel}>최종 반려</span>
                  <span className={styles.statValue}>
                    {updateResult.data?.rejectedCount}개
                  </span>
                </div>
                {updateResult.data?.skippedCount &&
                  updateResult.data.skippedCount > 0 && (
                    <div className={styles.statItem}>
                      <span className={styles.statLabel}>건너뜀</span>
                      <span className={styles.statValue}>
                        {updateResult.data.skippedCount}개
                      </span>
                    </div>
                  )}
              </div>

              {updateResult.errors && updateResult.errors.length > 0 && (
                <div className={styles.errorsSection}>
                  <h5>⚠️ 부분 실패</h5>
                  <div className={styles.errorsList}>
                    {updateResult.errors.map((error, index) => (
                      <div key={index} className={styles.errorItem}>
                        <span className={styles.errorRecordingId}>
                          {error.recordingId}
                        </span>
                        <span className={styles.errorMessage}>
                          {error.error}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className={styles.errorResult}>
              <p>❌ {updateResult.message}</p>
            </div>
          )}
        </div>
      )}

      {/* 검증 결과 검토 모달 */}
      {showReviewSection && reviewData.length > 0 && (
        <LLMValidationReview
          validationResults={reviewData}
          onUpdateComplete={handleReviewComplete}
          onClose={() => setShowReviewSection(false)}
        />
      )}

      {/* 처리 로그 */}
      {processingLog.length > 0 && (
        <div className={styles.processingLogContainer}>
          <h4>🔍 처리 로그</h4>
          <div className={styles.logContent}>
            {processingLog.map((log, index) => (
              <div key={index} className={styles.logEntry}>
                {log}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminLLMValidationTab;
