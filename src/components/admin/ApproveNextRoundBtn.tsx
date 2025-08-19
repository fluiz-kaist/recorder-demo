// components/admin/ApprovedNextRoundBtn.tsx
import React, { useState, useEffect } from "react";
import styles from "@/styles/AdminApproval.module.css";
import { useAdminApproval } from "@/hooks/useAdminApproval";

// ===============================
// 타입 정의
// ===============================

interface PendingUser {
  userId: string;
  userName: string;
  roundNumber: number;
}

interface ApprovalButtonProps {
  userId: string;
  roundNumber: number;
  userName?: string;
  disabled?: boolean;
  onSuccess?: (result: any) => void;
  onError?: (error: string) => void;
}

interface BulkApprovalManagerProps {
  pendingUsers: PendingUser[];
  onApprovalComplete?: () => void;
}

// ===============================
// 세션별 승인 상태 관리
// ===============================

// 이 페이지에서 승인한 사용자들을 추적하는 Set
const approvedInCurrentSession = new Set<string>();

// 승인 키 생성 함수
const getApprovalKey = (userId: string, roundNumber: number) =>
  `${userId}-${roundNumber}`;

// ===============================
// 개별 승인 버튼 컴포넌트
// ===============================

export const ApprovalButton: React.FC<ApprovalButtonProps> = ({
  userId,
  roundNumber,
  userName,
  disabled = false,
  onSuccess,
  onError,
}) => {
  const [isApproving, setIsApproving] = useState(false);
  const [isApproved, setIsApproved] = useState(false);
  const { approveSingleUser, loading } = useAdminApproval();

  const approvalKey = getApprovalKey(userId, roundNumber);

  // 컴포넌트 마운트 시 현재 세션에서 이미 승인되었는지 확인
  useEffect(() => {
    setIsApproved(approvedInCurrentSession.has(approvalKey));
  }, [approvalKey]);

  const handleApproval = async () => {
    if (loading || disabled || isApproved) return;

    const confirmed = confirm(
      `${userName || userId}의 ${roundNumber}라운드를 승인하시겠습니까?`
    );

    if (!confirmed) return;

    setIsApproving(true);

    try {
      const result = await approveSingleUser(userId, roundNumber);

      if (result.success) {
        // 🎯 승인 성공 시 상태 업데이트
        setIsApproved(true);
        approvedInCurrentSession.add(approvalKey);

        onSuccess?.(result);
        console.log(
          `✅ 승인 완료: ${userName || userId} - ${roundNumber}라운드`
        );

        // alert 대신 더 부드러운 피드백
        // alert(`승인 완료: ${result.message}`);
      } else {
        onError?.(result.error || "승인 처리 실패");
        alert(`승인 실패: ${result.error}`);
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "알 수 없는 오류";
      onError?.(errorMessage);
      alert(`승인 실패: ${errorMessage}`);
    } finally {
      setIsApproving(false);
    }
  };

  // 승인 완료된 버튼의 상태 확인
  const isButtonDisabled = disabled || loading || isApproving || isApproved;

  return (
    <button
      onClick={handleApproval}
      disabled={isButtonDisabled}
      className={`
        ${styles.approvalButton}
        ${isApproving ? styles.loading : ""}
        ${isApproved ? styles.approved : ""}
        ${isButtonDisabled ? styles.disabled : ""}
      `}
    >
      {isApproving ? (
        <span>⏳ 승인 중...</span>
      ) : isApproved ? (
        <span>✅ 승인 완료</span>
      ) : (
        <span>{roundNumber}라운드 승인</span>
      )}
    </button>
  );
};

// ===============================
// 일괄 승인 관리 컴포넌트
// ===============================

export const BulkApprovalManager: React.FC<BulkApprovalManagerProps> = ({
  pendingUsers,
  onApprovalComplete,
}) => {
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const { approveBulkUsers, loading: bulkLoading } = useAdminApproval();

  // 이미 승인된 사용자들을 제외한 실제 대기 중인 사용자들
  const actualPendingUsers = pendingUsers.filter(
    (user) =>
      !approvedInCurrentSession.has(
        getApprovalKey(user.userId, user.roundNumber)
      )
  );

  const handleUserToggle = (userId: string) => {
    const newSelected = new Set(selectedUsers);
    if (newSelected.has(userId)) {
      newSelected.delete(userId);
    } else {
      newSelected.add(userId);
    }
    setSelectedUsers(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedUsers.size === actualPendingUsers.length) {
      setSelectedUsers(new Set());
    } else {
      setSelectedUsers(new Set(actualPendingUsers.map((user) => user.userId)));
    }
  };

  const handleBulkApproval = async () => {
    if (selectedUsers.size === 0) {
      alert("승인할 사용자를 선택해주세요.");
      return;
    }

    const confirmed = confirm(
      `선택된 ${selectedUsers.size}명의 사용자를 일괄 승인하시겠습니까?`
    );

    if (!confirmed) return;

    try {
      const approvalList = actualPendingUsers
        .filter((user) => selectedUsers.has(user.userId))
        .map((user) => ({
          userId: user.userId,
          roundNumber: user.roundNumber,
        }));

      const results = await approveBulkUsers(approvalList);
      const successCount = results.filter((r) => r.success).length;
      const failedCount = results.length - successCount;

      // 🎯 성공한 승인들을 세션 상태에 추가
      results.forEach((result) => {
        if (result.success) {
          const user = approvalList.find((u) => u.userId === result.userId);
          if (user) {
            approvedInCurrentSession.add(
              getApprovalKey(user.userId, user.roundNumber)
            );
          }
        }
      });

      alert(`일괄 승인 완료!\n성공: ${successCount}명\n실패: ${failedCount}명`);

      if (failedCount > 0) {
        const failedUsers = results
          .filter((r) => !r.success)
          .map((r) => `${r.userId} (${r.error})`)
          .join("\n");
        console.error("실패한 승인들:", failedUsers);
      }

      setSelectedUsers(new Set());
      onApprovalComplete?.();
    } catch (error) {
      console.error("일괄 승인 오류:", error);
      alert("일괄 승인 중 오류가 발생했습니다.");
    }
  };

  const handleSingleSuccess = () => {
    // 개별 승인 성공 시 체크박스 해제
    onApprovalComplete?.();
  };

  return (
    <div className={styles.bulkApprovalContainer}>
      {/* 승인 현황 표시 */}
      <div className={styles.approvalStatus}>
        <span className={styles.statusText}>
          📊 현재 세션 승인 현황: {approvedInCurrentSession.size}명 승인 완료
        </span>
      </div>

      {/* 일괄 선택 헤더 */}
      <div className={styles.bulkHeader}>
        <div className={styles.selectAllSection}>
          <input
            type="checkbox"
            checked={
              selectedUsers.size === actualPendingUsers.length &&
              actualPendingUsers.length > 0
            }
            onChange={handleSelectAll}
            className={styles.checkbox}
          />
          <span className={styles.selectAllText}>
            전체 선택 ({selectedUsers.size}/{actualPendingUsers.length})
          </span>
        </div>

        <button
          onClick={handleBulkApproval}
          disabled={selectedUsers.size === 0 || bulkLoading}
          className={`
            ${styles.bulkApprovalButton}
            ${selectedUsers.size === 0 || bulkLoading ? styles.disabled : ""}
          `}
        >
          {bulkLoading
            ? "승인 중..."
            : `선택된 ${selectedUsers.size}명 일괄 승인`}
        </button>
      </div>

      {/* 사용자 목록 */}
      <div className={styles.userList}>
        {pendingUsers.map((user) => {
          const isApprovedInSession = approvedInCurrentSession.has(
            getApprovalKey(user.userId, user.roundNumber)
          );

          return (
            <div
              key={user.userId}
              className={`${styles.userItem} ${
                isApprovedInSession ? styles.approvedItem : ""
              }`}
            >
              <div className={styles.userInfo}>
                <input
                  type="checkbox"
                  checked={selectedUsers.has(user.userId)}
                  onChange={() => handleUserToggle(user.userId)}
                  disabled={isApprovedInSession}
                  className={styles.checkbox}
                />
                <div className={styles.userDetails}>
                  <span className={styles.userName}>
                    {user.userName}
                    {isApprovedInSession && (
                      <span className={styles.approvedBadge}>✅</span>
                    )}
                  </span>
                  <span className={styles.roundInfo}>
                    {user.roundNumber}라운드{" "}
                    {isApprovedInSession ? "승인 완료" : "승인 대기"}
                  </span>
                </div>
              </div>

              <ApprovalButton
                userId={user.userId}
                roundNumber={user.roundNumber}
                userName={user.userName}
                disabled={bulkLoading}
                onSuccess={handleSingleSuccess}
                onError={(error) => console.error("개별 승인 실패:", error)}
              />
            </div>
          );
        })}
      </div>

      {/* 빈 상태 */}
      {pendingUsers.length === 0 && (
        <div className={styles.emptyState}>
          <p>승인 대기 중인 사용자가 없습니다.</p>
        </div>
      )}

      {actualPendingUsers.length === 0 && pendingUsers.length > 0 && (
        <div className={styles.allApprovedState}>
          <p>🎉 모든 사용자 승인이 완료되었습니다!</p>
        </div>
      )}
    </div>
  );
};

// ===============================
// 세션 상태 초기화 함수 (필요시 사용)
// ===============================

export const clearApprovalSession = () => {
  approvedInCurrentSession.clear();
  console.log("🔄 승인 세션 상태가 초기화되었습니다.");
};
