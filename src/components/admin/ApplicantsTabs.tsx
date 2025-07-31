import { useState, useEffect } from "react";
import styles from "@/styles/AdminDashboard.module.css";
import { formatFirestoreTimestampKST } from "@/utils/time";
import ApplicantsTabSearchFilters from "@/components/admin/ApplicantsTabSearch";

// 참가 신청자 탭
const ApplicantsTab = () => {
  const [applicants, setApplicants] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [statistics, setStatistics] = useState<any>(null);
  const [filters, setFilters] = useState({
    search: "",
    registered: "" as "" | "true" | "false",
    isActive: "" as "" | "true" | "false",
    sortBy: "createdAt" as "createdAt" | "name" | "lastLogin",
    sortOrder: "desc" as "asc" | "desc",
  });

  console.log("applicants?", applicants);

  // 신청자 목록 조회 함수
  const fetchApplicants = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.search) params.append("search", filters.search);
      if (filters.registered) params.append("registered", filters.registered);
      if (filters.isActive) params.append("isActive", filters.isActive);
      params.append("sortBy", filters.sortBy);
      params.append("sortOrder", filters.sortOrder);

      const response = await fetch(
        `/api/admin/applicants?${params.toString()}`
      );
      const data = await response.json();

      if (data.success) {
        setApplicants(data.data.applicants || []);
        setStatistics(data.data.statistics);
      } else {
        console.error("API 에러:", data.message);
      }
    } catch (error) {
      console.error("신청자 목록 조회 실패:", error);
    } finally {
      setLoading(false);
    }
  };

  // 필터 변경 핸들러
  const handleFiltersChange = (newFilters: typeof filters) => {
    setFilters(newFilters);
  };

  // 필터 변경 시 데이터 다시 조회
  useEffect(() => {
    fetchApplicants();
  }, [filters]);

  // 초기 데이터 로드
  useEffect(() => {
    fetchApplicants();
  }, []);

  // userId 표시용 함수 (앞부분만 보이게)
  const formatUserId = (userId?: string) => {
    if (!userId) return "미등록";
    const parts = userId.split("-");
    if (parts.length > 1) {
      return `${parts[0]}-${parts[1]}...`;
    }
    return userId.length > 10 ? `${userId.substring(0, 10)}...` : userId;
  };

  // 전체 userId 복사 함수
  const copyUserId = (userId?: string, name?: string) => {
    if (userId) {
      navigator.clipboard.writeText(userId);
      // 간단한 토스트 알림 (선택사항)
      console.log(`${name || "사용자"}의 ID가 복사되었습니다: ${userId}`);
    }
  };

  // 상세 정보 보기
  const handleViewDetails = (applicant: any) => {
    const details = `
=== 신청자 상세 정보 ===
이름: ${applicant.name || "미설정"}
사용자 해시: ${applicant.userHash}
등록일: ${
      applicant.createdAt
        ? formatFirestoreTimestampKST(applicant.createdAt)
        : "정보 없음"
    }
진행 가능 여부: ${applicant.isActive ? "참가 가능" : "대기 중"}
동의 및 진행 여부: ${applicant.isRegistered ? "동의 후 진행중" : "미동의"}
사용자 ID: ${applicant.userId || "없음"}
마지막 로그인: ${
      applicant.lastLogin
        ? formatFirestoreTimestampKST(applicant.lastLogin)
        : "로그인 기록 없음"
    }
로그인 시도 횟수: ${applicant.loginAttempts || 0}
출처: ${applicant.source || "정보 없음"}
    `;
    alert(details);
  };

  if (loading) {
    return <div className={styles.loading}>신청자 목록 조회 중...</div>;
  }

  return (
    <div className={styles.tableContainer}>
      {/* 통계 카드 */}
      {statistics && (
        <div className={styles.statsGrid} style={{ marginBottom: "20px" }}>
          <div className={styles.statCard}>
            <h4>전체 신청자</h4>
            <div className={styles.statNumber}>
              {statistics.totalApplicants.toLocaleString()}
            </div>
          </div>
          <div className={styles.statCard}>
            <h4>동의 후 진행중</h4>
            <div className={styles.statNumber}>
              {statistics.registeredCount.toLocaleString()}
            </div>
            <div className={styles.statDescription}>
              {statistics.registrationRate}% 등록률
            </div>
          </div>
          <div className={styles.statCard}>
            <h4>미등록</h4>
            <div className={styles.statNumber}>
              {statistics.unregisteredCount.toLocaleString()}
            </div>
          </div>
        </div>
      )}

      {/* 검색 및 필터 컴포넌트 */}
      <ApplicantsTabSearchFilters onFiltersChange={handleFiltersChange} />

      {/* 테이블 헤더 */}
      <div className={styles.tableHeader}>
        <h3>참가 신청자 목록 ({applicants.length.toLocaleString()}명)</h3>
        <div className={styles.tableActions}>
          <button
            onClick={fetchApplicants}
            className={styles.refreshButton}
            disabled={loading}
          >
            {loading ? "🔄 새로고침 중..." : "🔄 새로고침"}
          </button>
        </div>
      </div>

      {/* 테이블 */}
      <div className={styles.table}>
        <div className={styles.tableHead}>
          <div className={styles.tableRow}>
            <div className={styles.tableCell}>이름</div>
            <div className={styles.tableCell}>등록일</div>
            <div className={styles.tableCell}>진행 가능 여부</div>
            <div className={styles.tableCell}>동의 및 진행 여부</div>
            <div className={styles.tableCell}>마지막 로그인</div>
            <div className={styles.tableCell}>사용자 ID</div>
            <div className={styles.tableCell}>상세</div>
          </div>
        </div>

        <div className={styles.tableBody}>
          {applicants.map((applicant: any) => (
            <div key={applicant.id} className={styles.tableRow}>
              <div className={styles.tableCell}>
                <div className={styles.userInfo}>
                  <strong>{applicant.name || "이름불명"}</strong>
                </div>
              </div>

              <div className={styles.tableCell}>
                {applicant.createdAt
                  ? formatFirestoreTimestampKST(applicant.createdAt)
                  : "정보 없음"}
              </div>

              <div className={styles.tableCell}>
                <span
                  className={`${styles.statusBadge} ${
                    applicant.isActive ? styles.statusGreen : styles.statusGray
                  }`}
                >
                  {applicant.isActive ? "✅ 활성" : "⭕ 비활성"}
                </span>
              </div>

              <div className={styles.tableCell}>
                <span
                  className={`${styles.statusBadge} ${
                    applicant.isRegistered
                      ? styles.statusBlue
                      : styles.statusOrange
                  }`}
                >
                  {applicant.isRegistered ? "등록 완료" : "미등록"}
                </span>
              </div>

              <div className={styles.tableCell}>
                {applicant.lastLogin ? (
                  <div className={styles.dateInfo}>
                    {formatFirestoreTimestampKST(applicant.lastLogin)}
                    {applicant.loginAttempts && (
                      <div className={styles.subText}>
                        시도: {applicant.loginAttempts}회
                      </div>
                    )}
                  </div>
                ) : (
                  <span className={styles.noData}>로그인 기록 없음</span>
                )}
              </div>
              {applicant.userId ? (
                <div className={styles.userIdContainer}>
                  <span
                    className={styles.userIdText}
                    title={`클릭하여 복사: ${applicant.userId}`}
                    onClick={() => copyUserId(applicant.userId, applicant.name)}
                  >
                    {formatUserId(applicant.userId)}
                  </span>
                  <button
                    className={styles.copyButton}
                    onClick={() => copyUserId(applicant.userId, applicant.name)}
                    title="사용자 ID 복사"
                  >
                    📋
                  </button>
                </div>
              ) : (
                <span className={styles.noData}>-</span>
              )}
              <div className={styles.tableCell}>
                <button
                  className={styles.actionButton}
                  onClick={() => handleViewDetails(applicant)}
                  title="상세 정보 보기"
                >
                  상세정보
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 빈 상태 */}
      {applicants.length === 0 && !loading && (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>👥</div>
          <div className={styles.emptyTitle}>신청자가 없습니다</div>
          <div className={styles.emptyDescription}>
            {filters.search || filters.registered || filters.isActive
              ? "검색 조건에 맞는 신청자가 없습니다. 필터를 조정해보세요."
              : "아직 참가 신청한 사용자가 없습니다."}
          </div>
        </div>
      )}
    </div>
  );
};

export default ApplicantsTab;
