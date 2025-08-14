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

    console.log("💕💕💕💕💕여기서 req.query? ", req.query);

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(queryLimit as string, 10);

    // 필터 쿼리 빌더 함수
    async function buildFilterQuery(baseQuery: Query<DocumentData>) {
      let query = baseQuery;

      if (userId) query = query.where("userId", "==", userId);
      if (domain) query = query.where("textData.domain", "==", domain);
      if (taskType) query = query.where("taskType", "==", taskType);
      if (quality) query = query.where("qualityGrade", "==", quality);
      if (verificationStatus)
        query = query.where("verificationStatus", "==", verificationStatus);

      // 검색 조건 추가
      if (search && typeof search === "string") {
        const searchField = req.query.searchField as string;

        console.log("searchField?", searchField);

        if (searchField === "userName") {
          // 1. 먼저 users 컬렉션에서 이름으로 사용자 찾기
          const usersQuery = adminDb
            .collection(userCollectionName)
            .where("userName", ">=", search)
            .where("userName", "<=", search + "\uf8ff");

          const usersSnap = await usersQuery.get();
          const matchingUserIds = usersSnap.docs.map((doc) => doc.id);

          // 🔍 디버깅 로그 추가
          console.log("💕💕💕💕💕 검색어:", search);
          console.log("💕💕💕💕💕 찾은 사용자 수:", usersSnap.docs.length);
          console.log(
            "💕💕💕💕💕 찾은 사용자들:",
            usersSnap.docs.map((doc) => ({ id: doc.id, data: doc.data() }))
          );
          console.log("💕💕💕💕💕 matchingUserIds:", matchingUserIds);

          // 2. 찾은 userId들로 recordings 검색
          if (matchingUserIds.length > 0) {
            // Firestore 'in' 쿼리는 최대 10개까지만 가능
            const userIdBatches = [];
            for (let i = 0; i < matchingUserIds.length; i += 10) {
              userIdBatches.push(matchingUserIds.slice(i, i + 10));
            }

            // 첫 번째 배치만 사용 (10명까지)
            if (userIdBatches.length > 0) {
              console.log("💕💕💕💕💕 일치하는 사용자 없음! 빈 결과 조건 추가");
              query = query.where("userId", "in", userIdBatches[0]);
            }
          } else {
            // 일치하는 사용자가 없으면 빈 결과 반환을 위해 불가능한 조건 추가
            query = query.where("userId", "==", "NO_MATCHING_USER");
          }
        } else if (searchField === "taskKey") {
          query = query.where("taskKey", "==", search);
        } else if (searchField === "domain") {
          query = query.where("textData.domain", "==", search);
        }
      }

      return query;
    }
    const baseQuery = adminDb.collection(audioCollectionName);

    // 1. 총 개수 구하기
    const countQuery = await buildFilterQuery(baseQuery);
    const totalCount = (await countQuery.count().get()).data().count;

    // 2. 실제 데이터 가져오기
    const searchField = req.query.searchField as string;
    const isUserNameSearch = search && searchField === "userName";

    const dataQuery = await buildFilterQuery(baseQuery);

    let snapshot;

    if (isUserNameSearch) {
      // 사용자 이름 검색일 때는 더 많은 데이터를 가져옴
      snapshot = await dataQuery.orderBy("uploadedAt", "desc").limit(500).get();
    } else {
      // 일반 검색일 때는 기존대로 페이지네이션
      snapshot = await dataQuery
        .orderBy("uploadedAt", "desc")
        .limit(limitNum)
        .offset((pageNum - 1) * limitNum)
        .get();
    }
    const allRecordings = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as AudioRecording[];

    // 사용자 이름 검색일 때 클라이언트에서 페이지네이션 적용
    if (isUserNameSearch) {
      const startIndex = (pageNum - 1) * limitNum;
      const endIndex = startIndex + limitNum;
      allRecordings.splice(
        0,
        allRecordings.length,
        ...allRecordings.slice(startIndex, endIndex)
      );
    }

    // 클라이언트 사이드 정렬 (검색이 있는 경우 또는 다른 정렬 기준인 경우)
    if (search || sortBy !== "uploadedAt" || sortOrder !== "desc") {
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

        if (sortOrder === "desc") {
          return bVal > aVal ? 1 : bVal < aVal ? -1 : 0;
        } else {
          return aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
        }
      });
    }

    console.log("💕💕💕💕💕 allRecordings?", allRecordings.length);

    const totalPages = Math.ceil(totalCount / limitNum);

    // 사용자 이름 조회
    const uniqueUserIds = [...new Set(allRecordings.map((r) => r.userId))];
    const userMap = new Map<string, string>();

    for (let i = 0; i < uniqueUserIds.length; i += 10) {
      const batch = uniqueUserIds.slice(i, i + 10);
      if (batch.length > 0) {
        const usersSnap = await adminDb
          .collection(userCollectionName)
          .where(FieldPath.documentId(), "in", batch)
          .get();

        usersSnap.docs.forEach((doc) => {
          const userData = doc.data();
          userMap.set(doc.id, userData.userName || doc.id);
        });
      }
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
        stats.byQuality[q as "high" | "medium" | "low"]++;
      }

      const v = rec.verificationStatus || "unknown";
      stats.byVerificationStatus[v] = (stats.byVerificationStatus[v] || 0) + 1;
    });
    return res.status(200).json({
      success: true,
      data: {
        recordings: allRecordings,
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
