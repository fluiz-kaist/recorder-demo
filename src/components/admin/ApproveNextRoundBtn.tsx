// components/admin/ApprovedNextRoundBtn.tsx
import React, { useState } from "react";
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
  const { approveSingleUser, loading } = useAdminApproval();

  const handleApproval = async () => {
    if (loading || disabled) return;

    const confirmed = confirm(
      `${userName || userId}의 ${roundNumber}라운드를 승인하시겠습니까?`
    );
    
    if (!confirmed) return;

    try {
      const result = await approveSingleUser(userId, roundNumber);
      
      if (result.success) {
        onSuccess?.(result);
        alert(`승인 완료: ${result.message}`);
      } else {
        onError?.(result.error || "승인 처리 실패");
        alert(`승인 실패: ${result.error}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "알 수 없는 오류";
      onError?.(errorMessage);
      alert(`승인 실패: ${errorMessage}`);
    }
  };

  return (
    <button
      onClick={handleApproval}
      disabled={disabled || loading}
      className={`
        ${styles.approvalButton}
        ${loading ? styles.loading : ''}
        ${disabled ? styles.disabled : ''}
      `}
    >
      {loading ? "승인 중..." : `${roundNumber}라운드 승인`}
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
    if (selectedUsers.size === pendingUsers.length) {
      setSelectedUsers(new Set());
    } else {
      setSelectedUsers(new Set(pendingUsers.map(user => user.userId)));
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
      const approvalList = pendingUsers
        .filter(user => selectedUsers.has(user.userId))
        .map(user => ({
          userId: user.userId,
          roundNumber: user.roundNumber,
        }));

      const results = await approveBulkUsers(approvalList);
      const successCount = results.filter(r => r.success).length;
      const failedCount = results.length - successCount;
      
      alert(
        `일괄 승인 완료!\n성공: ${successCount}명\n실패: ${failedCount}명`
      );

      if (failedCount > 0) {
        const failedUsers = results
          .filter(r => !r.success)
          .map(r => `${r.userId} (${r.error})`)
          .join('\n');
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
      {/* 일괄 선택 헤더 */}
      <div className={styles.bulkHeader}>
        <div className={styles.selectAllSection}>
          <input
            type="checkbox"
            checked={selectedUsers.size === pendingUsers.length && pendingUsers.length > 0}
            onChange={handleSelectAll}
            className={styles.checkbox}
          />
          <span className={styles.selectAllText}>
            전체 선택 ({selectedUsers.size}/{pendingUsers.length})
          </span>
        </div>
        
        <button
          onClick={handleBulkApproval}
          disabled={selectedUsers.size === 0 || bulkLoading}
          className={`
            ${styles.bulkApprovalButton}
            ${selectedUsers.size === 0 || bulkLoading ? styles.disabled : ''}
          `}
        >
          {bulkLoading ? "승인 중..." : `선택된 ${selectedUsers.size}명 일괄 승인`}
        </button>
      </div>

      {/* 사용자 목록 */}
      <div className={styles.userList}>
        {pendingUsers.map((user) => (
          <div key={user.userId} className={styles.userItem}>
            <div className={styles.userInfo}>
              <input
                type="checkbox"
                checked={selectedUsers.has(user.userId)}
                onChange={() => handleUserToggle(user.userId)}
                className={styles.checkbox}
              />
              <div className={styles.userDetails}>
                <span className={styles.userName}>{user.userName}</span>
                <span className={styles.roundInfo}>
                  {user.roundNumber}라운드 승인 대기
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
        ))}
      </div>

      {/* 빈 상태 */}
      {pendingUsers.length === 0 && (
        <div className={styles.emptyState}>
          <p>승인 대기 중인 사용자가 없습니다.</p>
        </div>
      )}
    </div>
  );
};