// pages/api/admin/recordings/llm-validation/get.ts
import { NextApiRequest, NextApiResponse } from "next";
import { adminDb } from "@/lib/firebase/admin";
import { Timestamp } from "firebase-admin/firestore";
import { getRecordingsByFilters } from "@/lib/firebase/firestoreAdmin";
import { VerificationStatus } from "@/types/audio";
// GET 응답 타입
interface LLMValidationGetResponse {
  success: boolean;
  data?: {
    recordings: Array<{
      id: string;
      taskKey: string;
      textData: {
        originalScript: string;
        sttTranscription: string;
        domain: string;
        intent: string;
        category: string;
      };
      verificationStatus: VerificationStatus;
      uploadedAt: string;
      verification?: {
        verifiedAt?: string;
        verifiedBy?: string;
        verificationMethod?: string;
        isApproved?: boolean;
        verifierNotes?: string;
      };
    }>;
    totalCount: number;
    summary: {
      pendingCount: number;
      approvedCount: number;
      rejectedCount: number;
      retryCount: number;
      dateRange?: {
        from: string;
        to: string;
      };
    };
    qualityCheck?: any;
  };
  message?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<LLMValidationGetResponse>
) {
  const audioCollectionName =
    process.env.NEXT_PUBLIC_DB_AUDIO_RECORDINGS_COLLECTION || "recording-temp";

  try {
    // 관리자 권한 확인
    const adminToken = req.cookies["admin-token"];
    if (!adminToken) {
      return res.status(401).json({
        success: false,
        message: "관리자 권한이 필요합니다.",
      });
    }

    if (req.method === "GET") {
      // 이제 handleGetRequest가 분리된 함수를 호출하도록 변경합니다.
      return await handleGetRequest(req, res, audioCollectionName);
    } else {
      return res.status(405).json({
        success: false,
        message: "Method not allowed. Use GET or POST.",
      } as LLMValidationGetResponse);
    }
  } catch (err) {
    console.error("❌ LLM 검증 API 오류:", err);
    return res.status(500).json({
      success: false,
      message: "서버 오류가 발생했습니다.",
    } as LLMValidationGetResponse);
  }
}

/**
 * GET 요청 처리 - LLM 검증 대상 데이터 조회
 * 이제 이 함수는 DB 접근 로직이 아닌, API 응답을 구성하는 역할만 담당합니다.
 */
async function handleGetRequest(
  req: NextApiRequest,
  res: NextApiResponse<LLMValidationGetResponse>,
  audioCollectionName: string
) {
  const { dateFrom, dateTo } = req.query;

  // 분리된 유틸리티 함수를 호출하여 데이터를 가져옵니다.
  const recordings = await getRecordingsByFilters(
    req.query,
    audioCollectionName
  );

  // 분리된 유틸리티 함수를 호출하여 요약 통계를 계산합니다.
  const summary = calculateSummary(
    recordings,
    dateFrom as string,
    dateTo as string
  );

  return res.status(200).json({
    success: true,
    data: {
      recordings,
      totalCount: recordings.length,
      summary,
    },
  });
}

/**
 * 요약 통계 계산 헬퍼 함수.
 */
function calculateSummary(
  recordings: any[],
  dateFrom?: string,
  dateTo?: string
) {
  const pendingCount = recordings.filter(
    (r) => r.verificationStatus === VerificationStatus.PENDING
  ).length;
  const approvedCount = recordings.filter(
    (r) => r.verificationStatus === VerificationStatus.APPROVED
  ).length;
  const rejectedCount = recordings.filter(
    (r) => r.verificationStatus === VerificationStatus.REJECTED
  ).length;
  const retryCount = recordings.filter(
    (r) => r.verificationStatus === VerificationStatus.NEEDS_RETRY
  ).length;

  return {
    pendingCount,
    approvedCount,
    rejectedCount,
    retryCount, // 새로 추가
    ...(dateFrom &&
      dateTo && {
        dateRange: { from: dateFrom, to: dateTo },
      }),
  };
}
