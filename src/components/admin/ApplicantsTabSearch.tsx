import { useState, useEffect, useRef } from "react";
import styles from "@/styles/AdminDashboard.module.css";

interface SearchFiltersProps {
  onFiltersChange: (filters: {
    search: string;
    registered: "" | "true" | "false";
    isActive: "" | "true" | "false";
    sortBy: "createdAt" | "name" | "lastLogin";
    sortOrder: "asc" | "desc";
  }) => void;
}

const ApplicantsTabSearchFilters = ({
  onFiltersChange,
}: SearchFiltersProps) => {
  // 🔍 검색 상태들
  const [searchInput, setSearchInput] = useState("");
  const [registered, setRegistered] = useState<"" | "true" | "false">("");
  const [isActive, setIsActive] = useState<"" | "true" | "false">("");
  const [sortBy, setSortBy] = useState<"createdAt" | "name" | "lastLogin">(
    "createdAt"
  );
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // 🎯 검색 모드 및 상태 관리
  const [isSearching, setIsSearching] = useState(false);
  const [searchMode, setSearchMode] = useState<"name" | "userHash">("name");
  const searchInputRef = useRef<HTMLInputElement>(null);

  // 🔄 디바운스를 위한 타이머
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // 정렬 옵션들
  const sortOptions = [
    { value: "createdAt", label: "📅 등록일" },
    { value: "name", label: "👤 이름" },
    { value: "lastLogin", label: "🕐 마지막 로그인" },
  ];

  // 🔍 검색 실행 함수
  const executeSearch = () => {
    setIsSearching(true);
    onFiltersChange({
      search: searchInput.trim(),
      registered,
      isActive,
      sortBy,
      sortOrder,
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
      registered,
      isActive,
      sortBy,
      sortOrder,
    };

    switch (filterType) {
      case "registered":
        setRegistered(value);
        newFilters.registered = value;
        break;
      case "isActive":
        setIsActive(value);
        newFilters.isActive = value;
        break;
      case "sortBy":
        setSortBy(value);
        newFilters.sortBy = value;
        break;
      case "sortOrder":
        setSortOrder(value);
        newFilters.sortOrder = value;
        break;
    }

    // 필터 변경 시 즉시 적용
    onFiltersChange(newFilters);
  };

  // 🧹 필터 초기화
  const handleClearFilters = () => {
    setSearchInput("");
    setRegistered("");
    setIsActive("");
    setSortBy("createdAt");
    setSortOrder("desc");

    onFiltersChange({
      search: "",
      registered: "",
      isActive: "",
      sortBy: "createdAt",
      sortOrder: "desc",
    });

    // 검색 입력창에 포커스
    searchInputRef.current?.focus();
  };

  // 🎯 검색 모드 토글
  const toggleSearchMode = () => {
    setSearchMode((prev) => (prev === "name" ? "userHash" : "name"));
    setSearchInput(""); // 검색어 초기화
  };

  // 활성 필터 개수 계산
  const activeFiltersCount = [
    searchInput.trim(),
    registered,
    isActive,
    sortBy !== "createdAt" ? sortBy : "",
    sortOrder !== "desc" ? sortOrder : "",
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
            title={`현재: ${searchMode === "name" ? "이름" : "hashKey"} 검색`}
          >
            {searchMode === "name" ? "👤" : "#️⃣"}
          </button>

          {/* 검색 입력창 */}
          <input
            ref={searchInputRef}
            type="text"
            placeholder={`${
              searchMode === "name" ? "이름" : "hashKey"
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
              "검색"
            )}
          </button>
        </div>

        {/* 검색 도움말 */}
        <div className={styles.searchHelp}>
          💡 검색하려면 검색 버튼을 클릭하거나 Enter 키를 누르세요
        </div>
      </div>

      {/* 필터 섹션 */}
      <div className={styles.filtersSection}>
        <div className={styles.filtersRow}>
          {/* 등록 상태 필터 */}
          <div className={styles.filterGroup}>
            <label className={styles.filterLabel}>등록 상태</label>
            <select
              value={registered}
              onChange={(e) =>
                handleFilterChange(
                  "registered",
                  e.target.value as "" | "true" | "false"
                )
              }
              className={styles.filterSelect}
            >
              <option value="">모든 상태</option>
              <option value="true">등록 완료</option>
              <option value="false">미등록</option>
            </select>
          </div>

          {/* 활성 상태 필터 */}
          <div className={styles.filterGroup}>
            <label className={styles.filterLabel}>활성 상태</label>
            <select
              value={isActive}
              onChange={(e) =>
                handleFilterChange(
                  "isActive",
                  e.target.value as "" | "true" | "false"
                )
              }
              className={styles.filterSelect}
            >
              <option value="">모든 상태</option>
              <option value="true">🟢 활성</option>
              <option value="false">🔴 비활성</option>
            </select>
          </div>

          {/* 정렬 기준 */}
          <div className={styles.filterGroup}>
            <label className={styles.filterLabel}>정렬 기준</label>
            <select
              value={sortBy}
              onChange={(e) =>
                handleFilterChange(
                  "sortBy",
                  e.target.value as "createdAt" | "name" | "lastLogin"
                )
              }
              className={styles.filterSelect}
            >
              {sortOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {/* 정렬 순서 */}
          <div className={styles.filterGroup}>
            <label className={styles.filterLabel}>정렬 순서</label>
            <select
              value={sortOrder}
              onChange={(e) =>
                handleFilterChange(
                  "sortOrder",
                  e.target.value as "asc" | "desc"
                )
              }
              className={styles.filterSelect}
            >
              <option value="desc">내림차순</option>
              <option value="asc">오름차순</option>
            </select>
          </div>
        </div>

        {/* 필터 액션 버튼들 */}
        <div className={styles.filterActions}>
          <div className={styles.activeFilters}>
            {activeFiltersCount > 0 && (
              <span className={styles.activeFiltersCount}>
                {activeFiltersCount}개 필터 활성
              </span>
            )}
          </div>

          <button
            onClick={handleClearFilters}
            className={styles.clearButton}
            disabled={activeFiltersCount === 0}
          >
            필터 초기화
          </button>
        </div>
      </div>

      {/* 빠른 필터 버튼들 */}
      <div className={styles.quickFilters}>
        <span className={styles.quickFiltersLabel}>빠른 필터:</span>
        <button
          onClick={() => {
            setRegistered("false");
            setIsActive("");
            handleFilterChange("registered", "false");
          }}
          className={`${styles.quickFilterButton} ${
            registered === "false" ? styles.active : ""
          }`}
        >
          아직 시작 안한 참가자만
        </button>
        <button
          onClick={() => {
            setRegistered("true");
            setIsActive("true");
            handleFilterChange("registered", "true");
            setTimeout(() => handleFilterChange("isActive", "true"), 10);
          }}
          className={`${styles.quickFilterButton} ${
            registered === "true" && isActive === "true" ? styles.active : ""
          }`}
        >
          활성된 참가자만
        </button>
        <button
          onClick={() => {
            setSortBy("lastLogin");
            setSortOrder("desc");
            handleFilterChange("sortBy", "lastLogin");
            setTimeout(() => handleFilterChange("sortOrder", "desc"), 10);
          }}
          className={`${styles.quickFilterButton} ${
            sortBy === "lastLogin" && sortOrder === "desc" ? styles.active : ""
          }`}
        >
          최근 활동순
        </button>
      </div>
    </div>
  );
};

export default ApplicantsTabSearchFilters;
