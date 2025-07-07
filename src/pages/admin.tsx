// pages/admin.tsx - 관리자 어드민 페이지
import React, { useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import styles from "@/styles/Admin.module.css";
import {
  useAdminStatsQuery,
  useAllUsersQuery,
  useScriptStatsQuery,
} from "@/hooks/queries/useAdminQueries";
import {
  useInitScriptsMutation,
  useDeleteUserMutation,
  useClearAllDataMutation,
} from "@/hooks/mutations/useAdminMutations";
import { User, ScriptType } from "@/types/firebase";

// 관리자 인증 상태
const AdminPage = () => {
  const router = useRouter();
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState<string | null>(
    null
  );

  // 쿼리 훅들
  const {
    data: adminStats,
    isLoading: statsLoading,
    refetch: refetchStats,
  } = useAdminStatsQuery();
  const {
    data: allUsers,
    isLoading: usersLoading,
    refetch: refetchUsers,
  } = useAllUsersQuery();
  const { data: scriptStats, isLoading: scriptStatsLoading } =
    useScriptStatsQuery();

  // 뮤테이션 훅들
  const initScriptsMutation = useInitScriptsMutation();
  const deleteUserMutation = useDeleteUserMutation();
  const clearAllDataMutation = useClearAllDataMutation();

  // 스크립트 초기화
  const handleInitScripts = async () => {
    if (showConfirmDialog !== "init-scripts") {
      setShowConfirmDialog("init-scripts");
      return;
    }

    try {
      await initScriptsMutation.mutateAsync();
      await refetchStats();
      await refetchUsers();
      setShowConfirmDialog(null);
      alert("스크립트가 초기화되었습니다.");
    } catch (error) {
      console.error("스크립트 초기화 실패:", error);
      alert("스크립트 초기화에 실패했습니다.");
    }
  };

  // 사용자 삭제
  const handleDeleteUser = async (userId: string) => {
    if (showConfirmDialog !== `delete-user-${userId}`) {
      setShowConfirmDialog(`delete-user-${userId}`);
      return;
    }

    try {
      await deleteUserMutation.mutateAsync(userId);
      await refetchUsers();
      await refetchStats();
      setShowConfirmDialog(null);
      alert("사용자가 삭제되었습니다.");
    } catch (error) {
      console.error("사용자 삭제 실패:", error);
      alert("사용자 삭제에 실패했습니다.");
    }
  };

  // 전체 데이터 초기화
  const handleClearAllData = async () => {
    if (showConfirmDialog !== "clear-all") {
      setShowConfirmDialog("clear-all");
      return;
    }

    try {
      await clearAllDataMutation.mutateAsync();
      await refetchStats();
      await refetchUsers();
      setShowConfirmDialog(null);
      alert("모든 데이터가 초기화되었습니다.");
    } catch (error) {
      console.error("전체 데이터 초기화 실패:", error);
      alert("전체 데이터 초기화에 실패했습니다.");
    }
  };

  // 진행률 계산
  const calculateUserProgress = (user: User) => {
    if (!user.scriptAssignments || user.scriptAssignments.length === 0) {
      return { total: 0, completed: 0, progress: 0 };
    }

    const total = user.scriptAssignments.reduce(
      (sum, assignment) => sum + assignment.assignedScriptIds.length,
      0
    );
    const completed = user.scriptAssignments.reduce(
      (sum, assignment) => sum + assignment.completedScriptIds.length,
      0
    );
    const progress = total > 0 ? Math.round((completed / total) * 100) : 0;

    return { total, completed, progress };
  };

  // 스크립트 타입별 진행률
  const getScriptTypeProgress = (user: User, scriptType: ScriptType) => {
    const assignment = user.scriptAssignments?.find(
      (a) => a.scriptType === scriptType
    );
    if (!assignment) return { assigned: 0, completed: 0 };

    return {
      assigned: assignment.assignedScriptIds.length,
      completed: assignment.completedScriptIds.length,
    };
  };

  const isLoading = statsLoading || usersLoading || scriptStatsLoading;

  return (
    <>
      <Head>
        <title>관리자 페이지</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </Head>

      <div className={styles.container}>
        <div className={styles.header}>
          <h1>🔧 관리자 페이지</h1>
          <button
            onClick={() => router.push("/")}
            className={styles.backButton}
          >
            ← 메인으로
          </button>
        </div>

        {isLoading ? (
          <div className={styles.loading}>데이터를 불러오는 중...</div>
        ) : (
          <>
            {/* 전체 통계 */}
            <div className={styles.statsSection}>
              <h2>📊 전체 통계</h2>
              <div className={styles.statsGrid}>
                <div className={styles.statCard}>
                  <div className={styles.statLabel}>등록된 사용자</div>
                  <div className={styles.statValue}>
                    {adminStats?.totalUsers || 0}명
                  </div>
                </div>
                <div className={styles.statCard}>
                  <div className={styles.statLabel}>전체 녹음</div>
                  <div className={styles.statValue}>
                    {adminStats?.totalRecordings || 0}개
                  </div>
                </div>
                <div className={styles.statCard}>
                  <div className={styles.statLabel}>완료된 스크립트</div>
                  <div className={styles.statValue}>
                    {adminStats?.totalCompletedScripts || 0}개
                  </div>
                </div>
                <div className={styles.statCard}>
                  <div className={styles.statLabel}>평균 진행률</div>
                  <div className={styles.statValue}>
                    {adminStats?.averageProgress || 0}%
                  </div>
                </div>
              </div>
            </div>

            {/* 스크립트 통계 */}
            {scriptStats && (
              <div className={styles.scriptStatsSection}>
                <h2>📝 스크립트 사용 현황</h2>
                <div className={styles.scriptStatsGrid}>
                  <div className={styles.scriptStatCard}>
                    <h3>정식 스크립트</h3>
                    <div>전체: {scriptStats.formal.total}개</div>
                    <div>사용 가능: {scriptStats.formal.available}개</div>
                    <div>할당됨: {scriptStats.formal.used}개</div>
                  </div>
                  <div className={styles.scriptStatCard}>
                    <h3>Q&A 시나리오</h3>
                    <div>전체: {scriptStats.qaScenario.total}개</div>
                    <div>사용 가능: {scriptStats.qaScenario.available}개</div>
                    <div>할당됨: {scriptStats.qaScenario.used}개</div>
                  </div>
                  <div className={styles.scriptStatCard}>
                    <h3>상황별 스크립트</h3>
                    <div>전체: {scriptStats.situational.total}개</div>
                    <div>사용 가능: {scriptStats.situational.available}개</div>
                    <div>할당됨: {scriptStats.situational.used}개</div>
                  </div>
                </div>
              </div>
            )}

            {/* 관리 도구 */}
            <div className={styles.toolsSection}>
              <h2>🛠️ 관리 도구</h2>
              <div className={styles.toolsGrid}>
                <button
                  onClick={handleInitScripts}
                  disabled={initScriptsMutation.isPending}
                  className={`${styles.toolButton} ${styles.warning}`}
                >
                  {initScriptsMutation.isPending
                    ? "처리 중..."
                    : "🔄 스크립트 초기화"}
                </button>

                <button
                  onClick={handleClearAllData}
                  disabled={clearAllDataMutation.isPending}
                  className={`${styles.toolButton} ${styles.danger}`}
                >
                  {clearAllDataMutation.isPending
                    ? "처리 중..."
                    : "🗑️ 전체 데이터 삭제"}
                </button>

                <button
                  onClick={() => {
                    refetchStats();
                    refetchUsers();
                  }}
                  className={styles.toolButton}
                >
                  📊 데이터 새로고침
                </button>
              </div>
            </div>

            {/* 사용자 목록 */}
            <div className={styles.usersSection}>
              <h2>👥 사용자 목록 ({allUsers?.length || 0}명)</h2>

              {allUsers && allUsers.length > 0 ? (
                <div className={styles.usersTable}>
                  <div className={styles.tableHeader}>
                    <div>사용자 ID</div>
                    <div>성별/연령대</div>
                    <div>가입일</div>
                    <div>진행률</div>
                    <div>스크립트 현황</div>
                    <div>관리</div>
                  </div>

                  {allUsers.map((user) => {
                    const progress = calculateUserProgress(user);
                    const formalProgress = getScriptTypeProgress(
                      user,
                      ScriptType.FORMAL
                    );
                    const qaProgress = getScriptTypeProgress(
                      user,
                      ScriptType.QA_SCENARIO
                    );
                    const situationalProgress = getScriptTypeProgress(
                      user,
                      ScriptType.SITUATIONAL
                    );

                    return (
                      <div key={user.id} className={styles.tableRow}>
                        <div className={styles.userId}>
                          {user.id.substring(0, 12)}...
                        </div>
                        <div>
                          {user.gender} / {user.ageGroup}
                        </div>
                        <div>
                          {new Date(user.createdAt).toLocaleDateString()}
                        </div>
                        <div>
                          <div className={styles.progressBar}>
                            <div
                              className={styles.progressFill}
                              style={{ width: `${progress.progress}%` }}
                            ></div>
                          </div>
                          <div className={styles.progressText}>
                            {progress.completed}/{progress.total} (
                            {progress.progress}%)
                          </div>
                        </div>
                        <div className={styles.scriptProgress}>
                          <div>
                            정식: {formalProgress.completed}/
                            {formalProgress.assigned}
                          </div>
                          <div>
                            Q&A: {qaProgress.completed}/{qaProgress.assigned}
                          </div>
                          <div>
                            상황: {situationalProgress.completed}/
                            {situationalProgress.assigned}
                          </div>
                        </div>
                        <div>
                          <button
                            onClick={() => setSelectedUser(user)}
                            className={styles.viewButton}
                          >
                            상세보기
                          </button>
                          <button
                            onClick={() => handleDeleteUser(user.id)}
                            disabled={deleteUserMutation.isPending}
                            className={styles.deleteButton}
                          >
                            삭제
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className={styles.noUsers}>등록된 사용자가 없습니다.</div>
              )}
            </div>

            {/* 확인 다이얼로그 */}
            {showConfirmDialog && (
              <div className={styles.confirmDialog}>
                <div className={styles.confirmContent}>
                  <h3>⚠️ 확인</h3>
                  <p>
                    {showConfirmDialog === "init-scripts" &&
                      "모든 스크립트 할당을 초기화하시겠습니까?"}
                    {showConfirmDialog === "clear-all" &&
                      "모든 사용자 데이터와 녹음을 삭제하시겠습니까?"}
                    {showConfirmDialog.startsWith("delete-user") &&
                      "이 사용자를 삭제하시겠습니까?"}
                  </p>
                  <div className={styles.confirmButtons}>
                    <button onClick={() => setShowConfirmDialog(null)}>
                      취소
                    </button>
                    <button
                      onClick={
                        showConfirmDialog === "init-scripts"
                          ? handleInitScripts
                          : showConfirmDialog === "clear-all"
                          ? handleClearAllData
                          : () =>
                              handleDeleteUser(showConfirmDialog.split("-")[2])
                      }
                      className={styles.confirmButton}
                    >
                      확인
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* 사용자 상세 정보 모달 */}
            {selectedUser && (
              <div className={styles.userModal}>
                <div className={styles.userModalContent}>
                  <div className={styles.userModalHeader}>
                    <h3>사용자 상세 정보</h3>
                    <button onClick={() => setSelectedUser(null)}>✕</button>
                  </div>
                  <div className={styles.userDetails}>
                    <div>
                      <strong>ID:</strong> {selectedUser.id}
                    </div>
                    <div>
                      <strong>성별:</strong> {selectedUser.gender}
                    </div>
                    <div>
                      <strong>연령대:</strong> {selectedUser.ageGroup}
                    </div>
                    <div>
                      <strong>가입일:</strong>{" "}
                      {new Date(selectedUser.createdAt).toLocaleString()}
                    </div>
                    <div>
                      <strong>마지막 접속:</strong>{" "}
                      {new Date(selectedUser.lastAccessAt).toLocaleString()}
                    </div>
                    <div>
                      <strong>동의 여부:</strong>{" "}
                      {selectedUser.hasConsented ? "동의함" : "동의 안함"}
                    </div>

                    <h4>스크립트 할당 현황</h4>
                    {selectedUser.scriptAssignments?.map(
                      (assignment, index) => (
                        <div key={index} className={styles.assignmentDetail}>
                          <div>
                            <strong>{assignment.scriptType}:</strong>
                          </div>
                          <div>
                            할당: {assignment.assignedScriptIds.join(", ")}
                          </div>
                          <div>
                            완료: {assignment.completedScriptIds.join(", ")}
                          </div>
                          <div>
                            할당일:{" "}
                            {new Date(assignment.assignedAt).toLocaleString()}
                          </div>
                        </div>
                      )
                    )}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
};

export default AdminPage;
