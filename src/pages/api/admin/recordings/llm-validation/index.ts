// pages/api/admin/recordings/llm-validation.ts
import { NextApiRequest, NextApiResponse } from "next";
import { adminDb } from "@/lib/firebase/admin";
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
