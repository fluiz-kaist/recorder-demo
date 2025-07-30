// pages/api/admin/recordings/index.ts
import { NextApiRequest, NextApiResponse } from "next";
import { adminDb } from "@/lib/firebase/admin";
import { AudioRecording } from "@/types/audio";
import { FieldPath } from "firebase-admin/firestore";
import { Query, DocumentData } from "firebase-admin/firestore";
interface RecordingsResponse {
  success: boolean;
  data?: {
    recordings: AudioRecording[];
    totalCount: number;
    pagination: {
      currentPage: number;
      totalPages: number;
      hasNextPage: boolean;
      hasPrevPage: boolean;
    };
    statistics: {
      totalRecordings: number;
      byDomain: Record<string, number>;
      byTaskType: {
        situational: number;
        formal: number;
      };
      byQuality: {
        high: number;
        medium: number;
        low: number;
      };
      byVerificationStatus: Record<string, number>;
    };
  };
  message?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<RecordingsResponse>
) {
  if (req.method !== "GET") {
    return res.status(405).json({
      success: false,
      message: "Method not allowed",
    });
  }

  const audioCollectionName =
    process.env.NEXT_PUBLIC_DB_AUDIO_RECORDINGS_COLLECTION || "recording-temp";

  const userCollectionName =
    process.env.NEXT_PUBLIC_DB_USER_COLLECTION || "users-temp";

  try {
    const adminToken = req.cookies["admin-token"];
    if (!adminToken) {
      return res.status(401).json({
        success: false,
        message: "관리자 권한이 필요합니다.",
      });
    }

    // Query Params
    const {
      page = "1",
      limit: queryLimit = "50",
      userId,
      domain,
      taskType,
      quality,
      verificationStatus,
      sortBy = "uploadedAt",
      sortOrder = "desc",
      search,
    } = req.query;

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(queryLimit as string, 10);
    const shouldSearch = !!search;

    let queryRef: Query<DocumentData> = adminDb.collection(audioCollectionName);
    let needsClientSorting = false;

    if (search && typeof search === "string") {
      queryRef = queryRef.where("speakerInfo.userName", "==", search);
      needsClientSorting = true;
    }

    if (userId) {
      queryRef = queryRef.where("userId", "==", userId);
    }

    if (domain) {
      queryRef = queryRef.where("textData.domain", "==", domain);
    }

    if (taskType) {
      queryRef = queryRef.where("taskType", "==", taskType);
    }

    if (quality) {
      queryRef = queryRef.where("qualityGrade", "==", quality);
    }

    if (verificationStatus) {
      queryRef = queryRef.where("verificationStatus", "==", verificationStatus);
    }

    if (!shouldSearch) {
      queryRef = queryRef.orderBy("uploadedAt", "desc");
    }

    const smartLimit = shouldSearch
      ? Math.min(limitNum * 10, 1000)
      : limitNum * 3;

    queryRef = queryRef.limit(smartLimit);
    const snapshot = await queryRef.get();

    const allRecordings = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as AudioRecording[];

    if (needsClientSorting) {
      allRecordings.sort((a, b) => {
        const aTime = new Date(a.uploadedAt as any).getTime();
        const bTime = new Date(b.uploadedAt as any).getTime();
        return bTime - aTime;
      });
    }

    if (sortBy !== "uploadedAt" || sortOrder !== "desc") {
      allRecordings.sort((a, b) => {
        const getValue = (rec: AudioRecording) => {
          switch (sortBy) {
            case "duration":
              return rec.qualityCheck?.duration || 0;
            case "fileSize":
              return rec.qualityCheck?.fileSize || 0;
            case "userId":
              return rec.userId || "";
            case "domain":
              return rec.textData?.domain || "";
            case "verificationStatus":
              return rec.verificationStatus || "";
            default:
              return new Date(rec.uploadedAt as any).getTime();
          }
        };
        const aVal = getValue(a);
        const bVal = getValue(b);
        return sortOrder === "desc"
          ? bVal > aVal
            ? 1
            : -1
          : aVal > bVal
          ? 1
          : -1;
      });
    }

    const totalCount = allRecordings.length;
    const totalPages = Math.ceil(totalCount / limitNum);
    const startIndex = (pageNum - 1) * limitNum;
    const endIndex = startIndex + limitNum;
    const paginatedRecordings = allRecordings.slice(startIndex, endIndex);

    // 사용자 이름 조회
    const uniqueUserIds = [
      ...new Set(paginatedRecordings.map((r) => r.userId)),
    ];
    const userMap = new Map<string, string>();

    for (let i = 0; i < uniqueUserIds.length; i += 10) {
      const batch = uniqueUserIds.slice(i, i + 10);
      const usersSnap = await adminDb
        .collection(userCollectionName)
        .where(FieldPath.documentId(), "in", batch)
        .get();

      usersSnap.docs.forEach((doc) => {
        const userData = doc.data();
        userMap.set(doc.id, userData.userName || doc.id);
      });
    }

    // 통계 계산
    const stats = {
      totalRecordings: totalCount,
      byDomain: {} as Record<string, number>,
      byTaskType: { situational: 0, formal: 0 },
      byQuality: { high: 0, medium: 0, low: 0 },
      byVerificationStatus: {} as Record<string, number>,
    };

    allRecordings.forEach((rec) => {
      const domain = rec.textData?.domain || "unknown";
      stats.byDomain[domain] = (stats.byDomain[domain] || 0) + 1;

      if (rec.taskType === "situational" || rec.taskType === "formal") {
        stats.byTaskType[rec.taskType]++;
      }

      const q = rec.qualityCheck?.qualityGrade || "medium";
      if (["high", "medium", "low"].includes(q)) {
        stats.byQuality[q]++;
      }

      const v = rec.verificationStatus || "unknown";
      stats.byVerificationStatus[v] = (stats.byVerificationStatus[v] || 0) + 1;
    });

    return res.status(200).json({
      success: true,
      data: {
        recordings: paginatedRecordings,
        totalCount,
        pagination: {
          currentPage: pageNum,
          totalPages,
          hasNextPage: pageNum < totalPages,
          hasPrevPage: pageNum > 1,
        },
        statistics: stats,
      },
    });
  } catch (err) {
    console.error("❌ 녹음 목록 조회 오류:", err);
    return res.status(500).json({
      success: false,
      message: "서버 오류가 발생했습니다.",
    });
  }
}
