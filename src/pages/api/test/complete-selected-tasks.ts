// pages/api/test/complete-selected-tasks.ts - 선택한 태스크만 완료 처리하는 API
import { NextApiRequest, NextApiResponse } from "next";
import { adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import {
  User,
  ParticipationRound,
  Task,
  TaskStatus,
  RoundStatus,
} from "@/types/user";

interface TaskSelection {
  roundNumber: number;
  taskType: "situational" | "formal";
  taskIndex: number;
  taskKey?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (process.env.NODE_ENV === "production") {
    return res.status(403).json({
      success: false,
      message: "프로덕션 환경에서는 사용할 수 없습니다.",
    });
  }

  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      message: "POST 메서드만 허용됩니다.",
    });
  }

  try {
    return await completeSelectedTasks(req, res);
  } catch (error) {
    console.error("선택 태스크 완료 처리 중 오류:", error);
    return res.status(500).json({
      success: false,
      message: "API 처리 중 오류가 발생했습니다.",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

async function completeSelectedTasks(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { userId, selectedTasks, completeAllInRound = false } = req.body;

  if (!userId) {
    return res.status(400).json({
      success: false,
      message: "userId는 필수입니다.",
    });
  }

  const userCollectionName =
    process.env.NEXT_PUBLIC_DB_USER_COLLECTION || "users-temp";

  if (
    !selectedTasks ||
    !Array.isArray(selectedTasks) ||
    selectedTasks.length === 0
  ) {
    return res.status(400).json({
      success: false,
      message: "완료할 태스크 목록(selectedTasks)이 필요합니다.",
    });
  }

  // 🔁 Firestore Admin SDK로 사용자 조회
  const userRef = adminDb.collection(userCollectionName).doc(userId);
  const userSnap = await userRef.get();

  if (!userSnap.exists) {
    return res.status(404).json({
      success: false,
      message: "사용자를 찾을 수 없습니다.",
    });
  }

  const userData = userSnap.data() as User;

  if (
    !userData.currentStatus?.currentRoundNumber ||
    userData.currentStatus.currentRoundNumber === 0
  ) {
    return res.status(400).json({
      success: false,
      message: "할당된 회차가 없습니다.",
    });
  }

  const now = new Date().toISOString();
  const completedTasks: string[] = [];
  const errors: string[] = [];

  // 각 선택된 태스크에 대해 회차별로 처리
  const roundNumbers = [
    ...new Set(selectedTasks.map((t: TaskSelection) => t.roundNumber)),
  ];

  for (const roundNumber of roundNumbers) {
    const roundRef = userRef.collection("rounds").doc(roundNumber.toString());
    const roundSnap = await roundRef.get();

    if (!roundSnap.exists) {
      errors.push(`회차 ${roundNumber}를 찾을 수 없습니다.`);
      continue;
    }

    const roundData = roundSnap.data() as ParticipationRound;
    const updatedRound = { ...roundData };

    // 해당 회차의 선택된 태스크들 처리
    const roundTasks = selectedTasks.filter(
      (t: TaskSelection) => t.roundNumber === roundNumber
    );

    roundTasks.forEach((selection: TaskSelection) => {
      const { taskType, taskIndex, taskKey } = selection;

      const tasksArray = updatedRound.tasks[taskType];

      if (taskIndex < 0 || taskIndex >= tasksArray.length) {
        errors.push(
          `잘못된 taskIndex: ${taskIndex} (${taskType}, 회차 ${roundNumber})`
        );
        return;
      }

      const task = tasksArray[taskIndex];
      if (taskKey && task.taskKey !== taskKey) {
        errors.push(`taskKey 불일치: ${task.taskKey} !== ${taskKey}`);
        return;
      }

      if (task.status === TaskStatus.COMPLETED) return;

      // 태스크 완료 처리
      task.status = TaskStatus.COMPLETED;
      task.completedAt = now;
      task.recordingId =
        task.recordingId || `test_${task.taskKey}_${Date.now()}`;
      task.quality = task.quality || {
        duration: Math.random() * 5 + 8,
        volumeLevel: Math.random() * 0.3 + 0.7,
        silenceRatio: Math.random() * 0.2,
        isValidRecording: true,
      };

      completedTasks.push(
        `Round${roundNumber}-${taskType}-${taskIndex}: ${task.taskKey}`
      );
    });

    // completeAllInRound가 true면 해당 회차의 모든 태스크 완료
    if (completeAllInRound) {
      [...updatedRound.tasks.situational, ...updatedRound.tasks.formal].forEach(
        (task) => {
          if (task.status !== TaskStatus.COMPLETED) {
            task.status = TaskStatus.COMPLETED;
            task.completedAt = now;
            task.recordingId =
              task.recordingId || `test_${task.taskKey}_${Date.now()}`;
            task.quality = task.quality || {
              duration: Math.random() * 5 + 8,
              volumeLevel: Math.random() * 0.3 + 0.7,
              silenceRatio: Math.random() * 0.2,
              isValidRecording: true,
            };
            completedTasks.push(`Auto-Round${roundNumber}: ${task.taskKey}`);
          }
        }
      );
    }

    // 회차 진행률 업데이트
    const sitCompleted = updatedRound.tasks.situational.filter(
      (t) => t.status === TaskStatus.COMPLETED
    ).length;
    const forCompleted = updatedRound.tasks.formal.filter(
      (t) => t.status === TaskStatus.COMPLETED
    ).length;
    const totalCompleted = sitCompleted + forCompleted;
    const totalTasks =
      updatedRound.tasks.situational.length + updatedRound.tasks.formal.length;

    updatedRound.progress = {
      totalTasks,
      completedTasks: totalCompleted,
      submittedTasks: totalCompleted, // 테스트용으로 완료 = 제출
      approvedTasks: totalCompleted, // 테스트용으로 완료 = 승인
      byTaskType: {
        situational: {
          total: updatedRound.tasks.situational.length,
          completed: sitCompleted,
          submitted: sitCompleted,
          approved: sitCompleted,
        },
        formal: {
          total: updatedRound.tasks.formal.length,
          completed: forCompleted,
          submitted: forCompleted,
          approved: forCompleted,
        },
      },
    };

    // 회차 상태 업데이트
    if (totalCompleted === totalTasks) {
      updatedRound.status = RoundStatus.COMPLETED;
      updatedRound.completedAt = now;
      updatedRound.submittedAt = now;
      updatedRound.approvedAt = now;
    } else if (totalCompleted > 0) {
      updatedRound.status = RoundStatus.IN_PROGRESS;
      if (!updatedRound.startedAt) {
        updatedRound.startedAt = now;
      }
    }

    // 회차 문서 업데이트
    await roundRef.update(updatedRound);
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      message: "태스크 선택에 오류가 있습니다.",
      errors,
    });
  }

  // 사용자 메인 문서의 요약 정보 업데이트
  const updatedRoundSummaries = [...userData.roundSummaries];

  for (const roundNumber of roundNumbers) {
    const roundRef = userRef.collection("rounds").doc(roundNumber.toString());
    const roundSnap = await roundRef.get();
    const roundData = roundSnap.data() as ParticipationRound;

    const summaryIndex = updatedRoundSummaries.findIndex(
      (s) => s.roundNumber === roundNumber
    );
    if (summaryIndex >= 0) {
      // 수정된 코드 (undefined 값 제거)
      const summaryUpdate: any = {
        roundNumber,
        status: roundData.status,
        assignedAt: roundData.assignedAt,
        progressSummary: {
          totalTasks: roundData.progress.totalTasks,
          approvedTasks: roundData.progress.approvedTasks,
          approvalRate:
            roundData.progress.totalTasks > 0
              ? Math.round(
                  (roundData.progress.approvedTasks /
                    roundData.progress.totalTasks) *
                    100
                )
              : 0,
        },
      };

      // undefined가 아닌 경우에만 추가
      if (roundData.setId !== undefined) {
        summaryUpdate.setId = roundData.setId;
      }
      if (roundData.formalSetId !== undefined) {
        summaryUpdate.formalSetId = roundData.formalSetId;
      }
      if (roundData.completedAt !== undefined) {
        summaryUpdate.completedAt = roundData.completedAt;
      }
      if (roundData.approvedAt !== undefined) {
        summaryUpdate.approvedAt = roundData.approvedAt;
      }

      updatedRoundSummaries[summaryIndex] = summaryUpdate;
    }
  }

  // 전체 통계 계산
  const totalCompletedRounds = updatedRoundSummaries.filter(
    (s) => s.status === RoundStatus.COMPLETED
  ).length;
  const totalRecordings = updatedRoundSummaries.reduce(
    (sum, s) => sum + s.progressSummary.approvedTasks,
    0
  );

  // 현재 상태 업데이트
  const currentRound = updatedRoundSummaries.find(
    (s) => s.roundNumber === userData.currentStatus.currentRoundNumber
  );
  const isCurrentRoundCompleted =
    currentRound?.status === RoundStatus.COMPLETED;

  const updatedCurrentStatus = {
    ...userData.currentStatus,
    canStartRecording: !isCurrentRoundCompleted,
    canStartNextRound:
      isCurrentRoundCompleted &&
      totalCompletedRounds < (userData.settings.maxAllowedRounds || 1),
    currentRoundProgress: {
      completedPercentage: currentRound
        ? currentRound.progressSummary.approvalRate
        : 0,
      submittedPercentage: currentRound
        ? currentRound.progressSummary.approvalRate
        : 0,
      approvedPercentage: currentRound
        ? currentRound.progressSummary.approvalRate
        : 0,
    },
  };

  // 통계 업데이트
  const updatedStatistics = {
    ...userData.statistics,
    current: {
      roundNumber: userData.currentStatus.currentRoundNumber,
      totalTasks: currentRound?.progressSummary.totalTasks || 0,
      completedTasks: currentRound?.progressSummary.approvedTasks || 0,
      submittedTasks: currentRound?.progressSummary.approvedTasks || 0,
      approvedTasks: currentRound?.progressSummary.approvedTasks || 0,
      recordingTime: 0, // 실제 구현에서는 계산 필요
      completedPercentage: currentRound?.progressSummary.approvalRate || 0,
      approvedPercentage: currentRound?.progressSummary.approvalRate || 0,
      lastUpdatedAt: now,
    },
    overall: {
      ...userData.statistics.overall,
      totalParticipationRounds: totalCompletedRounds,
      totalTasksCompleted: totalRecordings,
      totalTasksApproved: totalRecordings,
      lastParticipationAt: now,
    },
  };

  // 사용자 메인 문서 업데이트
  const updateData: any = {
    roundSummaries: updatedRoundSummaries,
    currentStatus: updatedCurrentStatus,
    statistics: updatedStatistics,
    updatedAt: FieldValue.serverTimestamp(),
  };

  // 레거시 호환용 필드 업데이트
  if (isCurrentRoundCompleted) {
    updateData["recordingStatus.isAllRecordingCompleted"] = true;
    updateData["recordingStatus.allRecordingCompletedAt"] = now;
    updateData["recordingStatus.progress.mainSituationalCompleted"] =
      totalRecordings;
    updateData["recordingStatus.progress.mainFormalCompleted"] =
      totalRecordings;
    updateData["recordingStatus.progress.lastRecordedAt"] = now;
  }

  await userRef.update(updateData);

  console.log(
    `✅ 테스트 완료 처리: 사용자 ${userId}, 완료된 태스크 ${completedTasks.length}개`
  );

  return res.status(200).json({
    success: true,
    message: `${completedTasks.length}개의 태스크가 완료 처리되었습니다.`,
    data: {
      userId,
      completedTasks,
      totalRounds: updatedRoundSummaries.length,
      completedRounds: totalCompletedRounds,
      totalRecordings,
      currentRoundProgress: updatedCurrentStatus.currentRoundProgress,
      isCurrentRoundCompleted,
      completedAt: now,
    },
  });
}

// ===== API 사용법 =====
/*
선택한 태스크만 완료:
POST /api/test/complete-selected-tasks
Body: {
  "userId": "user123",
  "selectedTasks": [
    {
      "roundNumber": 1,
      "taskType": "situational",
      "taskIndex": 2,
      "taskKey": "TASK_001_S_003" // 확인용 (선택사항)
    },
    {
      "roundNumber": 1,
      "taskType": "formal",
      "taskIndex": 0,
      "taskKey": "TASK_001_F_001"
    },
    {
      "roundNumber": 2,
      "taskType": "situational",
      "taskIndex": 1
    }
  ],
  "completeAllInRound": false // true면 해당 회차의 나머지 태스크들도 자동 완료
}

특정 회차 전체 완료 (일부 태스크만 선택해도):
POST /api/test/complete-selected-tasks  
Body: {
  "userId": "user123",
  "selectedTasks": [
    {
      "roundNumber": 1,
      "taskType": "situational", 
      "taskIndex": 0
    }
  ],
  "completeAllInRound": true // 회차 1의 모든 태스크가 완료됨
}
*/
