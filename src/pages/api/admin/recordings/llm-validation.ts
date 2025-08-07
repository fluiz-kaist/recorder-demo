// pages/api/admin/recordings/llm-validation.ts
import { NextApiRequest, NextApiResponse } from "next";
import { adminDb } from "@/lib/firebase/admin";
import { updateAudioRecordings } from "./update";
import { AudioRecording } from "@/types/audio";
import { FieldValue } from "firebase-admin/firestore";

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
      verificationStatus: string;
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
      dateRange?: {
        from: string;
        to: string;
      };
    };
    qualityCheck?: any;
  };
  message?: string;
}

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

  // LLM 분석 결과 (실제로는 LLM 호출 로직이 들어갈 예정)
  llmResults?: Array<{
    recordingId: string;
    isApproved: boolean;
    analysisNotes: string;
    confidence?: number;
  }>;

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
  };
  message?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<LLMValidationGetResponse | LLMValidationPostResponse>
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
      return await handleGetRequest(req, res, audioCollectionName);
    } else if (req.method === "POST") {
      return await handlePostRequest(req, res, audioCollectionName);
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
 */
async function handleGetRequest(
  req: NextApiRequest,
  res: NextApiResponse<LLMValidationGetResponse>,
  audioCollectionName: string
) {
  const {
    verificationStatus,
    dateFrom,
    dateTo,
    domain,
    taskType,
    limit = "100",
    recordingIds, // 특정 ID들만 조회
  } = req.query;

  // 특정 ID들만 조회하는 경우
  if (recordingIds && typeof recordingIds === "string") {
    const idsArray = recordingIds.split(",");
    if (idsArray.length > 0) {
      // Firestore 'in' 쿼리는 최대 10개까지만 지원
      if (idsArray.length <= 10) {
        const query = adminDb
          .collection(audioCollectionName)
          .where("__name__", "in", idsArray);
        const snapshot = await query.get();
        const recordings = snapshot.docs.map((doc) =>
          extractRecordingData(doc)
        );
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
      } else {
        // 10개 초과시 여러 쿼리로 나누어 처리
        const chunks = [];
        for (let i = 0; i < idsArray.length; i += 10) {
          chunks.push(idsArray.slice(i, i + 10));
        }

        const chunkPromises = chunks.map((chunk) =>
          adminDb
            .collection(audioCollectionName)
            .where("__name__", "in", chunk)
            .get()
        );
        const snapshots = await Promise.all(chunkPromises);
        const allRecordings = snapshots.flatMap((snap) => snap.docs);

        const recordings = allRecordings.map((doc) =>
          extractRecordingData(doc)
        );
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
    }
  }
  // 일반 필터링 - 타입 명시적 지정
  let query: any = adminDb.collection(audioCollectionName);

  if (verificationStatus && verificationStatus !== "") {
    query = query.where("verificationStatus", "==", verificationStatus);
  }
  if (domain && domain !== "") {
    query = query.where("textData.domain", "==", domain);
  }
  if (taskType && taskType !== "") {
    query = query.where("taskType", "==", taskType);
  }

  // 날짜 범위 필터링
  if (typeof dateFrom === "string" && dateFrom.trim() !== "") {
    query = query.where("uploadedAt", ">=", new Date(dateFrom));
  }
  if (typeof dateTo === "string" && dateTo.trim() !== "") {
    query = query.where("uploadedAt", "<=", new Date(dateTo));
  }
  // 정렬 및 제한
  const finalQuery = query
    .orderBy("uploadedAt", "desc")
    .limit(parseInt(limit as string));

  const snapshot = await finalQuery
    .select(
      "textData",
      "verificationStatus",
      "uploadedAt",
      "verification",
      "qualityCheck"
    )
    .get();

  // .select() 없이 먼저 실행해보기
  //   const snapshot = await finalQuery.get(); // ← 에러 발생 시 인덱스 링크 제공
  const recordings = snapshot.docs.map((doc: any) => extractRecordingData(doc));
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
 * POST 요청 처리 - LLM 검증 실행
 */
async function handlePostRequest(
  req: NextApiRequest,
  res: NextApiResponse<LLMValidationPostResponse>,
  audioCollectionName: string
) {
  const startTime = Date.now();
  const requestData = req.body as LLMValidationPostRequest;

  // 1. 검증 대상 레코딩 조회
  let targetRecordings: string[] = [];

  if (requestData.recordingIds && requestData.recordingIds.length > 0) {
    // 방식 1: 특정 ID 배열
    targetRecordings = requestData.recordingIds;
  } else if (requestData.dateRange) {
    // 방식 2: 날짜 범위로 조회
    let query = adminDb
      .collection(audioCollectionName)
      .where("uploadedAt", ">=", new Date(requestData.dateRange.from))
      .where("uploadedAt", "<=", new Date(requestData.dateRange.to));

    // 추가 필터 적용
    if (requestData.filters?.verificationStatus) {
      query = query.where(
        "verificationStatus",
        "==",
        requestData.filters.verificationStatus
      );
    }
    if (requestData.filters?.domain) {
      query = query.where("textData.domain", "==", requestData.filters.domain);
    }
    if (requestData.filters?.taskType) {
      query = query.where("taskType", "==", requestData.filters.taskType);
    }

    const limit = requestData.filters?.limit || 100;
    query = query.limit(limit);

    const snapshot = await query.get();
    targetRecordings = snapshot.docs.map((doc) => doc.id);
  } else {
    return res.status(400).json({
      success: false,
      message: "recordingIds 또는 dateRange가 필요합니다.",
    });
  }

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

  // 2. LLM 분석 실행 (현재는 테스트 모드 또는 제공된 결과 사용)
  let llmResults: Array<{
    recordingId: string;
    isApproved: boolean;
    analysisNotes: string;
    confidence?: number;
  }>;

  if (requestData.llmResults && requestData.llmResults.length > 0) {
    // 제공된 LLM 결과 사용
    llmResults = requestData.llmResults.filter((result) =>
      targetRecordings.includes(result.recordingId)
    );
  } else if (requestData.testMode) {
    // 테스트 모드: 더미 데이터 생성
    llmResults = targetRecordings.map((id) => ({
      recordingId: id,
      isApproved: Math.random() > 0.3, // 70% 승인율
      analysisNotes: `LLM 분석 (테스트): ${
        Math.random() > 0.5
          ? "적절한 응답입니다"
          : "부분적으로 개선이 필요합니다"
      }`,
      confidence: Math.random() * 0.4 + 0.6, // 0.6-1.0
    }));
  } else {
    // TODO: 실제 LLM API 호출 로직
    // 현재는 기본 승인으로 처리
    llmResults = targetRecordings.map((id) => ({
      recordingId: id,
      isApproved: true,
      analysisNotes: "LLM 분석: 자동 승인 (LLM 로직 미구현)",
      confidence: 0.8,
    }));
  }

  // 3. 업데이트 데이터 준비
  const updateBatch = llmResults.map((result) => ({
    recordingId: result.recordingId,
    updates: {
      verificationStatus: result.isApproved ? "approved" : "rejected",
      verification: {
        verifiedAt: FieldValue.serverTimestamp(),
        verifiedBy: "system",
        verificationMethod: "auto",
        isApproved: result.isApproved,
        verifierNotes: result.analysisNotes,
        ...(result.confidence && { confidence: result.confidence }),
      },
    },
  }));

  // 4. 배치 업데이트 실행
  await updateAudioRecordings(updateBatch);

  // 5. 결과 통계 계산
  const approvedCount = llmResults.filter((r) => r.isApproved).length;
  const rejectedCount = llmResults.length - approvedCount;
  const processingTime = Date.now() - startTime;

  console.log(
    `✅ LLM 검증 완료: ${llmResults.length}개 처리 (승인: ${approvedCount}, 반려: ${rejectedCount})`
  );

  return res.status(200).json({
    success: true,
    data: {
      processedCount: llmResults.length,
      approvedCount,
      rejectedCount,
      recordingIds: llmResults.map((r) => r.recordingId),
      processingTime,
    },
    message: `LLM 검증이 완료되었습니다. (${llmResults.length}개 처리)`,
  });
}

/**
 * 문서에서 필요한 데이터만 추출
 */
function extractRecordingData(doc: any) {
  const data = doc.data();
  return {
    id: doc.id,
    taskKey: data.taskKey,
    textData: {
      originalScript: data.textData?.originalScript || "",
      sttTranscription: data.textData?.sttTranscription || "",
      domain: data.textData?.domain || "",
      intent: data.textData?.intent || "",
      category: data.textData?.category || "",
    },
    verificationStatus: data.verificationStatus,
    uploadedAt: data.uploadedAt?.toDate?.()?.toISOString() || data.uploadedAt,
    verification: data.verification
      ? {
          verifiedAt:
            data.verification.verifiedAt?.toDate?.()?.toISOString() ||
            data.verification.verifiedAt,
          verifiedBy: data.verification.verifiedBy,
          verificationMethod: data.verification.verificationMethod,
          isApproved: data.verification.isApproved,
          verifierNotes: data.verification.verifierNotes,
        }
      : undefined,
    qualityCheck: data.qualityCheck || {},
  };
}

/**
 * 요약 통계 계산
 */
function calculateSummary(
  recordings: any[],
  dateFrom?: string,
  dateTo?: string
) {
  const pendingCount = recordings.filter(
    (r) => r.verificationStatus === "pending"
  ).length;
  const approvedCount = recordings.filter(
    (r) => r.verificationStatus === "approved"
  ).length;
  const rejectedCount = recordings.filter(
    (r) => r.verificationStatus === "rejected"
  ).length;

  return {
    pendingCount,
    approvedCount,
    rejectedCount,
    ...(dateFrom &&
      dateTo && {
        dateRange: { from: dateFrom, to: dateTo },
      }),
  };
}
