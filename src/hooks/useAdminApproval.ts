// hooks/useAdminApproval.ts
import { useState } from "react";

interface ApprovalRequest {
  userId: string;
  roundNumber: number;
}

interface ApprovalResponse {
  success: boolean;
  userId?: string;
  roundNumber?: number;
  isLastRound?: boolean;
  newRoundNumber?: number;
  newStatus?: string;
  message?: string;
  error?: string;
}

export const useAdminApproval = () => {
  const [loading, setLoading] = useState(false);

  /**
   * 단일 사용자 승인
   */
  const approveSingleUser = async (
    userId: string,
    roundNumber: number
  ): Promise<ApprovalResponse> => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/participants/approveUser", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId,
          roundNumber,
        }),
      });

      const result: ApprovalResponse = await response.json();
      return result;
    } catch (error) {
      console.error("승인 요청 실패:", error);
      return {
        success: false,
        error: "네트워크 오류가 발생했습니다",
      };
    } finally {
      setLoading(false);
    }
  };

  /**
   * 일괄 사용자 승인
   */
  const approveBulkUsers = async (
    approvalList: ApprovalRequest[]
  ): Promise<ApprovalResponse[]> => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/participants/approveUser", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          approvalList,
        }),
      });

      const results: ApprovalResponse[] = await response.json();
      return results;
    } catch (error) {
      console.error("일괄 승인 요청 실패:", error);
      return approvalList.map((item) => ({
        success: false,
        userId: item.userId,
        roundNumber: item.roundNumber,
        error: "네트워크 오류가 발생했습니다",
      }));
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    approveSingleUser,
    approveBulkUsers,
  };
};
