import { NextApiRequest, NextApiResponse } from "next";
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
} from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { User } from "@/types/firebase";

export interface ParticipantDetail extends User {
  // 추가 상세 정보
  recordingHistory: Array<{
    recordingId: string;
    taskKey: string;
    taskType: "situational" | "formal";
    completedAt: string;
    duration: number;
    qualityScore: number;
    status: string;
  }>;

  // 세트별 상세 진행률
  setDetails: Array<{
    setNumber: number;
    setId: number;
    status: string;
    totalTasks: number;
    completedTasks: number;
    progressPercentage: number;
    situationalProgress: {
      total: number;
      completed: number;
    };
    formalProgress: {
      total: number;
      completed: number;
    };
  }>;
}

interface ParticipantDetailResponse {
  success: boolean;
  data?: ParticipantDetail;
  message?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ParticipantDetailResponse>
) {
  if (req.method !== "GET") {
    return res.status(405).json({
      success: false,
      message: "Method not allowed",
    });
  }

  const userCollectionName =
    process.env.NEXT_PUBLIC_DB_USER_COLLECTION || "users-temp";
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

    // 녹음 기록 조회 (단일 컬렉션에서)
    const recordingHistory: ParticipantDetail["recordingHistory"] = [];

    try {
      const recordingsQuery = query(
        collection(db, audioCollectionName),
        where("userId", "==", userId)
      );

      const recordingsSnapshot = await getDocs(recordingsQuery);

      recordingsSnapshot.docs.forEach((doc) => {
        const recording = doc.data();
        recordingHistory.push({
          recordingId: doc.id,
          taskKey: recording.taskKey,
          taskType: recording.taskType,
          completedAt: recording.recordedAt,
          duration: recording.qualityCheck?.duration || 0,
          qualityScore: recording.qualityCheck?.volumeLevel * 100 || 0,
          status: recording.status,
        });
      });
    } catch (error) {
      console.warn("녹음 기록 조회 실패:", error);
    }
    // 세트별 상세 진행률 계산
    const setDetails =
      userData.participation?.sets?.map((set) => ({
        setNumber: set.setNumber,
        setId: set.setId,
        status: set.status,
        totalTasks: set.progress.totalTasks,
        completedTasks: set.progress.completedTasks,
        progressPercentage:
          set.progress.totalTasks > 0
            ? Math.round(
                (set.progress.completedTasks / set.progress.totalTasks) * 100
              )
            : 0,
        situationalProgress: {
          total: set.progress.situational.total,
          completed: set.progress.situational.completed,
        },
        formalProgress: {
          total: set.progress.formal.total,
          completed: set.progress.formal.completed,
        },
      })) || [];

    const participantDetail: ParticipantDetail = {
      ...userData,
      recordingHistory: recordingHistory.sort(
        (a, b) =>
          new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime()
      ),
      setDetails,
    };

    return res.status(200).json({
      success: true,
      data: participantDetail,
    });
  } catch (error) {
    console.error("참여자 상세 정보 조회 오류:", error);
    return res.status(500).json({
      success: false,
      message: "서버 오류가 발생했습니다.",
    });
  }
}
