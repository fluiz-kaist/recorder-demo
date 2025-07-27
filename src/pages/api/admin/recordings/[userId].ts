import { NextApiRequest, NextApiResponse } from "next";
import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
  doc,
  getDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { AudioRecording } from "@/types/audio";
import { User } from "@/types/firebase";
import { calculateQualityGrade } from "@/pages/api/admin/recordings";

interface UserRecordingsResponse {
  success: boolean;
  data?: {
    userInfo: {
      userId: string;
      userName?: string;
      gender: string;
      ageGroup: string;
    };
    recordings: AudioRecording[];
    statistics: {
      totalRecordings: number;
      averageDuration: number;
      totalFileSize: number;
      qualityDistribution: {
        high: number;
        medium: number;
        low: number;
      };
      domainBreakdown: Record<string, number>;
    };
  };
  message?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<UserRecordingsResponse>
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
    const userCollectionName =
      process.env.NEXT_PUBLIC_DB_USER_COLLECTION || "users-temp";

    const audioCollectionName =
      process.env.NEXT_PUBLIC_DB_AUDIO_RECORDINGS_COLLECTION ||
      "recording-temp";

    const { userId } = req.query;

    if (!userId || typeof userId !== "string") {
      return res.status(400).json({
        success: false,
        message: "유효한 사용자 ID가 필요합니다.",
      });
    }

    // 사용자 정보 조회
    const userDoc = await getDoc(doc(db, userCollectionName, userId));
    if (!userDoc.exists()) {
      return res.status(404).json({
        success: false,
        message: "사용자를 찾을 수 없습니다.",
      });
    }
    const userData = userDoc.data() as User;

    // 수정: uploadedAt 필드로 정렬
    const recordingsQuery = query(
      collection(db, audioCollectionName),
      where("userId", "==", userId),
      orderBy("uploadedAt", "desc")
    );

    const recordingsSnapshot = await getDocs(recordingsQuery);
    const userRecordings = recordingsSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as AudioRecording[];

    // 클라이언트 표시용으로만 평탄화 (DB 처리는 원본 구조 사용)
    const recordings: AudioRecording[] = userRecordings;
    // 통계 계산
    const totalRecordings = userRecordings.length;
    const totalDuration = userRecordings.reduce(
      (sum, r) => sum + r.qualityCheck.duration,
      0
    );
    const totalFileSize = userRecordings.reduce(
      (sum, r) => sum + r.qualityCheck.fileSize,
      0
    );

    const qualityDistribution = { high: 0, medium: 0, low: 0 };
    const domainBreakdown: Record<string, number> = {};

    userRecordings.forEach((recording) => {
      // 품질 분포
      const quality = calculateQualityGrade(recording);
      qualityDistribution[quality]++;

      // 도메인 분포
      const domain = recording.textData.domain;
      domainBreakdown[domain] = (domainBreakdown[domain] || 0) + 1;
    });

    return res.status(200).json({
      success: true,
      data: {
        userInfo: {
          userId: userData.id,
          userName: userData.userName,
          gender: userData.gender,
          ageGroup: userData.ageGroup,
        },
        recordings,
        statistics: {
          totalRecordings,
          averageDuration:
            totalRecordings > 0
              ? Math.round((totalDuration / totalRecordings) * 10) / 10
              : 0,
          totalFileSize,
          qualityDistribution,
          domainBreakdown,
        },
      },
    });
  } catch (error) {
    console.error("사용자 녹음 조회 오류:", error);
    return res.status(500).json({
      success: false,
      message: "서버 오류가 발생했습니다.",
    });
  }
}
