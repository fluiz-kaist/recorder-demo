// pages/api/admin/participants/approveUser.ts
import { NextApiRequest, NextApiResponse } from "next";
import { getDocByIdAdmin, updateDocByIdAdmin } from "@/lib/firebase/firestoreAdmin";
import { FieldValue } from "firebase-admin/firestore";
import { RoundStatus } from "@/types/user";

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

/**
 * 단일 사용자 승인 처리 함수
 */
async function approveUserRound(userId: string, roundNumber: number): Promise<ApprovalResponse> {
  try {
    const now = FieldValue.serverTimestamp();
    const collectionName = process.env.NEXT_PUBLIC_DB_USER_COLLECTION || "users-temp";

    // 1. 사용자 데이터 조회
    const userData = await getDocByIdAdmin(collectionName, userId);
    if (!userData) {
      throw new Error(`사용자 정보를 찾을 수 없습니다: ${userId}`);
    }

    const maxRounds = userData.settings?.maxAllowedRounds || 2;
    const currentRoundNumber = userData.currentStatus?.currentRoundNumber;

    // 2. 승인 대상 라운드 검증
    if (roundNumber !== currentRoundNumber) {
      throw new Error(
        `승인 대상 라운드 불일치: 요청=${roundNumber}, 현재=${currentRoundNumber}`
      );
    }

    // 3. 현재 라운드 상태 확인
    const currentRoundSummary = userData.roundSummaries?.find(
      (summary: any) => summary.roundNumber === roundNumber
    );
    
    if (!currentRoundSummary || currentRoundSummary.status !== "submitted") {
      throw new Error(
        `승인할 수 없는 상태입니다. 현재 상태: ${currentRoundSummary?.status || "없음"}`
      );
    }

    // 4. roundSummaries 업데이트
    const updatedSummaries = userData.roundSummaries.map((summary: any) => {
      if (summary.roundNumber === roundNumber) {
        return {
          ...summary,
          status: RoundStatus.COMPLETED,
          approvedAt: now,
        };
      }
      return summary;
    });

    const isLastRound = roundNumber >= maxRounds;

    // 5. 사용자 상태 업데이트 데이터 준비
    let userUpdates: any;

    if (isLastRound) {
      // 마지막 라운드 승인 - 모든 작업 완료
      userUpdates = {
        "currentStatus.currentRoundNumber": roundNumber + 1, // maxRounds보다 큰 값
        "currentStatus.canStartRecording": false,
        "currentStatus.canStartNextRound": false,
        "currentStatus.hasPendingApproval": false,
        "currentStatus.nextTask": null,
        roundSummaries: updatedSummaries,
        updatedAt: now,
      };
    } else {
      // 중간 라운드 승인 - 다음 라운드 진행 가능
      userUpdates = {
        "currentStatus.currentRoundNumber": roundNumber + 1,
        "currentStatus.canStartRecording": true,
        "currentStatus.canStartNextRound": true,
        "currentStatus.hasPendingApproval": false,
        "currentStatus.nextTask": null,
        "currentStatus.currentRoundProgress": {
          completedPercentage: 0,
          submittedPercentage: 0,
          approvedPercentage: 0,
        },
        roundSummaries: updatedSummaries,
        updatedAt: now,
      };
    }

    // 6. Firebase 업데이트 실행
    await updateDocByIdAdmin(collectionName, userId, userUpdates);

    console.log(`✅ ${roundNumber}라운드 승인 완료 - 사용자 ${userId}`);
    console.log(`📊 새 상태: ${isLastRound ? 'ALL_COMPLETED' : 'CAN_START_NEXT_ROUND'}`);

    return {
      success: true,
      userId,
      roundNumber,
      isLastRound,
      newRoundNumber: roundNumber + 1,
      newStatus: isLastRound ? 'ALL_COMPLETED' : 'CAN_START_NEXT_ROUND',
      message: isLastRound
        ? "모든 라운드 완료"
        : `${roundNumber + 1}라운드 진행 가능`,
    };

  } catch (error) {
    console.error(`❌ 승인 처리 실패 - ${userId}:`, error);
    return {
      success: false,
      userId,
      roundNumber,
      error: error instanceof Error ? error.message : "알 수 없는 오류",
    };
  }
}

/**
 * API 핸들러
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApprovalResponse | ApprovalResponse[]>
) {
  if (req.method !== "POST") {
    return res.status(405).json({ 
      success: false, 
      error: "Method not allowed" 
    });
  }

  try {
    // TODO: 관리자 인증 검증
    // const isAdmin = await verifyAdminAuth(req);
    // if (!isAdmin) {
    //   return res.status(403).json({ 
    //     success: false, 
    //     error: "관리자 권한이 필요합니다" 
    //   });
    // }

    const body = req.body;

    // 단일 승인 처리
    if (body.userId && body.roundNumber) {
      const { userId, roundNumber } = body as ApprovalRequest;
      const result = await approveUserRound(userId, roundNumber);
      return res.status(result.success ? 200 : 400).json(result);
    }

    // 일괄 승인 처리
    if (Array.isArray(body.approvalList)) {
      const approvalList = body.approvalList as ApprovalRequest[];
      
      console.log(`🚀 일괄 승인 요청: ${approvalList.length}명`);

      const results = await Promise.allSettled(
        approvalList.map(({ userId, roundNumber }) =>
          approveUserRound(userId, roundNumber)
        )
      );

      const responses = results.map((result, index) => {
        if (result.status === "fulfilled") {
          return result.value;
        } else {
          return {
            success: false,
            userId: approvalList[index].userId,
            roundNumber: approvalList[index].roundNumber,
            error: "Promise rejected",
          };
        }
      });

      const successCount = responses.filter(r => r.success).length;
      const failedCount = responses.length - successCount;

      console.log(`📈 일괄 승인 완료: 성공 ${successCount}명, 실패 ${failedCount}명`);

      return res.status(200).json(responses);
    }

    return res.status(400).json({
      success: false,
      error: "잘못된 요청 형식입니다",
    });

  } catch (error) {
    console.error("❌ API 처리 중 오류:", error);
    return res.status(500).json({
      success: false,
      error: "서버 내부 오류가 발생했습니다",
    });
  }
}