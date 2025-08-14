// utils/userStatusValidation.ts
import { User, RoundStatus } from "@/types/user";

/**
 * 사용자의 현재 상태를 분류하는 열거형
 */
export enum UserAccessStatus {
  // 시작 화면 접근 가능한 상태들
  NEW_USER = "new_user",                    // 새로 시작하는 사람
  CAN_START_NEXT_ROUND = "can_start_next_round", // 허락 받아서 다음 단계를 할 수 있는 사람
  IN_PROGRESS = "in_progress",              // 현재 진행 중인 사람
  
  // 시작 화면 접근 불가능한 상태들
  WAITING_FOR_APPROVAL = "waiting_for_approval", // 승인 대기 중인 사람
  ALL_COMPLETED = "all_completed",          // 모든 라운드 완료한 사람
  BLOCKED = "blocked",                      // 차단된 사용자
}

/**
 * 사용자 상태 분석 결과
 */
export interface UserStatusAnalysis {
  status: UserAccessStatus;
  canAccessStartPage: boolean;
  currentRound: number;
  maxAllowedRounds: number;
  reason?: string; // 접근 불가 시 이유
  redirectPath?: string; // 리다이렉트해야 할 경로
}

/**
 * 사용자의 현재 상태를 분석하는 메인 함수
 */
export function analyzeUserStatus(user: User | null | undefined): UserStatusAnalysis {
  // 사용자 정보가 없는 경우
  if (!user) {
    return {
      status: UserAccessStatus.NEW_USER,
      canAccessStartPage: true,
      currentRound: 0,
      maxAllowedRounds: 0,
      reason: "사용자 정보 없음"
    };
  }

  const currentRound = user.currentStatus.currentRoundNumber || 0;
  const maxRounds = user.settings.maxAllowedRounds || 2; // 기본값 2
  const canStartRecording = user.currentStatus.canStartRecording;
  const canStartNextRound = user.currentStatus.canStartNextRound;
  const completedPercentage = user.currentStatus.currentRoundProgress?.completedPercentage || 0;
  const hasPendingApproval = user.currentStatus.hasPendingApproval;

  // 1. 모든 라운드를 완료한 사용자
  if (currentRound > maxRounds) {
    return {
      status: UserAccessStatus.ALL_COMPLETED,
      canAccessStartPage: false,
      currentRound,
      maxAllowedRounds: maxRounds,
      reason: "모든 라운드 완료",
      redirectPath: "/completion"
    };
  }

  // 2. 새로 시작하는 사용자 (아직 라운드가 할당되지 않음)
  if (currentRound === 0) {
    return {
      status: UserAccessStatus.NEW_USER,
      canAccessStartPage: true,
      currentRound,
      maxAllowedRounds: maxRounds,
    };
  }

  // 3. 현재 라운드를 100% 완료했고 승인 대기 중인 상태
  if (completedPercentage === 100 && !canStartNextRound && !canStartRecording) {
    return {
      status: UserAccessStatus.WAITING_FOR_APPROVAL,
      canAccessStartPage: false,
      currentRound,
      maxAllowedRounds: maxRounds,
      reason: "관리자 승인 대기 중",
      redirectPath: "/completion"
    };
  }

  // 4. 다음 라운드 시작 허가를 받은 상태
  if (canStartNextRound && canStartRecording) {
    return {
      status: UserAccessStatus.CAN_START_NEXT_ROUND,
      canAccessStartPage: true,
      currentRound,
      maxAllowedRounds: maxRounds,
    };
  }

  // 5. 현재 라운드 진행 중
  if (canStartRecording && completedPercentage < 100) {
    return {
      status: UserAccessStatus.IN_PROGRESS,
      canAccessStartPage: true,
      currentRound,
      maxAllowedRounds: maxRounds,
    };
  }

  // 6. 기타 차단 상태 (안전장치)
  return {
    status: UserAccessStatus.BLOCKED,
    canAccessStartPage: false,
    currentRound,
    maxAllowedRounds: maxRounds,
    reason: "접근 권한 없음",
    redirectPath: "/completion"
  };
}

/**
 * 시작 페이지 접근 권한 확인 (간단한 버전)
 */
export function canAccessStartPage(user: User | null | undefined): boolean {
  const analysis = analyzeUserStatus(user);
  return analysis.canAccessStartPage;
}

/**
 * 특정 라운드 시작 가능 여부 확인
 */
export function canStartRound(user: User | null | undefined, roundNumber: number): boolean {
  if (!user) return roundNumber === 1; // 새 사용자는 1라운드만 시작 가능

  const analysis = analyzeUserStatus(user);
  
  // 접근 불가능한 상태면 라운드 시작 불가
  if (!analysis.canAccessStartPage) return false;
  
  // 요청한 라운드가 현재 라운드와 일치하는지 확인
  return analysis.currentRound === roundNumber || 
         (analysis.currentRound === 0 && roundNumber === 1);
}

/**
 * 완료 페이지 접근 권한 확인
 */
export function shouldRedirectToCompletion(user: User | null | undefined): boolean {
  const analysis = analyzeUserStatus(user);
  return analysis.status === UserAccessStatus.WAITING_FOR_APPROVAL || 
         analysis.status === UserAccessStatus.ALL_COMPLETED;
}

/**
 * 사용자 상태에 따른 적절한 리다이렉트 경로 반환
 */
export function getRedirectPath(user: User | null | undefined): string | null {
  const analysis = analyzeUserStatus(user);
  return analysis.redirectPath || null;
}

/**
 * 사용자 상태 메시지 생성
 */
export function getUserStatusMessage(user: User | null | undefined): string {
  const analysis = analyzeUserStatus(user);
  
  switch (analysis.status) {
    case UserAccessStatus.NEW_USER:
      return "새로운 사용자입니다. 첫 번째 라운드를 시작할 수 있습니다.";
    
    case UserAccessStatus.CAN_START_NEXT_ROUND:
      return `${analysis.currentRound}라운드를 시작할 수 있습니다.`;
    
    case UserAccessStatus.IN_PROGRESS:
      return `${analysis.currentRound}라운드가 진행 중입니다. (${analysis.currentRound}/${analysis.maxAllowedRounds})`;
    
    case UserAccessStatus.WAITING_FOR_APPROVAL:
      return `${analysis.currentRound - 1}라운드 완료. 관리자 승인을 기다리는 중입니다.`;
    
    case UserAccessStatus.ALL_COMPLETED:
      return "모든 라운드를 완료했습니다.";
    
    case UserAccessStatus.BLOCKED:
      return "현재 접근할 수 없는 상태입니다.";
    
    default:
      return "상태를 확인할 수 없습니다.";
  }
}

/**
 * Hook에서 사용할 수 있는 통합 상태 확인 함수
 */
export function useUserStatusValidation(user: User | null | undefined) {
  const analysis = analyzeUserStatus(user);
  
  return {
    ...analysis,
    // 편의 함수들
    canAccessStart: analysis.canAccessStartPage,
    shouldRedirect: !!analysis.redirectPath,
    statusMessage: getUserStatusMessage(user),
    isNewUser: analysis.status === UserAccessStatus.NEW_USER,
    isInProgress: analysis.status === UserAccessStatus.IN_PROGRESS,
    isWaitingApproval: analysis.status === UserAccessStatus.WAITING_FOR_APPROVAL,
    isCompleted: analysis.status === UserAccessStatus.ALL_COMPLETED,
  };
}