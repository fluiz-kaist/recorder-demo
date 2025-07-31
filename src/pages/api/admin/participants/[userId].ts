import { NextApiRequest, NextApiResponse } from "next";
import { getDocByIdAdmin } from "@/lib/firebase/firestoreAdmin"; // Admin SDK 추가
import { Timestamp, FieldValue } from "firebase/firestore";
import { adminDb } from "@/lib/firebase/admin"; // Admin SDK 추가
import {
  UserProfile,
  UserSettings,
  CurrentUserStatus,
  RoundSummary,
  UserStatistics,
} from "@/types/user";

export interface ParticipantDetail {
  id: string;
  profile: UserProfile;
  settings: UserSettings;
  currentStatus: CurrentUserStatus;
  roundSummaries: RoundSummary[];
  statistics: UserStatistics;
  updatedAt: Timestamp | FieldValue | string;

  // 기존 추가 필드들 유지
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
    const userData = await getDocByIdAdmin(userCollectionName, userId);
    // 서브컬렉션 조회
    const roundsSnapshot = await adminDb
      .collection(userCollectionName)
      .doc(userId)
      .collection("rounds")
      .orderBy("roundNumber", "asc")
      .get();

    const roundsData = roundsSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    if (!userData) {
      return res.status(404).json({
        success: false,
        message: "사용자를 찾을 수 없습니다.",
      });
    }

    // 녹음 기록 조회 (Admin SDK 방식)
    const recordingHistory: ParticipantDetail["recordingHistory"] = [];

    try {
      const recordingsSnapshot = await adminDb // Admin SDK로 변경
        .collection(audioCollectionName)
        .where("userId", "==", userId)
        .get();

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
    const setDetails = roundsData.map((round: any) => ({
      setNumber: round.roundNumber,
      setId: round.formalSetId,
      status: round.status,
      totalTasks: round.progress.totalTasks,
      completedTasks: round.progress.completedTasks,
      progressPercentage:
        round.progress.totalTasks > 0
          ? Math.round(
              (round.progress.completedTasks / round.progress.totalTasks) * 100
            )
          : 0,
      situationalProgress: {
        total: round.progress.byTaskType?.situational?.total || 0,
        completed: round.progress.byTaskType?.situational?.completed || 0,
      },
      formalProgress: {
        total: round.progress.byTaskType?.formal?.total || 0,
        completed: round.progress.byTaskType?.formal?.completed || 0,
      },
    }));

    const participantDetail = {
      id: userId,
      profile: userData.profile,
      settings: userData.settings,
      currentStatus: userData.currentStatus,
      roundSummaries: userData.roundSummaries,
      statistics: userData.statistics,
      updatedAt: userData.updatedAt,
      recordingHistory: recordingHistory.sort(
        (a, b) =>
          new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime()
      ),
      setDetails,
    } as ParticipantDetail;

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
