// pages/api/admin/progress/[userId].ts - Admin SDK로 변경
import { NextApiRequest, NextApiResponse } from "next";
import { getDocByIdAdmin } from "@/lib/firebase/firestoreAdmin"; // Admin SDK 추가
import { FieldValue, Timestamp } from "firebase-admin/firestore"; // Admin SDK로 변경
import { User } from "@/types/firebase";

interface UserProgressDetail {
  userId: string;
  userName?: string;
  basicInfo: {
    gender: "남성" | "여성";
    ageGroup: string;
    createdAt: string;
    completedAt?: string | FieldValue | Timestamp;
    lastAccessAt: string;
  };

  // 전체 진행 상황
  overallProgress: {
    percentage: number;
    totalTasks: number;
    completedTasks: number;
    remainingTasks: number;
  };

  // 세트별 상세 진행
  setDetails: Array<{
    setNumber: number;
    setId: number;
    status: string;
    assignedAt?: string;
    completedAt?: string;

    progress: {
      totalTasks: number;
      completedTasks: number;
      percentage: number;
    };

    taskBreakdown: {
      situational: {
        total: number;
        completed: number;
        remaining: number;
        tasks: Array<{
          taskKey: string;
          status: string;
          completedAt?: string;
        }>;
      };
      formal: {
        total: number;
        completed: number;
        remaining: number;
        tasks: Array<{
          taskKey: string;
          status: string;
          completedAt?: string;
        }>;
      };
    };
  }>;

  // 녹음 품질 정보
  qualityInfo: {
    averageScore: number;
    totalRecordings: number;
    approvedRecordings: number;
    recentRecordings: Array<{
      taskKey: string;
      taskType: string;
      recordedAt: string;
      qualityScore: number;
      status: string;
    }>;
  };

  // 활동 패턴
  activityPattern: {
    firstRecordingAt?: string;
    lastRecordingAt?: string;
    averageSessionLength?: number;
    mostActiveTimeOfDay?: string;
    totalSessions: number;
  };
}

interface UserProgressDetailResponse {
  success: boolean;
  data?: UserProgressDetail;
  message?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<UserProgressDetailResponse>
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

    const { userId } = req.query;

    if (!userId || typeof userId !== "string") {
      return res.status(400).json({
        success: false,
        message: "유효한 사용자 ID가 필요합니다.",
      });
    }

    // 사용자 정보 조회
    const userData = await getDocByIdAdmin(userCollectionName, userId); // Admin SDK로 변경

    if (!userData) {
      return res.status(404).json({
        success: false,
        message: "사용자를 찾을 수 없습니다.",
      });
    }

    // 전체 진행률 계산
    const totalTasks =
      userData.participation?.sets?.reduce(
        (sum: any, set: any) => sum + set.progress.totalTasks,
        0
      ) || 0;
    const completedTasks =
      userData.participation?.sets?.reduce(
        (sum: any, set: any) => sum + set.progress.completedTasks,
        0
      ) || 0;
    const overallPercentage =
      totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    // 세트별 상세 정보
    const setDetails =
      userData.participation?.sets?.map((set: any) => ({
        setNumber: set.setNumber,
        setId: set.setId,
        status: set.status,
        assignedAt: set.assignedAt,
        completedAt: set.completedAt,

        progress: {
          totalTasks: set.progress.totalTasks,
          completedTasks: set.progress.completedTasks,
          percentage:
            set.progress.totalTasks > 0
              ? Math.round(
                  (set.progress.completedTasks / set.progress.totalTasks) * 100
                )
              : 0,
        },

        taskBreakdown: {
          situational: {
            total: set.progress.situational.total,
            completed: set.progress.situational.completed,
            remaining:
              set.progress.situational.total -
              set.progress.situational.completed,
            tasks: set.tasks.situational.map((task: any) => ({
              taskKey: task.taskKey,
              status: task.status,
              completedAt: task.completedAt,
            })),
          },
          formal: {
            total: set.progress.formal.total,
            completed: set.progress.formal.completed,
            remaining:
              set.progress.formal.total - set.progress.formal.completed,
            tasks: set.tasks.formal.map((task: any) => ({
              taskKey: task.taskKey,
              status: task.status,
              completedAt: task.completedAt,
            })),
          },
        },
      })) || [];

    // 녹음 품질 정보 (간단 버전)
    const qualityInfo = {
      averageScore: userData.participation?.stats?.averageQualityScore || 0,
      totalRecordings: userData.participation?.stats?.totalRecordings || 0,
      approvedRecordings:
        userData.participation?.stats?.totalApprovedRecordings || 0,
      recentRecordings: [], // 실제로는 별도 쿼리 필요
    };

    // 활동 패턴 (기본 정보만)
    const activityPattern = {
      firstRecordingAt: userData.participation?.stats?.firstParticipationAt,
      lastRecordingAt: userData.participation?.stats?.lastParticipationAt,
      totalSessions: userData.participation?.sets?.length || 0,
    };

    const userProgressDetail: UserProgressDetail = {
      userId: userData.id,
      userName: userData.userName,
      basicInfo: {
        gender: userData.gender,
        ageGroup: userData.ageGroup,
        createdAt: userData.createdAt,
        completedAt: userData.completedAt,
        lastAccessAt: userData.lastAccessAt,
      },
      overallProgress: {
        percentage: overallPercentage,
        totalTasks,
        completedTasks,
        remainingTasks: totalTasks - completedTasks,
      },
      setDetails,
      qualityInfo,
      activityPattern,
    };

    return res.status(200).json({
      success: true,
      data: userProgressDetail,
    });
  } catch (error) {
    console.error("사용자 진행 상황 조회 오류:", error);
    return res.status(500).json({
      success: false,
      message: "서버 오류가 발생했습니다.",
    });
  }
}
