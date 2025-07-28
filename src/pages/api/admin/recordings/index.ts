import { NextApiRequest, NextApiResponse } from "next";
import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
  limit,
} from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { AudioRecording } from "@/types/audio";

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

  try {
    // 관리자 권한 확인
    const adminToken = req.cookies["admin-token"];
    if (!adminToken) {
      return res.status(401).json({
        success: false,
        message: "관리자 권한이 필요합니다.",
      });
    }

    // 쿼리 파라미터 추출
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
      search, // speakerInfo.userName으로 검색
    } = req.query;

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(queryLimit as string, 10);

    // 🔥 검색 최적화: 검색할 때는 orderBy 제거로 인덱스 에러 방지
    let recordingsQuery = query(collection(db, audioCollectionName));
    let needsClientSorting = false; // 클라이언트에서 정렬이 필요한지 플래그

    // 📋 서버사이드 필터 적용 (검색 우선)
    if (search) {
      // 🔍 검색: speakerInfo.userName으로 정확히 일치하는 것만
      recordingsQuery = query(
        recordingsQuery,
        where("speakerInfo.userName", "==", search)
      );
      needsClientSorting = true; // 검색할 때는 나중에 클라이언트에서 정렬
      console.log(`🔍 검색 조건: speakerInfo.userName == "${search}"`);
    }

    // 사용자 ID 필터
    if (userId) {
      recordingsQuery = query(recordingsQuery, where("userId", "==", userId));
    }

    // 도메인 필터
    if (domain) {
      recordingsQuery = query(
        recordingsQuery,
        where("textData.domain", "==", domain)
      );
    }

    // 태스크 타입 필터
    if (taskType) {
      recordingsQuery = query(
        recordingsQuery,
        where("taskType", "==", taskType)
      );
    }

    // 품질 등급 필터
    if (quality) {
      recordingsQuery = query(
        recordingsQuery,
        where("qualityGrade", "==", quality)
      );
    }

    // 검증 상태 필터
    if (verificationStatus) {
      recordingsQuery = query(
        recordingsQuery,
        where("verificationStatus", "==", verificationStatus)
      );
    }

    // ✅ 핵심 수정: 검색이 없을 때만 orderBy 적용 (인덱스 에러 방지)
    if (!search) {
      recordingsQuery = query(recordingsQuery, orderBy("uploadedAt", "desc"));
      console.log("📅 서버에서 uploadedAt으로 정렬 적용");
    } else {
      console.log("⏭️ 검색 모드: 서버 정렬 생략, 클라이언트에서 정렬 예정");
    }

    // 🎯 스마트 제한: 검색 시 더 많은 데이터 가져오기
    const shouldSearch = !!search;
    const smartLimit = shouldSearch
      ? Math.min(limitNum * 10, 1000) // 검색 시 10배 (최대 1000개)
      : limitNum * 3; // 일반 조회 시 3배

    recordingsQuery = query(recordingsQuery, limit(smartLimit));

    // 🚀 Firebase에서 데이터 조회
    console.log(`🔄 Firebase 조회 시작 (limit: ${smartLimit})`);
    const recordingsSnapshot = await getDocs(recordingsQuery);
    const allRecordings = recordingsSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as AudioRecording[];

    console.log(`📊 Firebase에서 조회된 데이터: ${allRecordings.length}개`);

    // 🔄 검색했을 때만 클라이언트에서 정렬 수행
    if (needsClientSorting) {
      console.log("🔧 클라이언트에서 uploadedAt 정렬 수행");
      allRecordings.sort((a, b) => {
        const aTime =
          a.uploadedAt instanceof Date
            ? a.uploadedAt.getTime()
            : (a.uploadedAt as any).toDate().getTime();
        const bTime =
          b.uploadedAt instanceof Date
            ? b.uploadedAt.getTime()
            : (b.uploadedAt as any).toDate().getTime();

        return bTime - aTime; // desc 정렬
      });
    }

    // 🎛️ 추가 정렬이 필요한 경우 (기본 uploadedAt desc가 아닌 경우)
    const filteredRecordings = allRecordings;

    if (sortBy !== "uploadedAt" || sortOrder !== "desc") {
      console.log(`🔀 사용자 정의 정렬: ${sortBy} ${sortOrder}`);
      filteredRecordings.sort((a, b) => {
        let aValue: any;
        let bValue: any;

        switch (sortBy) {
          case "uploadedAt":
            aValue =
              a.uploadedAt instanceof Date
                ? a.uploadedAt.getTime()
                : (a.uploadedAt as any).toDate().getTime();
            bValue =
              b.uploadedAt instanceof Date
                ? b.uploadedAt.getTime()
                : (b.uploadedAt as any).toDate().getTime();
            break;
          case "duration":
            aValue = a.qualityCheck?.duration || 0;
            bValue = b.qualityCheck?.duration || 0;
            break;
          case "fileSize":
            aValue = a.qualityCheck?.fileSize || 0;
            bValue = b.qualityCheck?.fileSize || 0;
            break;
          case "userId":
            aValue = a.userId || "";
            bValue = b.userId || "";
            break;
          case "domain":
            aValue = a.textData?.domain || "";
            bValue = b.textData?.domain || "";
            break;
          case "verificationStatus":
            aValue = a.verificationStatus || "";
            bValue = b.verificationStatus || "";
            break;
          default:
            // 기본값은 uploadedAt
            aValue =
              a.uploadedAt instanceof Date
                ? a.uploadedAt.getTime()
                : (a.uploadedAt as any).toDate().getTime();
            bValue =
              b.uploadedAt instanceof Date
                ? b.uploadedAt.getTime()
                : (b.uploadedAt as any).toDate().getTime();
        }

        if (sortOrder === "desc") {
          return bValue > aValue ? 1 : -1;
        } else {
          return aValue > bValue ? 1 : -1;
        }
      });
    }

    // 📄 페이지네이션 적용
    const totalCount = filteredRecordings.length;
    const totalPages = Math.ceil(totalCount / limitNum);
    const startIndex = (pageNum - 1) * limitNum;
    const endIndex = startIndex + limitNum;
    const paginatedRecordings = filteredRecordings.slice(startIndex, endIndex);

    console.log(
      `📄 페이지네이션 결과: ${paginatedRecordings.length}개 (${startIndex}-${endIndex}), 총 ${totalCount}개`
    );

    // 👥 사용자 정보 조회 최적화: 현재 페이지에 필요한 사용자만
    const userCollectionName =
      process.env.NEXT_PUBLIC_DB_USER_COLLECTION || "users-temp";
    const uniqueUserIds = [
      ...new Set(paginatedRecordings.map((r) => r.userId)),
    ];

    const userMap = new Map<string, string>();
    if (uniqueUserIds.length > 0) {
      console.log(`👥 사용자 정보 조회: ${uniqueUserIds.length}명`);

      // Firestore의 where in 제한(10개)으로 인한 배치 처리
      const userBatches = [];
      for (let i = 0; i < uniqueUserIds.length; i += 10) {
        userBatches.push(uniqueUserIds.slice(i, i + 10));
      }

      for (const batch of userBatches) {
        const usersQuery = query(
          collection(db, userCollectionName),
          where("__name__", "in", batch)
        );
        const usersSnapshot = await getDocs(usersQuery);
        usersSnapshot.docs.forEach((doc) => {
          const userData = doc.data();
          userMap.set(doc.id, userData.userName || doc.id);
        });
      }
    }

    // 📊 통계 계산: 전체 필터링된 결과 기준
    console.log("📊 통계 계산 시작");
    const statistics = {
      totalRecordings: totalCount,
      byDomain: {} as Record<string, number>,
      byTaskType: {
        situational: 0,
        formal: 0,
      },
      byQuality: {
        high: 0,
        medium: 0,
        low: 0,
      },
      byVerificationStatus: {} as Record<string, number>,
    };

    // 한 번의 순회로 모든 통계 계산
    filteredRecordings.forEach((recording) => {
      // 도메인별 통계
      const domain = recording.textData?.domain || "unknown";
      statistics.byDomain[domain] = (statistics.byDomain[domain] || 0) + 1;

      // 태스크 타입별 통계
      if (
        recording.taskType === "situational" ||
        recording.taskType === "formal"
      ) {
        statistics.byTaskType[recording.taskType]++;
      }

      // 품질별 통계: 미리 계산된 qualityGrade 사용
      const qualityGrade = recording.qualityCheck?.qualityGrade || "medium";
      if (
        qualityGrade === "high" ||
        qualityGrade === "medium" ||
        qualityGrade === "low"
      ) {
        statistics.byQuality[qualityGrade]++;
      }

      // 검증 상태별 통계
      const status = recording.verificationStatus || "unknown";
      statistics.byVerificationStatus[status] =
        (statistics.byVerificationStatus[status] || 0) + 1;
    });

    console.log(
      `✅ 통계 완료: ${
        Object.keys(statistics.byDomain).length
      }개 도메인, 품질 분포:`,
      statistics.byQuality
    );

    // 🎉 성공 응답 반환
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
        statistics,
      },
    });
  } catch (error) {
    console.error("❌ 녹음 목록 조회 오류:", error);
    return res.status(500).json({
      success: false,
      message: "서버 오류가 발생했습니다.",
    });
  }
}
