// pages/api/admin/recordings/llm-validation/update.ts
import { NextApiRequest, NextApiResponse } from "next";
import { updateAudioRecordings } from "@/pages/api/admin/recordings/update";
import { FieldValue } from "firebase-admin/firestore";

// POST 요청 타입 - reasoning 처리 개선
interface LLMValidationUpdateRequest {
  // LLM 검증 결과들
  validationResults: Array<{
    recordingId: string;
    isApproved: boolean;
    reasoning: string; // ✅ 이제 수정 가능한 필드
    confidence?: number;
    textData?: {
      sttTranscription?: string;
      domain?: string;
      intent?: string;
      category?: string;
    };
  }>;

  // 업데이트 옵션
  updateOptions?: {
    verificationMethod?: "llm_auto" | "llm_manual" | "test";
    verifiedBy?: string; // 기본값: "system"
    overrideExisting?: boolean; // 기존 검증 결과를 덮어쓸지 여부
  };
}

// POST 응답 타입 (변경 없음)
interface LLMValidationUpdateResponse {
  success: boolean;
  data?: {
    updatedCount: number;
    approvedCount: number;
    rejectedCount: number;
    skippedCount: number;
    recordingIds: string[];
    processingTime: number;
  };
  message?: string;
  errors?: Array<{
    recordingId: string;
    error: string;
  }>;
}

interface TextDataUpdateRequest {
  recordingId: string;
  textData: {
    sttTranscription?: string;
    domain?: string;
    intent?: string;
    category?: string;
  };
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<LLMValidationUpdateResponse>
) {
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
      return await handleUpdateRequest(req, res);
    } else {
      return res.status(405).json({
        success: false,
        message: "Method not allowed. Use POST only.",
      });
    }
  } catch (err) {
    console.error("❌ LLM 검증 업데이트 API 오류:", err);
    return res.status(500).json({
      success: false,
      message: "서버 오류가 발생했습니다.",
    } as LLMValidationUpdateResponse);
  }
}

/**
 * POST 요청 처리 - LLM 검증 결과 업데이트
 */
async function handleUpdateRequest(
  req: NextApiRequest,
  res: NextApiResponse<LLMValidationUpdateResponse>
) {
  const startTime = Date.now();
  const requestData = req.body as LLMValidationUpdateRequest;

  // 요청 데이터 검증
  if (
    !requestData.validationResults ||
    requestData.validationResults.length === 0
  ) {
    return res.status(400).json({
      success: false,
      message: "validationResults가 필요합니다.",
    });
  }

  console.log("🔄 LLM 검증 결과 업데이트 시작:", {
    resultCount: requestData.validationResults.length,
    verificationMethod:
      requestData.updateOptions?.verificationMethod || "llm_auto",
    verifiedBy: requestData.updateOptions?.verifiedBy || "system",
  });

  // 업데이트 옵션 설정
  const options = {
    verificationMethod:
      requestData.updateOptions?.verificationMethod || "llm_auto",
    verifiedBy: requestData.updateOptions?.verifiedBy || "system",
    overrideExisting: requestData.updateOptions?.overrideExisting ?? true,
  };

  // ✅ 업데이트 데이터 준비 - 점 표기법으로 부분 업데이트
  const updateBatch = requestData.validationResults.map((result) => ({
    recordingId: result.recordingId,
    updates: {
      verificationStatus: result.isApproved ? "approved" : "rejected",
      verification: {
        verifiedAt: FieldValue.serverTimestamp(),
        verifiedBy: options.verifiedBy,
        verificationMethod: options.verificationMethod,
        isApproved: result.isApproved,
        verifierNotes: result.reasoning, // ✅ 수정된 reasoning을 verifierNotes에 저장
        ...(result.confidence !== undefined && {
          confidence: result.confidence,
        }),
      },

      // ✅ textData 점 표기법으로 개별 필드만 업데이트 (기존 필드 보존)
      ...(result.textData?.sttTranscription !== undefined && {
        "textData.sttTranscription": result.textData.sttTranscription,
      }),
      ...(result.textData?.domain !== undefined && {
        "textData.domain": result.textData.domain,
      }),
      ...(result.textData?.intent !== undefined && {
        "textData.intent": result.textData.intent,
      }),
      ...(result.textData?.category !== undefined && {
        "textData.category": result.textData.category,
      }),
    },
  }));

  let updatedCount = 0;
  let skippedCount = 0;
  const errors: Array<{ recordingId: string; error: string }> = [];

  try {
    // 배치 업데이트 실행
    console.log("💾 DB 배치 업데이트 실행...");
    await updateAudioRecordings(updateBatch);
    updatedCount = updateBatch.length;

    console.log(`✅ 업데이트 완료: ${updatedCount}개 처리`);
  } catch (error) {
    console.error("❌ 배치 업데이트 실패:", error);

    // 개별 업데이트 시도
    console.log("🔄 개별 업데이트로 재시도...");

    for (const item of updateBatch) {
      try {
        await updateAudioRecordings([item]);
        updatedCount++;
      } catch (individualError) {
        console.error(
          `❌ 개별 업데이트 실패 (${item.recordingId}):`,
          individualError
        );
        errors.push({
          recordingId: item.recordingId,
          error:
            individualError instanceof Error
              ? individualError.message
              : "Unknown error",
        });
        skippedCount++;
      }
    }
  }

  // 결과 통계 계산
  const approvedCount = requestData.validationResults.filter(
    (r) => r.isApproved
  ).length;
  const rejectedCount = requestData.validationResults.length - approvedCount;
  const processingTime = Date.now() - startTime;
  const successfulIds = updateBatch
    .filter(
      (_, index) =>
        !errors.find((e) => e.recordingId === updateBatch[index].recordingId)
    )
    .map((item) => item.recordingId);

  console.log(
    `🎯 최종 결과: 성공 ${updatedCount}개, 실패 ${skippedCount}개, 소요시간 ${processingTime}ms`
  );

  // 응답 반환
  const response: LLMValidationUpdateResponse = {
    success: updatedCount > 0,
    data: {
      updatedCount,
      approvedCount,
      rejectedCount,
      skippedCount,
      recordingIds: successfulIds,
      processingTime,
    },
    message:
      updatedCount > 0
        ? `LLM 검증 결과가 성공적으로 업데이트되었습니다. (성공: ${updatedCount}, 실패: ${skippedCount})`
        : "업데이트에 실패했습니다.",
  };

  // 에러가 있으면 추가
  if (errors.length > 0) {
    response.errors = errors;
  }

  const statusCode = updatedCount > 0 ? 200 : errors.length > 0 ? 207 : 400;
  return res.status(statusCode).json(response);
}

// ✅ 업데이트된 input example - 점 표기법 사용으로 기존 textData 보존
// {
//   "validationResults": [
//     {
//       "recordingId": "recording-abc-123",
//       "isApproved": true,
//       "reasoning": "사용자가 수정한 검증 이유: 원본 스크립트와 STT 전사가 완벽히 일치함.",
//       "confidence": 0.95,
//       "textData": {
//         "sttTranscription": "사용자가 수정한 STT 결과"
//         // 다른 필드들(originalScript, domain, intent, category)은 보내지 않아도 기존 값 유지됨
//       }
//     },
//     {
//       "recordingId": "recording-def-456",
//       "isApproved": false,
//       "reasoning": "사용자가 수정한 검증 이유: STT 결과에 중요한 오류가 발견됨.",
//       "confidence": 0.88
//       // textData가 없으면 기존 textData는 그대로 유지됨
//     }
//   ],
//   "updateOptions": {
//     "verificationMethod": "llm_manual", // 사용자가 수정했으므로 manual
//     "verifiedBy": "admin"
//   }
// }

// 실제 DB 업데이트는 이렇게 처리됨:
// - "textData.sttTranscription": "새값" → sttTranscription만 업데이트
// - textData.originalScript, textData.domain 등은 그대로 유지
