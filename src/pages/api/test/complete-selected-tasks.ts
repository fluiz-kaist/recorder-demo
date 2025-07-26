// pages/api/test/complete-selected-tasks.ts - 선택한 태스크만 완료 처리하는 API

import { NextApiRequest, NextApiResponse } from "next";
import { doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { User } from "@/types/firebase";

interface TaskSelection {
  setIndex: number;
  taskType: "situational" | "formal";
  taskIndex: number;
  taskKey?: string; // 확인용
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // 테스트 환경에서만 사용
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
  const { userId, selectedTasks, completeAllInSet = false } = req.body;

  if (!userId) {
    return res.status(400).json({
      success: false,
      message: "userId는 필수입니다.",
    });
  }

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

  // 사용자 문서 조회
  const userRef = doc(db, "usersV2", userId);
  const userDoc = await getDoc(userRef);

  if (!userDoc.exists()) {
    return res.status(404).json({
      success: false,
      message: "사용자를 찾을 수 없습니다.",
    });
  }

  const userData = userDoc.data() as User;

  if (!userData.participation?.sets?.length) {
    return res.status(400).json({
      success: false,
      message: "할당된 세트가 없습니다.",
    });
  }

  const now = new Date().toISOString();
  const updatedSets = [...userData.participation.sets];
  const completedTasks: string[] = [];
  const errors: string[] = [];

  // 선택된 태스크들을 완료 처리
  selectedTasks.forEach((selection: TaskSelection) => {
    const { setIndex, taskType, taskIndex, taskKey } = selection;

    // 유효성 검사
    if (setIndex < 0 || setIndex >= updatedSets.length) {
      errors.push(`잘못된 setIndex: ${setIndex}`);
      return;
    }

    const set = updatedSets[setIndex];
    const tasksArray = set.tasks[taskType];

    if (taskIndex < 0 || taskIndex >= tasksArray.length) {
      errors.push(`잘못된 taskIndex: ${taskIndex} (${taskType})`);
      return;
    }

    const task = tasksArray[taskIndex];

    // taskKey 확인 (선택사항)
    if (taskKey && task.taskKey !== taskKey) {
      errors.push(`taskKey 불일치: ${task.taskKey} !== ${taskKey}`);
      return;
    }

    // 이미 완료된 태스크는 건너뛰기
    if (task.status === "completed") {
      return;
    }

    // 태스크 완료 처리
    task.status = "completed";
    task.completedAt = now;
    task.recordingId = task.recordingId || `test_${task.taskKey}_${Date.now()}`;
    task.quality = task.quality || {
      duration: Math.random() * 5 + 8, // 8-13초 랜덤
      volumeLevel: Math.random() * 0.3 + 0.7, // 0.7-1.0 랜덤
      silenceRatio: Math.random() * 0.2, // 0-0.2 랜덤
      isValidRecording: true,
    };

    completedTasks.push(
      `Set${setIndex}-${taskType}-${taskIndex}: ${task.taskKey}`
    );
  });

  // 오류가 있으면 처리 중단
  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      message: "태스크 선택에 오류가 있습니다.",
      errors,
    });
  }

  // completeAllInSet이 true면 해당 세트의 나머지 태스크들도 완료 처리
  if (completeAllInSet) {
    const affectedSets = new Set(
      selectedTasks.map((t: TaskSelection) => t.setIndex)
    );

    affectedSets.forEach((setIndex) => {
      const set = updatedSets[setIndex];

      // situational 태스크들 완료
      set.tasks.situational.forEach((task) => {
        if (task.status !== "completed") {
          task.status = "completed";
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
            `Auto-Set${setIndex}-situational: ${task.taskKey}`
          );
        }
      });

      // formal 태스크들 완료
      set.tasks.formal.forEach((task) => {
        if (task.status !== "completed") {
          task.status = "completed";
          task.completedAt = now;
          task.recordingId =
            task.recordingId || `test_${task.taskKey}_${Date.now()}`;
          task.quality = task.quality || {
            duration: Math.random() * 3 + 6,
            volumeLevel: Math.random() * 0.3 + 0.7,
            silenceRatio: Math.random() * 0.2,
            isValidRecording: true,
          };
          completedTasks.push(`Auto-Set${setIndex}-formal: ${task.taskKey}`);
        }
      });
    });
  }

  // 각 세트의 진행률 재계산
  updatedSets.forEach((set, setIndex) => {
    const situationalCompleted = set.tasks.situational.filter(
      (t) => t.status === "completed"
    ).length;
    const formalCompleted = set.tasks.formal.filter(
      (t) => t.status === "completed"
    ).length;
    const totalCompleted = situationalCompleted + formalCompleted;
    const totalTasks = set.tasks.situational.length + set.tasks.formal.length;

    // 진행률 업데이트
    set.progress = {
      ...set.progress,
      totalTasks,
      completedTasks: totalCompleted,
      submittedTasks: totalCompleted,
      approvedTasks: totalCompleted,
      situational: {
        total: set.tasks.situational.length,
        completed: situationalCompleted,
        submitted: situationalCompleted,
        approved: situationalCompleted,
      },
      formal: {
        total: set.tasks.formal.length,
        completed: formalCompleted,
        submitted: formalCompleted,
        approved: formalCompleted,
      },
    };

    // 세트 상태 업데이트
    if (totalCompleted === totalTasks) {
      set.status = "completed";
      set.completedAt = now;
      set.submittedAt = now;
      set.approvedAt = now;
    } else if (totalCompleted > 0) {
      set.status = "in_progress";
    } else {
      set.status = "assigned";
    }
  });

  // 전체 통계 계산
  const totalCompletedSets = updatedSets.filter(
    (set) => set.status === "completed"
  ).length;
  const totalRecordings = updatedSets.reduce(
    (sum, set) => sum + set.progress.completedTasks,
    0
  );
  const totalPossibleRecordings = updatedSets.reduce(
    (sum, set) => sum + set.progress.totalTasks,
    0
  );

  // 전체 진행률 계산
  const overallProgress =
    totalPossibleRecordings > 0
      ? Math.round((totalRecordings / totalPossibleRecordings) * 100)
      : 0;

  // 현재 상태 업데이트
  const isAllCompleted = totalRecordings === totalPossibleRecordings;
  const updatedCurrentStatus = {
    isTutorialCompleted: true,
    canStartRecording: !isAllCompleted,
    progress: {
      completedPercentage: overallProgress,
      submittedPercentage: overallProgress,
      approvedPercentage: overallProgress,
    },
    pendingApproval: false,
    canStartNextSet:
      totalCompletedSets < (userData.participation.maxAllowedSets || 1),
  };

  // Firestore 업데이트
  const updateData: any = {
    "participation.sets": updatedSets,
    "participation.totalCompletedSets": totalCompletedSets,
    "participation.stats.totalRecordings": totalRecordings,
    "participation.stats.totalApprovedRecordings": totalRecordings,
    "participation.stats.averageQualityScore": Math.random() * 15 + 80, // 80-95 랜덤
    "participation.stats.lastParticipationAt": now,
    currentStatus: updatedCurrentStatus,
    updatedAt: serverTimestamp(),
  };

  // 모든 태스크가 완료되었다면 전체 완료 상태 업데이트
  if (isAllCompleted) {
    updateData["recordingStatus.isAllRecordingCompleted"] = true;
    updateData["recordingStatus.allRecordingCompletedAt"] = now;
    updateData["recordingStatus.progress.mainSituationalCompleted"] =
      updatedSets.reduce((sum, set) => sum + set.tasks.situational.length, 0);
    updateData["recordingStatus.progress.mainFormalCompleted"] =
      updatedSets.reduce((sum, set) => sum + set.tasks.formal.length, 0);
    updateData["recordingStatus.progress.lastRecordedAt"] = now;
  }

  await updateDoc(userRef, updateData);

  console.log(`테스트: 사용자 ${userId}의 선택된 태스크 완료 처리 완료`);
  console.log("완료된 태스크:", completedTasks);

  return res.status(200).json({
    success: true,
    message: `${completedTasks.length}개의 태스크가 완료 처리되었습니다.`,
    data: {
      userId,
      completedTasks,
      totalSets: updatedSets.length,
      completedSets: totalCompletedSets,
      totalRecordings,
      overallProgress,
      isAllCompleted,
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
      "setIndex": 0,
      "taskType": "situational",
      "taskIndex": 2,
      "taskKey": "TASK_001_S_003" // 확인용 (선택사항)
    },
    {
      "setIndex": 0,
      "taskType": "formal",
      "taskIndex": 0,
      "taskKey": "TASK_001_F_001"
    },
    {
      "setIndex": 1,
      "taskType": "situational",
      "taskIndex": 1
    }
  ],
  "completeAllInSet": false // true면 해당 세트의 나머지 태스크들도 자동 완료
}

특정 세트 전체 완료 (일부 태스크만 선택해도):
POST /api/test/complete-selected-tasks  
Body: {
  "userId": "user123",
  "selectedTasks": [
    {
      "setIndex": 0,
      "taskType": "situational", 
      "taskIndex": 0
    }
  ],
  "completeAllInSet": true // 세트 0의 모든 태스크가 완료됨
}
*/
