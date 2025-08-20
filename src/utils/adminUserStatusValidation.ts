// utils/adminUserStatusValidation.ts
import { User, RoundStatus } from "@/types/user";

/**
 * 관리자 대시보드 전용 세분화된 사용자 상태
 */
export enum AdminUserStatus {
  // 가이드/온보딩 단계
  GUIDE_INCOMPLETE = "guide_incomplete", // 가이드 미완료

  // 1회차 관련
  ROUND_1_IN_PROGRESS = "round_1_in_progress", // 1회차 진행중
  ROUND_1_WAITING_APPROVAL = "round_1_waiting_approval", // 1회차 승인대기

  // 2회차 관련
  ROUND_2_WAITING = "round_2_waiting", // 2회차 대기중 (1회차 승인 후)
  ROUND_2_IN_PROGRESS = "round_2_in_progress", // 2회차 진행중
  ROUND_2_WAITING_APPROVAL = "round_2_waiting_approval", // 2회차 승인대기

  // 완료/기타
  ALL_COMPLETED = "all_completed", // 모든 작업 완료
  BLOCKED = "blocked", // 차단된 사용자
  TUTORIAL_REQUIRED = "tutorial_required", // 튜토리얼 필요
}

/**
 * 관리자 대시보드용 사용자 상태 분석 결과
 */
export interface AdminUserStatusAnalysis {
  status: AdminUserStatus;
  canAccessStartPage: boolean;
  currentRound: number;
  maxAllowedRounds: number;
  reason?: string;
  redirectPath?: string;
  statusKorean: string; // 한국어 상태명
}

/**
 * 관리자 대시보드 전용 - 세분화된 사용자 상태 분석
 */
export function analyzeUserStatusForAdmin(
  user: User | null | undefined
): AdminUserStatusAnalysis {
  // 사용자 정보가 없는 경우
  if (!user) {
    return {
      status: AdminUserStatus.GUIDE_INCOMPLETE,
      canAccessStartPage: true,
      currentRound: 0,
      maxAllowedRounds: 2,
      reason: "사용자 정보 없음",
      statusKorean: "가이드 미완료",
    };
  }

  const currentRound = user.currentStatus.currentRoundNumber || 0;
  const maxRounds = user.settings.maxAllowedRounds || 2;
  const canStartRecording = user.currentStatus.canStartRecording;
  const canStartNextRound = user.currentStatus.canStartNextRound;
  const hasPendingApproval = user.currentStatus.hasPendingApproval;
  const completedPercentage =
    user.currentStatus.currentRoundProgress?.completedPercentage || 0;
  const isOnboardingCompleted = user.currentStatus.isOnboardingCompleted;
  const isTutorialCompleted = user.currentStatus.isTutorialCompleted;

  // 1. 가이드(온보딩) 미완료
  if (!isOnboardingCompleted) {
    return {
      status: AdminUserStatus.GUIDE_INCOMPLETE,
      canAccessStartPage: true,
      currentRound,
      maxAllowedRounds: maxRounds,
      reason: "온보딩 미완료",
      statusKorean: "가이드 미완료",
    };
  }

  // 2. 튜토리얼 미완료 (온보딩은 완료했지만 튜토리얼 필요)
  if (currentRound > 0 && !isTutorialCompleted) {
    return {
      status: AdminUserStatus.TUTORIAL_REQUIRED,
      canAccessStartPage: true,
      currentRound,
      maxAllowedRounds: maxRounds,
      reason: "튜토리얼 완료 필요",
      statusKorean: "튜토리얼 필요",
    };
  }

  // 3. 모든 라운드를 완료한 사용자 (currentRound > maxRounds)
  if (currentRound > maxRounds) {
    return {
      status: AdminUserStatus.ALL_COMPLETED,
      canAccessStartPage: false,
      currentRound,
      maxAllowedRounds: maxRounds,
      reason: "모든 라운드 완료",
      redirectPath: "/completion",
      statusKorean: "모든 작업 완료",
    };
  }

  // 4. 현재 라운드의 roundSummary 상태 확인
  const currentRoundSummary = user.roundSummaries?.find(
    (summary) => summary.roundNumber === currentRound
  );

  // === 1회차 관련 상태 분석 ===
  if (currentRound === 1) {
    // 1회차 승인 대기 상태 (완료 버튼 눌러서 submitted 상태)
    if (currentRoundSummary?.status === "submitted" || hasPendingApproval) {
      return {
        status: AdminUserStatus.ROUND_1_WAITING_APPROVAL,
        canAccessStartPage: false,
        currentRound,
        maxAllowedRounds: maxRounds,
        reason: "1회차 제출 완료, 관리자 승인 대기 중",
        redirectPath: "/completion?round=1",
        statusKorean: "1회차 승인대기",
      };
    }

    // 1회차 진행 중 (canStartRecording=true, completedPercentage < 100)
    if (canStartRecording && completedPercentage < 100) {
      return {
        status: AdminUserStatus.ROUND_1_IN_PROGRESS,
        canAccessStartPage: true,
        currentRound,
        maxAllowedRounds: maxRounds,
        statusKorean: "1회차 진행중",
      };
    }

    // 1회차 완료했지만 아직 완료 버튼을 누르지 않은 상태
    if (completedPercentage === 100 && canStartRecording) {
      return {
        status: AdminUserStatus.ROUND_1_IN_PROGRESS,
        canAccessStartPage: true,
        currentRound,
        maxAllowedRounds: maxRounds,
        reason: "1회차 완료, 완료 버튼 대기",
        statusKorean: "1회차 진행중",
      };
    }
  }

  // === 2회차 관련 상태 분석 (개선된 구분 로직) ===
  if (currentRound === 2) {
    // 2회차 승인 대기 상태 (완료 버튼 눌러서 submitted 상태)
    if (currentRoundSummary?.status === "submitted" || hasPendingApproval) {
      return {
        status: AdminUserStatus.ROUND_2_WAITING_APPROVAL,
        canAccessStartPage: false,
        currentRound,
        maxAllowedRounds: maxRounds,
        reason: "2회차 제출 완료, 관리자 승인 대기 중",
        redirectPath: "/completion?round=2",
        statusKorean: "2회차 승인대기",
      };
    }

    // 2회차 시작 가능하지만 아직 시작 안함 (대기중)
    // 조건: canStartRecording=true, 하지만 아직 아무 작업도 시작하지 않음
    if (canStartRecording && canStartNextRound && completedPercentage === 0) {
      const submittedPercentage =
        user.currentStatus.currentRoundProgress?.submittedPercentage || 0;

      // 제출한 작업이 하나도 없으면 "대기중" 상태
      if (submittedPercentage === 0) {
        return {
          status: AdminUserStatus.ROUND_2_WAITING,
          canAccessStartPage: true,
          currentRound,
          maxAllowedRounds: maxRounds,
          reason: "1회차 승인 완료, 2회차 시작 대기",
          statusKorean: "2회차 대기중",
        };
      }
    }

    // 2회차 실제 진행 중 (작업을 시작했거나 진행 중)
    // 조건: completedPercentage > 0 이거나 이미 일부 작업을 제출함
    if (canStartRecording && completedPercentage > 0) {
      return {
        status: AdminUserStatus.ROUND_2_IN_PROGRESS,
        canAccessStartPage: true,
        currentRound,
        maxAllowedRounds: maxRounds,
        statusKorean: "2회차 진행중",
      };
    }

    // 2회차 완료했지만 아직 완료 버튼을 누르지 않은 상태
    if (completedPercentage === 100 && canStartRecording) {
      return {
        status: AdminUserStatus.ROUND_2_IN_PROGRESS,
        canAccessStartPage: true,
        currentRound,
        maxAllowedRounds: maxRounds,
        reason: "2회차 완료, 완료 버튼 대기",
        statusKorean: "2회차 진행중",
      };
    }

    // 예외적인 2회차 대기 상태 (승인됐지만 권한이 아직 활성화 안됨)
    if (!canStartRecording && !canStartNextRound) {
      return {
        status: AdminUserStatus.ROUND_2_WAITING,
        canAccessStartPage: true,
        currentRound,
        maxAllowedRounds: maxRounds,
        reason: "1회차 승인 완료, 2회차 권한 대기",
        statusKorean: "2회차 대기중",
      };
    }
  }

  // === 라운드 시작 가능 상태 ===
  // 새로 시작하는 사용자 또는 다음 라운드 시작 가능
  if (
    (currentRound === 0 && canStartNextRound) ||
    (canStartRecording && canStartNextRound && completedPercentage === 0)
  ) {
    if (currentRound === 0 || currentRound === 1) {
      return {
        status: AdminUserStatus.ROUND_1_IN_PROGRESS,
        canAccessStartPage: true,
        currentRound: currentRound || 1,
        maxAllowedRounds: maxRounds,
        statusKorean: "1회차 진행중",
      };
    } else if (currentRound === 2) {
      return {
        status: AdminUserStatus.ROUND_2_IN_PROGRESS,
        canAccessStartPage: true,
        currentRound,
        maxAllowedRounds: maxRounds,
        statusKorean: "2회차 진행중",
      };
    }
  }

  // === 기타 상태 (안전장치) ===
  return {
    status: AdminUserStatus.BLOCKED,
    canAccessStartPage: false,
    currentRound,
    maxAllowedRounds: maxRounds,
    reason: "상태를 판단할 수 없음",
    redirectPath: "/completion",
    statusKorean: "접근 차단",
  };
}

/**
 * 관리자 대시보드용 상태 통계 생성
 */
export function getAdminUserStatusStatistics(
  users: User[]
): Record<AdminUserStatus, number> {
  const stats = Object.values(AdminUserStatus).reduce((acc, status) => {
    acc[status] = 0;
    return acc;
  }, {} as Record<AdminUserStatus, number>);

  users.forEach((user) => {
    const analysis = analyzeUserStatusForAdmin(user);
    stats[analysis.status]++;
  });

  return stats;
}

/**
 * 관리자 대시보드용 한국어 상태명 매핑
 */
export const ADMIN_STATUS_KOREAN_MAP: Record<AdminUserStatus, string> = {
  [AdminUserStatus.GUIDE_INCOMPLETE]: "가이드 미완료",
  [AdminUserStatus.ROUND_1_IN_PROGRESS]: "1회차 진행중",
  [AdminUserStatus.ROUND_1_WAITING_APPROVAL]: "1회차 승인대기",
  [AdminUserStatus.ROUND_2_WAITING]: "2회차 대기중",
  [AdminUserStatus.ROUND_2_IN_PROGRESS]: "2회차 진행중",
  [AdminUserStatus.ROUND_2_WAITING_APPROVAL]: "2회차 승인대기",
  [AdminUserStatus.ALL_COMPLETED]: "모든 작업 완료",
  [AdminUserStatus.BLOCKED]: "접근 차단",
  [AdminUserStatus.TUTORIAL_REQUIRED]: "튜토리얼 필요",
};

/**
 * AdminUserStatus를 기존 4단계 상태로 매핑하는 헬퍼 함수
 * (기존 통계나 필터 로직에서 필요한 경우 사용)
 */
export function mapToLegacyStatus(
  adminStatus: AdminUserStatus
): "not_started" | "in_progress" | "completed" | "inactive" {
  switch (adminStatus) {
    case AdminUserStatus.GUIDE_INCOMPLETE:
    case AdminUserStatus.TUTORIAL_REQUIRED:
      return "not_started";

    case AdminUserStatus.ROUND_1_IN_PROGRESS:
    case AdminUserStatus.ROUND_2_IN_PROGRESS:
    case AdminUserStatus.ROUND_2_WAITING:
      return "in_progress";

    case AdminUserStatus.ROUND_1_WAITING_APPROVAL:
    case AdminUserStatus.ROUND_2_WAITING_APPROVAL:
    case AdminUserStatus.ALL_COMPLETED:
      return "completed";

    case AdminUserStatus.BLOCKED:
    default:
      return "inactive";
  }
}
