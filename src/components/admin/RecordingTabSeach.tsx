import { useState, useEffect, useRef } from "react";
import styles from "@/styles/AdminDashboard.module.css";
import { SERVICE_ORDER } from "@/lib/serviceMapping";
interface SearchFiltersProps {
  onFiltersChange: (filters: {
    search: string;
    taskType: "" | "situational" | "formal";
    domain: string;
    quality?: "high" | "medium" | "low" | "";
    verificationStatus?: string;
  }) => void;
}

const RecordingTabSearchFilters = ({ onFiltersChange }: SearchFiltersProps) => {
  // 🔍 검색 상태들
  const [searchInput, setSearchInput] = useState("");
  const [taskType, setTaskType] = useState<"" | "situational" | "formal">("");
  const [domain, setDomain] = useState("");
  const [quality, setQuality] = useState<"high" | "medium" | "low" | "">("");
  const [verificationStatus, setVerificationStatus] = useState("");

  // 🎯 검색 모드 및 상태 관리
  const [isSearching, setIsSearching] = useState(false);
  const [searchMode, setSearchMode] = useState<"userName" | "userId">(
    "userName"
  );
  const searchInputRef = useRef<HTMLInputElement>(null);

  // 🔄 디바운스를 위한 타이머
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // 🏷️ 도메인 옵션들 (실제 데이터에 맞게 수정 필요)
  const domainOptions = SERVICE_ORDER;

  // 검증 상태 옵션들
  const verificationStatusOptions = [
    { value: "pending", label: "검토 대기" },
    { value: "approved", label: "승인됨" },
    { value: "rejected", label: "거부됨" },
    { value: "needs_review", label: "재검토 필요" },
  ];

  // 🔍 검색 실행 함수
  const executeSearch = () => {
    setIsSearching(true);
    onFiltersChange({
      search: searchInput.trim(),
      taskType,
      domain,
      quality,
      verificationStatus,
    });

    // 검색 상태 리셋 (UX를 위한 짧은 딜레이)
    setTimeout(() => setIsSearching(false), 300);
  };

  // 🔄 디바운스된 검색 (실시간 검색)
  const handleSearchInputChange = (value: string) => {
    setSearchInput(value);
  };

  // 엔터키 검색
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      executeSearch();
    }
  };

  // 필터 변경 핸들러들 (즉시 적용)
  const handleFilterChange = (filterType: string, value: any) => {
    const newFilters = {
      search: searchInput.trim(),
      taskType,
      domain,
      quality,
      verificationStatus,
    };

    switch (filterType) {
      case "taskType":
        setTaskType(value);
        newFilters.taskType = value;
        break;
      case "domain":
        setDomain(value);
        newFilters.domain = value;
        break;
      case "quality":
        setQuality(value);
        newFilters.quality = value;
        break;
      case "verificationStatus":
        setVerificationStatus(value);
        newFilters.verificationStatus = value;
        break;
    }
  };

  // 🧹 필터 초기화
  const handleClearFilters = () => {
    setSearchInput("");
    setTaskType("");
    setDomain("");
    setQuality("");
    setVerificationStatus("");

    onFiltersChange({
      search: "",
      taskType: "",
      domain: "",
      quality: "",
      verificationStatus: "",
    });

    // 검색 입력창에 포커스
    searchInputRef.current?.focus();
  };

  // 🎯 검색 모드 토글
  const toggleSearchMode = () => {
    setSearchMode((prev) => (prev === "userName" ? "userId" : "userName"));
    setSearchInput(""); // 검색어 초기화
  };

  // 활성 필터 개수 계산
  const activeFiltersCount = [
    searchInput.trim(),
    taskType,
    domain,
    quality,
    verificationStatus,
  ].filter(Boolean).length;

  // 컴포넌트 언마운트 시 타이머 정리
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  return (
    <div className={styles.filtersContainer}>
      {/* 검색 섹션 */}
      <div className={styles.searchSection}>
        <div className={styles.searchInputGroup}>
          {/* 검색 모드 토글 */}
          <button
            type="button"
            onClick={toggleSearchMode}
            className={styles.searchModeToggle}
            title={`현재: ${
              searchMode === "userName" ? "사용자명" : "사용자ID"
            } 검색`}
          >
            {searchMode === "userName" ? "👤" : "🆔"}
          </button>

          {/* 검색 입력창 */}
          <input
            ref={searchInputRef}
            type="text"
            placeholder={`${
              searchMode === "userName" ? "사용자명" : "사용자 ID"
            }으로 검색...`}
            value={searchInput}
            onChange={(e) => handleSearchInputChange(e.target.value)}
            onKeyPress={handleKeyPress}
            className={styles.searchInput}
          />

          {/* 검색 버튼 */}
          <button
            onClick={executeSearch}
            className={`${styles.searchButton} ${
              isSearching ? styles.searching : ""
            }`}
            disabled={isSearching}
          >
            {isSearching ? (
              <span className={styles.searchSpinner}>🔄</span>
            ) : (
              "🔍 검색"
            )}
          </button>
        </div>

        {/* 검색 도움말 */}
        <div className={styles.searchHelp}>
          💡 검색하려면 🔍 검색 버튼을 클릭하거나 Enter 키를 누르세요
        </div>
      </div>

      {/* 필터 섹션 */}
      <div className={styles.filtersSection}>
        <div className={styles.filtersRow}>
          {/* 태스크 타입 필터 */}
          <div className={styles.filterGroup}>
            <label className={styles.filterLabel}>발화 타입</label>
            <select
              value={taskType}
              onChange={(e) =>
                handleFilterChange(
                  "taskType",
                  e.target.value as "" | "situational" | "formal"
                )
              }
              className={styles.filterSelect}
            >
              <option value="">모든 타입</option>
              <option value="situational">🗣️ 상황발화</option>
              <option value="formal">📝 정형발화</option>
            </select>
          </div>

          {/* 도메인 필터 */}
          <div className={styles.filterGroup}>
            <label className={styles.filterLabel}>도메인</label>
            <select
              value={domain}
              onChange={(e) => handleFilterChange("domain", e.target.value)}
              className={styles.filterSelect}
            >
              <option value="">모든 도메인</option>
              {domainOptions.map((domainOption) => (
                <option key={domainOption} value={domainOption}>
                  {domainOption}
                </option>
              ))}
            </select>
          </div>

          {/* 품질 필터 */}
          <div className={styles.filterGroup}>
            <label className={styles.filterLabel}>품질 등급</label>
            <select
              value={quality}
              onChange={(e) => handleFilterChange("quality", e.target.value)}
              className={styles.filterSelect}
            >
              <option value="">모든 품질</option>
              <option value="high">🟢 높음</option>
              <option value="medium">🟡 보통</option>
              <option value="low">🔴 낮음</option>
            </select>
          </div>

          {/* 검증 상태 필터 */}
          <div className={styles.filterGroup}>
            <label className={styles.filterLabel}>검증 상태</label>
            <select
              value={verificationStatus}
              onChange={(e) =>
                handleFilterChange("verificationStatus", e.target.value)
              }
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
        </div>

        {/* 필터 액션 버튼들 */}
        <div className={styles.filterActions}>
          <div className={styles.activeFilters}>
            {activeFiltersCount > 0 && (
              <span className={styles.activeFiltersCount}>
                🔧 {activeFiltersCount}개 필터 활성
              </span>
            )}
          </div>

          <button
            onClick={handleClearFilters}
            className={styles.clearButton}
            disabled={activeFiltersCount === 0}
          >
            🧹 필터 초기화
          </button>
        </div>
      </div>
    </div>
  );
};

export default RecordingTabSearchFilters;
