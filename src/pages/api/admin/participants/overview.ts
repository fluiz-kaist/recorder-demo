// pages/api/admin/participants/overview.ts - 용어 및 컬렉션 정리
import { NextApiRequest, NextApiResponse } from "next";
import { adminDb } from "@/lib/firebase/admin";
import { User, RoundStatus } from "@/types/user";
import { analyzeUserStatus } from "@/utils/userStatusValidation";

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

  //현재 진행중인 라운드
  currentRound?: number;
}

interface ParticipantsOverviewResponse {
  success: boolean;
  data?: {
    participants: ParticipantOverview[];
    totalCount: number;

    statistics: {
      // 3단계 통계
      totalApplicants: number; // 참가 신청자 (authorizedUsers)
      totalRegisteredUsers: number; // 가입 완료자 (users)
      activeParticipants: number; // 작업 진행자 (실제 작업 시작한 사람)

      // 가입 완료자들을 기준으로
      startedParticipants: number;
      completedParticipants: number;
      activeInLast7Days: number;
    };
  };
  message?: string;
}

// 참여자 상태 계산 함수
const calculateParticipantStatus = (user: User) => {
  // 유틸 함수로 정확한 상태 분석
  const userStatusAnalysis = analyzeUserStatus(user);

  // 관리자용 간단한 상태로 매핑
  let simpleStatus: ParticipantOverview["status"];

  switch (userStatusAnalysis.status) {
    case "new_user":
      simpleStatus = "not_started";
      break;
    case "in_progress":
    case "can_start_next_round":
      simpleStatus = "in_progress";
      break;
    case "waiting_for_approval":
      simpleStatus = "completed"; // 또는 새로운 상태 추가
      break;
    case "all_completed":
      simpleStatus = "completed";
      break;
    default:
      // 7일 이상 비활성화 체크 (기존 로직 유지)
      const lastAccess = new Date(user.profile.lastAccessAt as string);
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      simpleStatus = lastAccess < sevenDaysAgo ? "inactive" : "not_started";
      break;
  }

  return simpleStatus;
};
// 전체 진행률 계산 함수
const calculateOverallProgress = (user: User): number => {
  const maxRounds = user.settings.maxAllowedRounds || 2;
  const roundWeight = 100 / maxRounds; // 라운드당 비율 (2라운드면 50%씩)
  let overallProgress = 0;

  // 1. 완료된 라운드들은 각각 roundWeight% 추가
  const completedRounds = user.roundSummaries.filter(
    (round) =>
      round.status === RoundStatus.COMPLETED ||
      round.status === RoundStatus.APPROVED
  );

  overallProgress += completedRounds.length * roundWeight;

  // 2. 현재 진행 중인 라운드의 부분 진행률 추가
  const currentRoundNumber = user.currentStatus.currentRoundNumber;

  if (currentRoundNumber > 0 && currentRoundNumber <= maxRounds) {
    // 현재 라운드가 이미 완료된 경우는 제외
    const currentRoundSummary = user.roundSummaries.find(
      (round) => round.roundNumber === currentRoundNumber
    );

    const isCurrentRoundCompleted =
      currentRoundSummary?.status === RoundStatus.COMPLETED ||
      currentRoundSummary?.status === RoundStatus.APPROVED;

    if (!isCurrentRoundCompleted) {
      const currentRoundProgress =
        user.currentStatus.currentRoundProgress.completedPercentage || 0;
      overallProgress += (currentRoundProgress * roundWeight) / 100;
    }
  }

  return Math.round(Math.min(overallProgress, 100)); // 100% 초과 방지
};

// 정렬 함수
const sortParticipants = (
  participants: ParticipantOverview[],
  sortBy: string,
  sortOrder: "asc" | "desc"
): ParticipantOverview[] => {
  return participants.sort((a, b) => {
    let comparison = 0;

    switch (sortBy) {
      case "lastAccessAt":
        // 최근 접속 시간 기준 정렬 (기본값)
        const dateA = new Date(a.lastAccessAt).getTime();
        const dateB = new Date(b.lastAccessAt).getTime();
        comparison = dateA - dateB;
        break;

      case "createdAt":
        // 계정 생성 시간 기준 정렬
        const createdA = new Date(a.createdAt).getTime();
        const createdB = new Date(b.createdAt).getTime();
        comparison = createdA - createdB;
        break;

      case "userName":
        // 사용자명 기준 정렬
        const nameA = a.userName || "";
        const nameB = b.userName || "";
        comparison = nameA.localeCompare(nameB);
        break;

      case "overallProgress":
        // 전체 진행률 기준 정렬
        comparison = a.overallProgress - b.overallProgress;
        break;

      case "totalRecordings":
        // 총 녹음 수 기준 정렬
        comparison = a.totalRecordings - b.totalRecordings;
        break;

      case "status":
        // 상태 기준 정렬 (우선순위: completed > in_progress > not_started > inactive)
        const statusPriority = {
          completed: 4,
          in_progress: 3,
          not_started: 2,
          inactive: 1,
        };
        comparison = statusPriority[a.status] - statusPriority[b.status];
        break;

      default:
        // 기본값: 최근 접속 시간
        const defaultDateA = new Date(a.lastAccessAt).getTime();
        const defaultDateB = new Date(b.lastAccessAt).getTime();
        comparison = defaultDateA - defaultDateB;
        break;
    }

    // 내림차순이면 결과를 뒤집음
    return sortOrder === "desc" ? -comparison : comparison;
  });
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

  // 컬렉션 이름 정리
  const registeredUsersCollection =
    process.env.NEXT_PUBLIC_DB_USER_COLLECTION || "users-temp";
  const applicantsCollection =
    process.env.NEXT_PUBLIC_DB_WHITELIST_USERS_COLLECTION || "whitelist-temp";

  try {
    // 관리자 권한 확인
    const adminToken = req.cookies["admin-token"];
    if (!adminToken) {
      return res.status(401).json({
        success: false,
        message: "관리자 권한이 필요합니다.",
      });
    }

    // 쿼리 파라미터 추출 (정렬은 클라이언트에서 처리)
    const { status, gender, ageGroup, search } = req.query;

    //TODO: 관리자 제대로 패스 해주기 필요
    // 1. 참가 신청자 수 조회 (화이트리스트)
    const applicantsSnapshot = await adminDb
      .collection(applicantsCollection)
      .get();
    const totalApplicants = applicantsSnapshot.size;

    // 2-1. 전체 통계용 쿼리 (필터 없음)
    const allUsersSnapshot = await adminDb
      .collection(registeredUsersCollection)
      .get();
    const totalRegisteredUsers = allUsersSnapshot.size;
    console.log("totalRegisteredUsers?", totalRegisteredUsers);

    // 튜토리얼 완료자 계산 (전체 기준)
    const allUsers = allUsersSnapshot.docs.map(
      (doc) => ({ ...doc.data() } as User)
    );

    // console.log("=== 디버깅 시작 ===");
    // console.log("전체 사용자 수:", allUsers.length);

    // // 각 사용자의 currentStatus 상태 확인
    // allUsers.forEach((user, index) => {
    //   console.log(`사용자 ${index + 1}:`, {
    //     userId: user.profile?.userId || "userId 없음",
    //     hasCurrentStatus: !!user.currentStatus,
    //     currentStatus: user.currentStatus,
    //     isTutorialCompleted: user.currentStatus?.isTutorialCompleted,
    //   });

    //   // currentStatus가 없는 사용자가 있다면 전체 구조 확인
    //   if (!user.currentStatus) {
    //     console.log(`currentStatus 없는 사용자 전체 데이터:`, user);
    //   }
    // });

    // const activeParticipants = allUsers.filter(
    //   (user) => user.currentStatus?.isTutorialCompleted // ?. 연산자 추가해서 일단 에러 방지
    // ).length;

    // console.log("activeParticipants 계산 결과:", activeParticipants);
    // console.log("=== 디버깅 끝 ===");

    const activeParticipants = allUsers.filter(
      (user) => user.currentStatus.isTutorialCompleted
    ).length;

    // 2-2. 생성 시간 순으로 정렬하여 조회 (클라이언트에서 추가 정렬 예정)
    const filteredQuery = adminDb
      .collection(registeredUsersCollection)
      .orderBy("profile.createdAt", "desc"); // 최신 생성 순으로 기본 정렬

    const filteredSnapshot = await filteredQuery.get();

    const tt = filteredSnapshot.size;
    console.log("tt?", tt);
    const filteredUsers = filteredSnapshot.docs.map(
      (doc) => ({ ...doc.data() } as User)
    );

    // 검색 필터 적용 (클라이언트 사이드)
    let finalUsers = filteredUsers;
    if (search) {
      const searchTerm = (search as string).toLowerCase();
      finalUsers = filteredUsers.filter(
        (user) =>
          user.profile.userName?.toLowerCase().includes(searchTerm) ||
          user.profile.userId.toLowerCase().includes(searchTerm)
      );
    }

    // 상태 필터 적용
    if (status) {
      finalUsers = finalUsers.filter((user) => {
        const userStatus = calculateParticipantStatus(user);
        return userStatus === status;
      });
    }

    // 성별 필터 적용
    if (gender) {
      finalUsers = finalUsers.filter((user) => user.profile.gender === gender);
    }

    // 연령대 필터 적용
    if (ageGroup) {
      finalUsers = finalUsers.filter(
        (user) => user.profile.ageGroup === ageGroup
      );
    }

    // 참여자 데이터 변환
    // console.log("filteredUsers?", filteredUsers);
    const participants: ParticipantOverview[] = finalUsers.map((user) => {
      const participantStatus = calculateParticipantStatus(user);
      const overallProgress = calculateOverallProgress(user);

      // console.log("이거 뭐야? participantStatus", participantStatus);

      return {
        userId: user.profile.userId,
        userName: user.profile.userName,
        gender: user.profile.gender,
        ageGroup: user.profile.ageGroup,
        createdAt: user.profile.createdAt as string,
        lastAccessAt: user.profile.lastAccessAt as string,

        currentRound: user.currentStatus.currentRoundNumber,

        hasStarted: user.currentStatus.isOnboardingCompleted,
        currentSetNumber: user.currentStatus.currentRoundNumber,
        totalCompletedSets:
          user.statistics.overall?.totalParticipationRounds || 0,
        overallProgress,

        totalRecordings:
          user.statistics.overall?.totalTasksCompleted ||
          user.statistics.current.completedTasks,
        totalApprovedRecordings:
          user.statistics.overall?.totalTasksApproved ||
          user.statistics.current.approvedTasks,
        averageQualityScore: user.statistics.overall?.averageQualityScore || 0,

        status: participantStatus,
        lastRecordingAt:
          (user.statistics.overall?.lastParticipationAt as string) || undefined,
      };
    });

    // 정렬은 클라이언트에서 처리하므로 제거
    // const sortedParticipants = sortParticipants(
    //   participants,
    //   sortBy as string,
    //   sortOrder as "asc" | "desc"
    // );

    // console.log(
    //   "totalRegisteredUsers, activeParticipants",
    //   totalRegisteredUsers,
    //   activeParticipants
    // );

    // 전체 통계 계산
    const statistics = {
      // 3단계 통계
      totalApplicants, // 참가 신청자 (whitelist)
      totalRegisteredUsers, // 가입 완료자 (users)
      activeParticipants, // 작업 참여자 (실제 작업 시작)

      // 기존 통계 (users 기준)
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
        participants: participants, // 생성 순으로 정렬된 원본 데이터
        totalCount: participants.length,
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
