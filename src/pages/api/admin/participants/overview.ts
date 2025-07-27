// pages/api/admin/participants/overview.ts
import { NextApiRequest, NextApiResponse } from "next";
import {
  collection,
  query,
  where,
  getDocs,
  orderBy,
  limit,
  startAfter,
  documentId,
} from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { User } from "@/types/firebase";

export interface ParticipantOverview {
  userId: string;
  userName?: string;
  gender: "남성" | "여성";
  ageGroup: string;
  createdAt: string;
  lastAccessAt: string;

  // 진행 상태
  hasStarted: boolean; // 온보딩 완료 여부
  currentSetNumber: number;
  totalCompletedSets: number;
  overallProgress: number; // 전체 진행률 (%)

  // 녹음 통계
  totalRecordings: number;
  totalApprovedRecordings: number;
  averageQualityScore: number;

  // 상태
  status: "not_started" | "in_progress" | "completed" | "inactive";
  lastRecordingAt?: string;
}

interface ParticipantsOverviewResponse {
  success: boolean;
  data?: {
    participants: ParticipantOverview[];
    totalCount: number;
    pagination: {
      currentPage: number;
      totalPages: number;
      hasNextPage: boolean;
      hasPrevPage: boolean;
    };
    statistics: {
      totalParticipants: number;
      startedParticipants: number;
      completedParticipants: number;
      activeInLast7Days: number;
    };
  };
  message?: string;
}

// 참여자 상태 계산 함수
const calculateParticipantStatus = (
  user: User
): ParticipantOverview["status"] => {
  if (!user.completedAt) return "not_started";

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

  if (completedTasks === totalTasks && totalTasks > 0) return "completed";
  if (completedTasks > 0) return "in_progress";

  // 7일 이상 비활성화 체크
  const lastAccess = new Date(user.lastAccessAt);
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  if (lastAccess < sevenDaysAgo) return "inactive";

  return "not_started";
};

// 전체 진행률 계산 함수
const calculateOverallProgress = (user: User): number => {
  if (!user.participation?.sets?.length) return 0;

  const totalTasks = user.participation.sets.reduce(
    (sum, set) => sum + set.progress.totalTasks,
    0
  );
  const completedTasks = user.participation.sets.reduce(
    (sum, set) => sum + set.progress.completedTasks,
    0
  );

  return totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ParticipantsOverviewResponse>
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

    // 쿼리 파라미터 추출
    const {
      page = "1",
      limit: queryLimit = "20",
      sortBy = "createdAt",
      sortOrder = "desc",
      status,
      gender,
      ageGroup,
      search,
    } = req.query;

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(queryLimit as string, 10);

    // 기본 쿼리 생성
    let q = query(
      collection(db, userCollectionName),
      orderBy(sortBy as string, sortOrder as "asc" | "desc")
    );

    // 필터 적용
    if (gender) {
      q = query(q, where("gender", "==", gender));
    }
    if (ageGroup) {
      q = query(q, where("ageGroup", "==", ageGroup));
    }

    // 페이지네이션을 위한 쿼리 실행
    const allUsersSnapshot = await getDocs(q);
    const totalCount = allUsersSnapshot.size;

    // 페이지네이션 계산
    const totalPages = Math.ceil(totalCount / limitNum);
    const startIndex = (pageNum - 1) * limitNum;
    const endIndex = startIndex + limitNum;

    // 현재 페이지 데이터 추출
    const allUsers = allUsersSnapshot.docs
      .map((doc) => ({ id: doc.id, ...doc.data() } as User))
      .slice(startIndex, endIndex);

    // 검색 필터 적용 (클라이언트 사이드)
    let filteredUsers = allUsers;
    if (search) {
      const searchTerm = (search as string).toLowerCase();
      filteredUsers = allUsers.filter(
        (user) =>
          user.userName?.toLowerCase().includes(searchTerm) ||
          user.id.toLowerCase().includes(searchTerm)
      );
    }

    // 참여자 데이터 변환
    const participants: ParticipantOverview[] = filteredUsers.map((user) => {
      const participantStatus = calculateParticipantStatus(user);
      const overallProgress = calculateOverallProgress(user);

      return {
        userId: user.id,
        userName: user.userName,
        gender: user.gender,
        ageGroup: user.ageGroup,
        createdAt: user.createdAt,
        lastAccessAt: user.lastAccessAt,

        hasStarted: !!user.completedAt,
        currentSetNumber: user.participation?.currentSetNumber || 1,
        totalCompletedSets: user.participation?.totalCompletedSets || 0,
        overallProgress,

        totalRecordings: user.participation?.stats?.totalRecordings || 0,
        totalApprovedRecordings:
          user.participation?.stats?.totalApprovedRecordings || 0,
        averageQualityScore:
          user.participation?.stats?.averageQualityScore || 0,

        status: participantStatus,
        lastRecordingAt: user.participation?.stats?.lastParticipationAt,
      };
    });

    // 상태별 필터링
    let finalParticipants = participants;
    if (status) {
      finalParticipants = participants.filter((p) => p.status === status);
    }

    // 전체 통계 계산
    const statistics = {
      totalParticipants: totalCount,
      startedParticipants: participants.filter((p) => p.hasStarted).length,
      completedParticipants: participants.filter(
        (p) => p.status === "completed"
      ).length,
      activeInLast7Days: participants.filter((p) => {
        const lastAccess = new Date(p.lastAccessAt);
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        return lastAccess >= sevenDaysAgo;
      }).length,
    };

    return res.status(200).json({
      success: true,
      data: {
        participants: finalParticipants,
        totalCount: finalParticipants.length,
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
    console.error("참여자 목록 조회 오류:", error);
    return res.status(500).json({
      success: false,
      message: "서버 오류가 발생했습니다.",
    });
  }
}
