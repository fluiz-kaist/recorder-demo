// pages/api/test/manage-tasks.ts - 테스트용 태스크 관리 API

import { NextApiRequest, NextApiResponse } from "next";
import { doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { User, RecordingTask } from "@/types/firebase";

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

  try {
    if (req.method === "GET") {
      // 사용자의 태스크 목록 조회
      return await getUserTasks(req, res);
    } else if (req.method === "POST") {
      // 태스크 상태 업데이트
      return await updateTaskStatus(req, res);
    } else if (req.method === "PUT") {
      // 모든 태스크 완료
      return await completeAllTasks(req, res);
    } else if (req.method === "PATCH") {
      return await updateTutorialStatus(req, res);
    } else {
      return res.status(405).json({
        success: false,
        message: "Method not allowed",
      });
    }
  } catch (error) {
    console.error("API 처리 중 오류:", error);
    return res.status(500).json({
      success: false,
      message: "API 처리 중 오류가 발생했습니다.",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

// 사용자 태스크 목록 조회
async function getUserTasks(req: NextApiRequest, res: NextApiResponse) {
  const { userId } = req.query;

  if (!userId || typeof userId !== "string") {
    return res.status(400).json({
      success: false,
      message: "userId는 필수입니다.",
    });
  }

  const userRef = doc(db, "usersV2", userId);
  const userDoc = await getDoc(userRef);

  if (!userDoc.exists()) {
    return res.status(404).json({
      success: false,
      message: "사용자를 찾을 수 없습니다.",
    });
  }

  const userData = userDoc.data() as User;

  // 스크립트가 할당되지 않은 경우 빈 배열 반환
  if (!userData.participation?.sets?.length) {
    return res.status(200).json({
      success: true,
      data: {
        userId,
        totalTasks: 0,
        completedTasks: 0,
        tasks: [],
        tutorialCompleted: userData.currentStatus?.isTutorialCompleted || false,
      },
    });
  }

  // 태스크 목록 구성
  const taskList = userData.participation.sets.flatMap((set, setIndex) => [
    ...set.tasks.situational.map((task, taskIndex) => ({
      id: `${setIndex}-situational-${taskIndex}`,
      setIndex,
      taskType: "situational" as const,
      taskIndex,
      taskKey: task.taskKey,
      status: task.status,
      completedAt: task.completedAt,
      recordingId: task.recordingId,
    })),
    ...set.tasks.formal.map((task, taskIndex) => ({
      id: `${setIndex}-formal-${taskIndex}`,
      setIndex,
      taskType: "formal" as const,
      taskIndex,
      taskKey: task.taskKey,
      status: task.status,
      completedAt: task.completedAt,
      recordingId: task.recordingId,
    })),
  ]);

  return res.status(200).json({
    success: true,
    data: {
      userId,
      totalTasks: taskList.length,
      completedTasks: taskList.filter((t) => t.status === "completed").length,
      tasks: taskList,
      tutorialCompleted: userData.currentStatus?.isTutorialCompleted || false,
    },
  });
}

// 개별 태스크 상태 업데이트
async function updateTaskStatus(req: NextApiRequest, res: NextApiResponse) {
  const { userId, updates } = req.body;

  if (!userId || !updates || !Array.isArray(updates)) {
    return res.status(400).json({
      success: false,
      message: "userId와 updates 배열이 필요합니다.",
    });
  }

  const userRef = doc(db, "usersV2", userId);
  const userDoc = await getDoc(userRef);

  if (!userDoc.exists()) {
    return res.status(404).json({
      success: false,
      message: "사용자를 찾을 수 없습니다.",
    });
  }

  const userData = userDoc.data() as User;
  const now = new Date().toISOString();

  // 업데이트할 세트들을 복사
  const updatedSets = [...userData.participation.sets];

  // 각 업데이트 적용
  updates.forEach(
    (update: {
      setIndex: number;
      taskType: "situational" | "formal";
      taskIndex: number;
      status: string;
    }) => {
      const { setIndex, taskType, taskIndex, status } = update;

      if (
        updatedSets[setIndex] &&
        updatedSets[setIndex].tasks[taskType][taskIndex]
      ) {
        const task = updatedSets[setIndex].tasks[taskType][taskIndex];

        if (status === "completed" && task.status !== "completed") {
          // 완료 처리
          task.status = "completed";
          task.completedAt = now;
          task.recordingId =
            task.recordingId || `test_${task.taskKey}_${Date.now()}`;
          task.quality = task.quality || {
            duration: 10.0,
            volumeLevel: 0.8,
            silenceRatio: 0.1,
            isValidRecording: true,
          };
        } else if (status === "not_started") {
          // 미완료 처리
          task.status = "not_started";
          task.completedAt = undefined;
          task.recordingId = undefined;
          task.quality = undefined;
        }
      }
    }
  );

  // 진행률 재계산
  updatedSets.forEach((set) => {
    const situationalCompleted = set.tasks.situational.filter(
      (t) => t.status === "completed"
    ).length;
    const formalCompleted = set.tasks.formal.filter(
      (t) => t.status === "completed"
    ).length;
    const totalCompleted = situationalCompleted + formalCompleted;
    const totalTasks = set.tasks.situational.length + set.tasks.formal.length;

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
    } else if (totalCompleted > 0) {
      set.status = "in_progress";
    } else {
      set.status = "assigned";
    }
  });

  // Firestore 업데이트
  await updateDoc(userRef, {
    "participation.sets": updatedSets,
    updatedAt: serverTimestamp(),
  });

  return res.status(200).json({
    success: true,
    message: "태스크 상태가 업데이트되었습니다.",
  });
}

// 모든 태스크 완료 (기존 코드)
async function completeAllTasks(req: NextApiRequest, res: NextApiResponse) {
  const { userId } = req.body;
  try {
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "userId는 필수입니다.",
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
    const updatedSets = userData.participation.sets.map((set) => {
      // 모든 태스크를 완료 상태로 변경
      const updatedSituationalTasks = set.tasks.situational.map((task) => ({
        ...task,
        status: "completed" as const,
        completedAt: task.completedAt || now,
        recordingId: task.recordingId || `test_${task.taskKey}_${Date.now()}`,
        quality: task.quality || {
          duration: 10.5,
          volumeLevel: 0.8,
          silenceRatio: 0.1,
          isValidRecording: true,
        },
      }));

      const updatedFormalTasks = set.tasks.formal.map((task) => ({
        ...task,
        status: "completed" as const,
        completedAt: task.completedAt || now,
        recordingId: task.recordingId || `test_${task.taskKey}_${Date.now()}`,
        quality: task.quality || {
          duration: 8.2,
          volumeLevel: 0.75,
          silenceRatio: 0.15,
          isValidRecording: true,
        },
      }));

      // 진행률 계산
      const totalTasks =
        updatedSituationalTasks.length + updatedFormalTasks.length;
      const completedTasks = totalTasks; // 모든 태스크가 완료됨

      return {
        ...set,
        tasks: {
          situational: updatedSituationalTasks,
          formal: updatedFormalTasks,
        },
        progress: {
          ...set.progress,
          totalTasks,
          completedTasks,
          submittedTasks: completedTasks,
          approvedTasks: completedTasks,
          situational: {
            total: updatedSituationalTasks.length,
            completed: updatedSituationalTasks.length,
            submitted: updatedSituationalTasks.length,
            approved: updatedSituationalTasks.length,
          },
          formal: {
            total: updatedFormalTasks.length,
            completed: updatedFormalTasks.length,
            submitted: updatedFormalTasks.length,
            approved: updatedFormalTasks.length,
          },
        },
        status: "completed" as const,
        completedAt: now,
        submittedAt: now,
        approvedAt: now,
      };
    });

    // 전체 참가 통계 업데이트
    const totalCompletedSets = updatedSets.filter(
      (set) => set.status === "completed"
    ).length;
    const totalRecordings = updatedSets.reduce(
      (sum, set) => sum + set.progress.completedTasks,
      0
    );

    // 현재 상태 업데이트
    const updatedCurrentStatus = {
      isTutorialCompleted: true,
      canStartRecording: false, // 모든 태스크 완료됨
      progress: {
        completedPercentage: 100,
        submittedPercentage: 100,
        approvedPercentage: 100,
      },
      pendingApproval: false,
      canStartNextSet:
        totalCompletedSets < userData.participation.maxAllowedSets,
    };

    // Firestore 업데이트
    await updateDoc(userRef, {
      "participation.sets": updatedSets,
      "participation.totalCompletedSets": totalCompletedSets,
      "participation.stats.totalRecordings": totalRecordings,
      "participation.stats.totalApprovedRecordings": totalRecordings,
      "participation.stats.averageQualityScore": 85, // 테스트용 점수
      "participation.stats.lastParticipationAt": now,
      currentStatus: updatedCurrentStatus,
      "recordingStatus.isAllRecordingCompleted": true,
      "recordingStatus.allRecordingCompletedAt": now,
      "recordingStatus.progress.mainSituationalCompleted": updatedSets.reduce(
        (sum, set) => sum + set.tasks.situational.length,
        0
      ),
      "recordingStatus.progress.mainFormalCompleted": updatedSets.reduce(
        (sum, set) => sum + set.tasks.formal.length,
        0
      ),
      "recordingStatus.progress.lastRecordedAt": now,
      updatedAt: serverTimestamp(),
    });

    console.log(`테스트: 사용자 ${userId}의 모든 태스크 완료 처리 완료`);

    return res.status(200).json({
      success: true,
      message: "모든 태스크가 완료 상태로 업데이트되었습니다.",
      data: {
        userId,
        totalSets: updatedSets.length,
        completedSets: totalCompletedSets,
        totalTasks: totalRecordings,
        completedAt: now,
      },
    });
  } catch (error) {
    console.error("테스트 완료 처리 중 오류:", error);
    return res.status(500).json({
      success: false,
      message: "테스트 완료 처리 중 오류가 발생했습니다.",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
// updateTutorialStatus 함수 추가 (completeAllTasks 함수 아래에)
async function updateTutorialStatus(req: NextApiRequest, res: NextApiResponse) {
  const { userId, isTutorialCompleted } = req.body;

  if (!userId) {
    return res.status(400).json({
      success: false,
      message: "userId는 필수입니다.",
    });
  }

  const userRef = doc(db, "usersV2", userId);
  const userDoc = await getDoc(userRef);

  if (!userDoc.exists()) {
    return res.status(404).json({
      success: false,
      message: "사용자를 찾을 수 없습니다.",
    });
  }

  await updateDoc(userRef, {
    "currentStatus.isTutorialCompleted": isTutorialCompleted,
    "recordingStatus.isTutorialCompleted": isTutorialCompleted,
    updatedAt: serverTimestamp(),
  });

  return res.status(200).json({
    success: true,
    message: "튜토리얼 상태가 업데이트되었습니다.",
  });
}
// ===== API 사용법 =====
/*
1. 태스크 목록 조회:
GET /api/test/manage-tasks?userId=user123

2. 개별 태스크 상태 업데이트:
POST /api/test/manage-tasks
Body: {
  "userId": "user123",
  "updates": [
    {
      "setIndex": 0,
      "taskType": "situational",
      "taskIndex": 0,
      "status": "completed"
    },
    {
      "setIndex": 0,
      "taskType": "formal", 
      "taskIndex": 2,
      "status": "not_started"
    }
  ]
}

3. 모든 태스크 완료:
PUT /api/test/manage-tasks
Body: {
  "userId": "user123"
}
*/
