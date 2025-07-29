// pages/api/admin/progress/overview.ts
import { NextApiRequest, NextApiResponse } from "next";
import { User } from "@/types/firebase";
import { adminDb } from "@/lib/firebase/admin";


export interface ProgressOverview {
  // 전체 통계
  totalParticipants: number;
  registeredParticipants: number; // 온보딩 완료
  activeParticipants: number; // 녹음 시작한 사람
  completedParticipants: number; // 모든 녹음 완료

  // 진행률 분포
  progressDistribution: {
    notStarted: number; // 0%
    inProgress: {
      "1-25": number;
      "26-50": number;
      "51-75": number;
      "76-99": number;
    };
    completed: number; // 100%
  };

  // 세트별 진행 현황
  setProgress: {
    set1: {
      assigned: number;
      inProgress: number;
      completed: number;
    };
    set2: {
      assigned: number;
      inProgress: number;
      completed: number;
    };
    set3: {
      assigned: number;
      inProgress: number;
      completed: number;
    };
  };

  // 최근 활동
  recentActivity: {
    last24Hours: number;
    last7Days: number;
    last30Days: number;
  };

  // 품질 통계
  qualityStats: {
    averageQualityScore: number;
    totalRecordings: number;
    approvedRecordings: number;
    approvalRate: number;
  };
}

interface ProgressOverviewResponse {
  success: boolean;
  data?: ProgressOverview;
  message?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ProgressOverviewResponse>
) {
  if (req.method !== "GET") {
    return res.status(405).json({
      success: false,
      message: "Method not allowed",
    });
  }

  const userCollectionName =
    process.env.NEXT_PUBLIC_DB_USER_COLLECTION || "users-temp";

  try {
    // 관리자 권한 확인
    const adminToken = req.cookies["admin-token"];
    if (!adminToken) {
      return res.status(401).json({
        success: false,
        message: "관리자 권한이 필요합니다.",
      });
    }

    // 모든 사용자 데이터 조회 (200명 이하이므로 전체 조회)
    const usersSnapshot = await adminDb
      .collection(userCollectionName)
      .orderBy("createdAt", "desc")
      .get();

    const allUsers = usersSnapshot.docs.map(
      (doc) => ({ id: doc.id, ...doc.data() } as User)
    );

    // 시간 기준점 설정
    const now = new Date();
    const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // 통계 계산
    const totalParticipants = allUsers.length;
    let registeredParticipants = 0;
    let activeParticipants = 0;
    let completedParticipants = 0;

    // 진행률 분포
    const progressDistribution = {
      notStarted: 0,
      inProgress: {
        "1-25": 0,
        "26-50": 0,
        "51-75": 0,
        "76-99": 0,
      },
      completed: 0,
    };

    // 세트별 진행 현황
    const setProgress = {
      set1: { assigned: 0, inProgress: 0, completed: 0 },
      set2: { assigned: 0, inProgress: 0, completed: 0 },
      set3: { assigned: 0, inProgress: 0, completed: 0 },
    };

    // 최근 활동
    const recentActivity = {
      last24Hours: 0,
      last7Days: 0,
      last30Days: 0,
    };

    // 품질 통계
    let totalQualityScore = 0;
    let totalRecordings = 0;
    let approvedRecordings = 0;
    let usersWithQuality = 0;

    // 각 사용자별 분석
    allUsers.forEach((user) => {
      // 등록 완료 여부
      if (user.completedAt) {
        registeredParticipants++;
      }

      // 전체 진행률 계산
      const totalTasks =
        user.participation?.sets?.reduce(
          (sum, set) => sum + set.progress.totalTasks,
          0
        ) || 0;
      const completedTasks =
        user.participation?.sets?.reduce(
          (sum, set) => sum + set.progress.completedTasks,
          0
        ) || 0;

      const overallProgress =
        totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

      // 활성 참여자 (녹음을 시작한 사람)
      if (completedTasks > 0) {
        activeParticipants++;
      }

      // 완료 참여자
      if (overallProgress === 100) {
        completedParticipants++;
      }

      // 진행률 분포
      if (overallProgress === 0) {
        progressDistribution.notStarted++;
      } else if (overallProgress === 100) {
        progressDistribution.completed++;
      } else if (overallProgress <= 25) {
        progressDistribution.inProgress["1-25"]++;
      } else if (overallProgress <= 50) {
        progressDistribution.inProgress["26-50"]++;
      } else if (overallProgress <= 75) {
        progressDistribution.inProgress["51-75"]++;
      } else {
        progressDistribution.inProgress["76-99"]++;
      }

      // 세트별 진행 현황
      user.participation?.sets?.forEach((set) => {
        const setKey = `set${set.setNumber}` as keyof typeof setProgress;
        if (setProgress[setKey]) {
          setProgress[setKey].assigned++;

          if (set.progress.completedTasks === set.progress.totalTasks) {
            setProgress[setKey].completed++;
          } else if (set.progress.completedTasks > 0) {
            setProgress[setKey].inProgress++;
          }
        }
      });

      // 최근 활동 분석
      const lastAccess = new Date(user.lastAccessAt);
      if (lastAccess >= last24Hours) {
        recentActivity.last24Hours++;
      }
      if (lastAccess >= last7Days) {
        recentActivity.last7Days++;
      }
      if (lastAccess >= last30Days) {
        recentActivity.last30Days++;
      }

      // 품질 통계
      if (user.participation?.stats) {
        totalRecordings += user.participation.stats.totalRecordings || 0;
        approvedRecordings +=
          user.participation.stats.totalApprovedRecordings || 0;

        if (user.participation.stats.averageQualityScore > 0) {
          totalQualityScore += user.participation.stats.averageQualityScore;
          usersWithQuality++;
        }
      }
    });

    // 품질 통계 계산
    const averageQualityScore =
      usersWithQuality > 0
        ? Math.round(totalQualityScore / usersWithQuality)
        : 0;
    const approvalRate =
      totalRecordings > 0
        ? Math.round((approvedRecordings / totalRecordings) * 100)
        : 0;

    const overview: ProgressOverview = {
      totalParticipants,
      registeredParticipants,
      activeParticipants,
      completedParticipants,
      progressDistribution,
      setProgress,
      recentActivity,
      qualityStats: {
        averageQualityScore,
        totalRecordings,
        approvedRecordings,
        approvalRate,
      },
    };

    return res.status(200).json({
      success: true,
      data: overview,
    });
  } catch (error) {
    console.error("진행 상황 조회 오류:", error);
    return res.status(500).json({
      success: false,
      message: "서버 오류가 발생했습니다.",
    });
  }
}
