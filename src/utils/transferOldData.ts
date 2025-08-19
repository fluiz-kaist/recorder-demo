import { Timestamp } from "firebase/firestore";

// 타입 정의
enum RoundStatus {
  ASSIGNED = "assigned",
  IN_PROGRESS = "in_progress",
  COMPLETED = "completed",
  SUBMITTED = "submitted",
  APPROVED = "approved",
}

interface Task {
  id: string;
  status: "pending" | "completed" | "submitted" | "approved";
  duration?: number;
}

interface RoundData {
  tasks: {
    situational: Task[];
    formal: Task[];
  };
}

interface CurrentStatus {
  isOnboardingCompleted: boolean;
  hasPendingApproval: boolean;
  nextTask: string | null;
  currentRoundProgress: {
    completedPercentage: number;
    submittedPercentage: number;
    approvedPercentage: number;
  };
  canStartNextRound: boolean;
  isTutorialCompleted: boolean;
  canStartRecording: boolean;
  currentRoundNumber: number;
}

interface RoundSummary {
  assignedAt?: { _seconds: number; _nanoseconds: number };
  formalSetId?: number;
  roundNumber: number;
  status: string;
  progressSummary: {
    totalTasks: number;
    approvedTasks: number;
    approvalRate: number;
  };
  completedAt: { _seconds: number; _nanoseconds: number };
}

interface Statistics {
  current: {
    roundNumber: number;
    lastUpdatedAt: { _seconds: number; _nanoseconds: number };
    recordingTime: number;
    approvedPercentage: number;
    approvedTasks: number;
    totalTasks: number;
    completedPercentage: number;
    submittedTasks: number;
    completedTasks: number;
  };
}

interface UserData {
  id: string;
  profile: any;
  settings: any;
  currentStatus: CurrentStatus;
  roundSummaries: RoundSummary[];
  statistics: Statistics;
  updatedAt: { _seconds: number; _nanoseconds: number };
  recordingHistory: any[];
  setDetails: any[];
}

interface UpdateResult {
  updatedUserData: UserData;
  roundUpdateData: {
    completedAt: { _seconds: number; _nanoseconds: number };
    status: RoundStatus;
    "progress.completedTasks": number;
    "progress.byTaskType.formal.completed": number;
    "progress.byTaskType.situational.completed": number;
  };
}

/**
 * 새로운 로직을 적용하여 사용자 데이터를 업데이트하는 함수
 * (원본 데이터 보존, 시간/숫자는 원본 값 유지, 논리적으로 맞는 곳으로 데이터 이동)
 * @param userData 기존 사용자 데이터
 * @param roundData 현재 회차의 작업 데이터
 * @returns 업데이트된 사용자 데이터와 라운드 업데이트 데이터
 */
function applyNewCompletionLogic(
  userData: UserData,
  roundData: RoundData
): UpdateResult {
  const currentRoundNumber = userData.currentStatus.currentRoundNumber || 1;

  // roundData에서 작업 통계 계산 (실제 데이터 기반)
  const situational = roundData.tasks.situational || [];
  const formal = roundData.tasks.formal || [];

  const totalTasks = situational.length + formal.length;
  const approvedTasks = [...situational, ...formal].filter(
    (t) => t.status === "approved"
  ).length;

  const situationalCompleted = situational.filter(
    (t: Task) =>
      t.status === "completed" ||
      t.status === "submitted" ||
      t.status === "approved"
  ).length;

  const formalCompleted = formal.filter(
    (t: Task) =>
      t.status === "completed" ||
      t.status === "submitted" ||
      t.status === "approved"
  ).length;

  const recordingTimeSum = [...situational, ...formal].reduce(
    (acc, cur) => acc + (cur.duration || 0),
    0
  );

  // 기존 데이터에서 시간 값들 추출 (원본 유지)
  const existingRoundSummary = userData.roundSummaries.find(
    (s) => s.roundNumber === currentRoundNumber
  );

  const existingCompletedAt =
    existingRoundSummary?.completedAt || userData.updatedAt;
  const existingLastUpdatedAt = userData.statistics.current.lastUpdatedAt;
  const existingUpdatedAt = userData.updatedAt;

  // roundSummaries 업데이트 - 원본 데이터 보존하되 새 로직 적용
  const updatedSummary: RoundSummary = {
    ...existingRoundSummary, // 기존 데이터 모두 보존
    roundNumber: currentRoundNumber,
    status: RoundStatus.SUBMITTED, // completed → submitted로 변경
    completedAt: existingCompletedAt, // 기존 시간 유지
    progressSummary: {
      totalTasks,
      approvedTasks,
      approvalRate:
        totalTasks > 0 ? Math.round((approvedTasks / totalTasks) * 100) : 0,
    },
  };

  const updatedSummaries = userData.roundSummaries.map((summary) => {
    if (summary.roundNumber === currentRoundNumber) {
      return updatedSummary;
    }
    return summary; // 다른 회차는 그대로 유지
  });

  // 사용자 데이터 업데이트 - 원본 데이터 보존
  const updatedUserData: UserData = {
    ...userData, // 모든 원본 데이터 보존
    currentStatus: {
      ...userData.currentStatus,
      canStartRecording: false, // true → false
      canStartNextRound: false, // 새 로직: 관리자 허가 대기
      nextTask: null, // 새 로직: null로 설정
      hasPendingApproval: true, // false → true (새 로직)
    },
    statistics: {
      ...userData.statistics,
      current: {
        ...userData.statistics.current,
        // roundData 기반으로 계산된 값들 적용
        completedTasks: formalCompleted + situationalCompleted,
        completedPercentage: 100,
        recordingTime: recordingTimeSum,
        // 시간은 기존 값 유지
        lastUpdatedAt: existingLastUpdatedAt,
      },
    },
    roundSummaries: updatedSummaries,
    updatedAt: existingUpdatedAt, // 기존 시간 유지
  };

  // 라운드 업데이트 데이터 - 기존 시간 사용
  const roundUpdateData = {
    completedAt: existingCompletedAt, // 기존 completedAt 시간 사용
    status: RoundStatus.COMPLETED,
    "progress.completedTasks": formalCompleted + situationalCompleted,
    "progress.byTaskType.formal.completed": formalCompleted,
    "progress.byTaskType.situational.completed": situationalCompleted,
  };

  return {
    updatedUserData,
    roundUpdateData,
  };
}

// 사용 예시
/*
const currentUserData: UserData = {
  // 제공된 JSON 데이터
};

const currentRoundData: RoundData = {
  tasks: {
    situational: [
      { id: "task1", status: "completed", duration: 120 },
      { id: "task2", status: "approved", duration: 95 },
      // ... more tasks
    ],
    formal: [
      { id: "task3", status: "submitted", duration: 110 },
      { id: "task4", status: "completed", duration: 130 },
      // ... more tasks
    ]
  }
};

const result = applyNewCompletionLogic(currentUserData, currentRoundData);
console.log("Updated User Data:", result.updatedUserData);
console.log("Round Update Data:", result.roundUpdateData);
*/

export { applyNewCompletionLogic, RoundStatus };
export type { UserData, RoundData, UpdateResult, Task, RoundSummary };
