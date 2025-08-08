// pages/api/admin/recordings/llm-validation/run.ts
import { NextApiRequest, NextApiResponse } from "next";
import { adminDb } from "@/lib/firebase/admin";
import {
  validateBatchRecordings,
  ValidationResult,
  BatchValidationInput,
} from "@/lib/llm-validation";
import {
  getRecordingsByFilters,
  extractRecordingData,
} from "@/lib/firebase/firestoreAdmin";
// POST 요청 타입
interface LLMValidationPostRequest {
  // 방식 1: 특정 ID 배열 (테스트용)
  recordingIds?: string[];

  // 방식 2: 날짜 범위 필터링
  dateRange?: {
    from: string; // ISO string
    to: string; // ISO string
  };

  // 방식 3: 추가 필터 옵션
  filters?: {
    verificationStatus?: "pending" | "approved" | "rejected";
    domain?: string;
    taskType?: "situational" | "formal";
    limit?: number; // 최대 처리 개수 제한
  };

  // 테스트 모드 (실제 LLM 호출 없이 더미 데이터로 테스트)
  testMode?: boolean;
}

// POST 응답 타입
interface LLMValidationPostResponse {
  success: boolean;
  data?: {
    processedCount: number;
    approvedCount: number;
    rejectedCount: number;
    recordingIds: string[];
    processingTime: number; // ms
    details?: ValidationResult[]; // 상세 결과 (선택적)
    totalTokenUsage?: {
      prompt: number;
      completion: number;
      total: number;
    };
  };
  message?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<LLMValidationPostResponse>
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

    if (req.method === "POST") {
      return await handlePostRequest(req, res, audioCollectionName);
    } else {
      return res.status(405).json({
        success: false,
        message: "Method not allowed. Use POST.",
      });
    }
  } catch (err) {
    console.error("❌ LLM 검증 API 오류:", err);
    return res.status(500).json({
      success: false,
      message: "서버 오류가 발생했습니다.",
    } as LLMValidationPostResponse);
  }
}

/**
 * POST 요청 처리 - LLM 검증 실행
 */
async function handlePostRequest(
  req: NextApiRequest,
  res: NextApiResponse<LLMValidationPostResponse>,
  audioCollectionName: string
) {
  //   console.log("=== Request Debug Info ===");
  //   console.log("Method:", req.method);
  //   console.log("Headers:", JSON.stringify(req.headers, null, 2));
  //   console.log("Body type:", typeof req.body);
  //   console.log("Body:", JSON.stringify(req.body, null, 2));
  //   console.log("Raw body:", req.body);
  //   console.log("========================");
  const startTime = Date.now();
  const requestData = req.body as LLMValidationPostRequest;

  //   // 요청 데이터 유효성 검사
  //   const hasRecordingIds =
  //     requestData.recordingIds && requestData.recordingIds.length > 0;
  //   const hasDateRange = requestData.dateRange?.from && requestData.dateRange?.to;

  //   if (!hasRecordingIds && !hasDateRange) {
  //     return res.status(400).json({
  //       success: false,
  //       message: "recordingIds 또는 dateRange가 필요합니다.",
  //     });
  //   }

  // 1. 검증 대상 레코딩 조회
  const targetRecordings = await getTargetRecordings(
    requestData,
    audioCollectionName
  );
  if (targetRecordings.length === 0) {
    return res.status(200).json({
      success: true,
      data: {
        processedCount: 0,
        approvedCount: 0,
        rejectedCount: 0,
        recordingIds: [],
        processingTime: Date.now() - startTime,
      },
      message: "처리할 레코딩이 없습니다.",
    });
  }

  //   console.log("🚀🚀🚀🚀 targetRecordings?", targetRecordings);
  //   console.log("🚀 LLM 검증 시작:", {
  //     testMode: requestData.testMode,
  //     recordingIds: targetRecordings,
  //   });

  //   return res.status(200).json({
  //     success: true,
  //   });

  console.log(`📋 처리 대상: ${targetRecordings.length}개 레코딩`);

  // 2. LLM 검증 실행
  let validationResults: ValidationResult[];

  if (requestData.testMode) {
    // 테스트 모드: 더미 데이터 생성
    // console.log("🧪 테스트 모드 실행");
    validationResults = generateTestResults(targetRecordings);
  } else {
    // 실제 LLM 검증
    // console.log("🤖 실제 LLM 검증 실행");
    validationResults = await validateBatchRecordings(targetRecordings);
  }

  // 3. 검증 결과 준비 완료 (DB 업데이트는 별도 API에서 처리)

  // 4. 결과 통계 계산
  const approvedCount = validationResults.filter((r) => r.isApproved).length;
  const rejectedCount = validationResults.length - approvedCount;
  const processingTime = Date.now() - startTime;
  //  토큰 사용량 집계
  const totalTokenUsage = validationResults.reduce(
    (acc, result) => {
      if (result.tokenUsage) {
        acc.prompt += result.tokenUsage.prompt;
        acc.completion += result.tokenUsage.completion;
        acc.total += result.tokenUsage.total;
      }
      return acc;
    },
    { prompt: 0, completion: 0, total: 0 }
  );
  console.log(
    `✅ LLM 검증 완료: ${validationResults.length}개 처리 (승인: ${approvedCount}, 반려: ${rejectedCount}, 소요시간: ${processingTime}ms)`
  );

  return res.status(200).json({
    success: true,
    data: {
      processedCount: validationResults.length,
      approvedCount,
      rejectedCount,
      recordingIds: validationResults.map((r) => r.recordingId),
      processingTime,
      details: validationResults, // 상세 결과도 반환
      totalTokenUsage,
    },
    message: `LLM 검증이 완료되었습니다. (승인: ${approvedCount}, 반려: ${rejectedCount})`,
  });
}

/**
 * 검증 대상 레코딩 조회 및 데이터 추출 (수정된 버전)
 * @param requestData - LLM 검증 요청 데이터.
 * @param audioCollectionName - 조회할 컬렉션 이름.
 * @returns {Promise<BatchValidationInput[]>} - LLM 검증에 필요한 데이터 배열.
 */
async function getTargetRecordings(
  requestData: LLMValidationPostRequest,
  audioCollectionName: string
): Promise<BatchValidationInput[]> {
  const filters = {
    ...requestData.filters,
    dateFrom: requestData.dateRange?.from,
    dateTo: requestData.dateRange?.to,
    recordingIds: requestData.recordingIds,
  };

  console.log("여기서 filters?", filters);

  const recordings = await getRecordingsByFilters(filters, audioCollectionName);

  if (recordings.length === 0) {
    return [];
  }

  return recordings.map((data: any) => ({
    recordingId: data.id,
    textData: {
      originalScript: data.textData?.originalScript || "",
      sttTranscription: data.textData?.sttTranscription || "",
      domain: data.textData?.domain || "",
      intent: data.textData?.intent || "",
      category: data.textData?.category || "",
    },
  }));
}

/**
 * 테스트용 더미 결과 생성
 */
function generateTestResults(
  recordings: BatchValidationInput[]
): ValidationResult[] {
  return recordings.map((recording) => ({
    recordingId: recording.recordingId,
    isApproved: Math.random() > 0.3, // 70% 승인율
    reasoning: `테스트 모드 결과: ${
      Math.random() > 0.5
        ? "적절한 STT 결과입니다"
        : "일부 개선이 필요한 STT 결과입니다"
    }`,
    confidence: Math.random() * 0.4 + 0.6, // 0.6-1.0
  }));
}
function parseQueryParams(query: any): LLMValidationPostRequest {
  return {
    dateRange:
      query.dateFrom && query.dateTo
        ? {
            from: query.dateFrom,
            to: query.dateTo,
          }
        : undefined,
    filters: {
      verificationStatus: query.verificationStatus,
      domain: query.domain,
      taskType: query.taskType,
      limit: query.limit ? parseInt(query.limit) : undefined,
    },
    recordingIds: query.recordingIds
      ? query.recordingIds.split(",")
      : undefined,
    testMode: query.testMode === "true",
  };
}
