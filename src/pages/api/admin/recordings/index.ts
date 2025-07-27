import { NextApiRequest, NextApiResponse } from "next";
import { collection, getDocs, query, where, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { AudioRecording } from "@/types/audio";
import { SERVICE_CONFIG } from "@/lib/serviceMapping";
export interface RecordingOverview {
  recordingId: string;
  userId: string;
  userName?: string;
  taskKey: string;
  taskType: "situational" | "formal";

  // 오디오 정보
  audioUrl: string;
  fileName: string;
  fileSize: number;
  duration: number;

  // 텍스트 정보
  originalScript: string;
  sttTranscription: string;
  domain: string;
  intent: string;
  category: string;

  // 화자 정보
  gender: "male" | "female";
  ageGroup: string;

  // 품질 정보
  volumeLevel: number;
  backgroundNoise: "low" | "medium" | "high";
  hasClipping: boolean;
  audioFormat: string;

  // 시간 정보
  recordedAt: string;
  uploadedAt: string;

  // 상태
  status: string;
}

interface RecordingsResponse {
  success: boolean;
  data?: {
    recordings: RecordingOverview[];
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
      byStatus: Record<string, number>;
    };
  };
  message?: string;
}

// 품질 등급 계산
export const calculateQualityGrade = (
  recording: AudioRecording
): "high" | "medium" | "low" => {
  const { volumeLevel, backgroundNoise, hasClipping, duration } =
    recording.qualityCheck;

  // 고품질 조건
  if (
    volumeLevel >= 0.7 &&
    backgroundNoise === "low" &&
    !hasClipping &&
    duration >= 3
  ) {
    return "high";
  }

  // 저품질 조건
  if (
    volumeLevel < 0.4 ||
    backgroundNoise === "high" ||
    hasClipping ||
    duration < 2
  ) {
    return "low";
  }

  return "medium";
};

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
      sortBy = "recordedAt",
      sortOrder = "desc",
      search,
    } = req.query;

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(queryLimit as string, 10);

    // 단일 컬렉션에서 모든 녹음 데이터 조회
    let recordingsQuery = query(
      collection(db, "audioRecordingsV2"),
      orderBy("recordedAt", "desc")
    );

    // 사용자별 필터
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

    const recordingsSnapshot = await getDocs(recordingsQuery);
    const allRecordings = recordingsSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as AudioRecording[];

    // 사용자 정보 조회 (userName 매핑용)
    const usersSnapshot = await getDocs(collection(db, "usersV2"));
    const userMap = new Map<string, string>();
    usersSnapshot.docs.forEach((doc) => {
      const userData = doc.data();
      userMap.set(doc.id, userData.userName || doc.id);
    });

    // 검색 필터 적용
    let filteredRecordings = allRecordings;
    if (search) {
      const searchTerm = (search as string).toLowerCase();
      filteredRecordings = allRecordings.filter(
        (recording) =>
          recording.userId.toLowerCase().includes(searchTerm) ||
          recording.taskKey.toLowerCase().includes(searchTerm) ||
          recording.textData.originalScript
            .toLowerCase()
            .includes(searchTerm) ||
          recording.textData.sttTranscription.toLowerCase().includes(searchTerm)
      );
    }

    // 도메인 필터
    if (domain) {
      filteredRecordings = filteredRecordings.filter(
        (recording) => recording.textData.domain === domain
      );
    }

    // 품질 필터
    if (quality) {
      filteredRecordings = filteredRecordings.filter(
        (recording) => calculateQualityGrade(recording) === quality
      );
    }

    // 정렬
    filteredRecordings.sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortBy) {
        case "recordedAt":
          aValue = new Date(a.recordedAt).getTime();
          bValue = new Date(b.recordedAt).getTime();
          break;
        case "duration":
          aValue = a.qualityCheck.duration;
          bValue = b.qualityCheck.duration;
          break;
        case "fileSize":
          aValue = a.qualityCheck.fileSize;
          bValue = b.qualityCheck.fileSize;
          break;
        case "userId":
          aValue = a.userId;
          bValue = b.userId;
          break;
        default:
          aValue = new Date(a.recordedAt).getTime();
          bValue = new Date(b.recordedAt).getTime();
      }

      if (sortOrder === "desc") {
        return bValue > aValue ? 1 : -1;
      } else {
        return aValue > bValue ? 1 : -1;
      }
    });

    // 페이지네이션
    const totalCount = filteredRecordings.length;
    const totalPages = Math.ceil(totalCount / limitNum);
    const startIndex = (pageNum - 1) * limitNum;
    const endIndex = startIndex + limitNum;
    const paginatedRecordings = filteredRecordings.slice(startIndex, endIndex);

    // 녹음 데이터 변환
    const recordings: RecordingOverview[] = paginatedRecordings.map(
      (recording) => ({
        recordingId: recording.id,
        userId: recording.userId,
        userName: userMap.get(recording.userId),
        taskKey: recording.taskKey,
        taskType: recording.taskType,

        audioUrl: recording.audioUrl,
        fileName: recording.fileName,
        fileSize: recording.qualityCheck.fileSize,
        duration: recording.qualityCheck.duration,

        originalScript: recording.textData.originalScript,
        sttTranscription: recording.textData.sttTranscription,
        domain: recording.textData.domain,
        intent: recording.textData.intent,
        category: recording.textData.category,

        gender: recording.speakerInfo.gender,
        ageGroup: recording.speakerInfo.ageGroup,

        volumeLevel: recording.qualityCheck.volumeLevel,
        backgroundNoise: recording.qualityCheck.backgroundNoise,
        hasClipping: recording.qualityCheck.hasClipping,
        audioFormat: recording.qualityCheck.audioFormat,

        recordedAt: recording.recordedAt,
        uploadedAt: recording.uploadedAt,
        status: recording.status,
      })
    );

    // 통계 계산
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
      byStatus: {} as Record<string, number>,
    };

    filteredRecordings.forEach((recording) => {
      // 도메인별 통계
      const domain = recording.textData.domain;
      statistics.byDomain[domain] = (statistics.byDomain[domain] || 0) + 1;

      // 태스크 타입별 통계
      statistics.byTaskType[recording.taskType]++;

      // 품질별 통계
      const qualityGrade = calculateQualityGrade(recording);
      statistics.byQuality[qualityGrade]++;

      // 상태별 통계
      statistics.byStatus[recording.status] =
        (statistics.byStatus[recording.status] || 0) + 1;
    });

    return res.status(200).json({
      success: true,
      data: {
        recordings,
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
    console.error("녹음 목록 조회 오류:", error);
    return res.status(500).json({
      success: false,
      message: "서버 오류가 발생했습니다.",
    });
  }
}
