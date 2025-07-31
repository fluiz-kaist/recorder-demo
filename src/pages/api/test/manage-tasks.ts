// pages/api/test/manage-tasks-admin.ts - Admin SDK 기반 테스트 API
import { NextApiRequest, NextApiResponse } from "next";
import { adminDb } from "@/lib/firebase/admin";
import { Timestamp } from "firebase-admin/firestore";
import {
  User,
  ParticipationRound,
  Task,
  TaskStatus,
  RoundStatus,
  RoundProgress,
} from "@/types/user";

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
      return await getUserTasks(req, res);
    } else if (req.method === "POST") {
      return await updateTaskStatus(req, res);
    } else if (req.method === "PUT") {
      return await completeAllTasks(req, res);
    } else if (req.method === "PATCH") {
      return await updateTutorialStatus(req, res);
    } else if (req.method === "DELETE") {
      return await resetUserData(req, res);
    } else {
      return res.status(405).json({
        success: false,
        message: "Method not allowed",
      });
    }
  } catch (error) {
    console.error("Admin API 처리 중 오류:", error);
    return res.status(500).json({
      success: false,
      message: "Admin API 처리 중 오류가 발생했습니다.",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

// 🔥 Admin SDK로 사용자 태스크 목록 조회 (보안 규칙 무시)
async function getUserTasks(req: NextApiRequest, res: NextApiResponse) {
  const { userId } = req.query;
  const userCollectionName =
    process.env.NEXT_PUBLIC_DB_USER_COLLECTION || "users-temp";

  if (!userId || typeof userId !== "string") {
    return res.status(400).json({
      success: false,
      message: "userId는 필수입니다.",
    });
  }

  // 🔥 Admin SDK 사용 - 보안 규칙 우회
  const userDoc = await adminDb
    .collection(userCollectionName)
    .doc(userId)
    .get();

  if (!userDoc.exists) {
    return res.status(404).json({
      success: false,
      message: "사용자를 찾을 수 없습니다.",
    });
  }

  const userData = userDoc.data() as User;

  // 스크립트가 할당되지 않은 경우 빈 배열 반환
  // 현재 회차 정보 가져오기
  const currentRoundNumber = userData.currentStatus?.currentRoundNumber || 1;
  const roundDocRef = adminDb
    .collection(`${userCollectionName}/${userId}/rounds`)
    .doc(currentRoundNumber.toString());

  const roundDoc = await roundDocRef.get();
  if (!roundDoc.exists) {
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

  const roundData = roundDoc.data() as ParticipationRound;

  // 태스크 목록 구성
  const taskList = [
    ...roundData.tasks.situational.map((task, taskIndex) => ({
      id: `${currentRoundNumber}-situational-${taskIndex}`,
      roundNumber: currentRoundNumber,
      taskType: "situational" as const,
      taskIndex,
      taskKey: task.taskKey,
      status: task.status,
      completedAt: task.completedAt,
      audioRecordId: task.audioRecordId,
    })),
    ...roundData.tasks.formal.map((task, taskIndex) => ({
      id: `${currentRoundNumber}-formal-${taskIndex}`,
      roundNumber: currentRoundNumber,
      taskType: "formal" as const,
      taskIndex,
      taskKey: task.taskKey,
      status: task.status,
      completedAt: task.completedAt,
      audioRecordId: task.audioRecordId,
    })),
  ];

  return res.status(200).json({
    success: true,
    data: {
      userId,
      totalTasks: taskList.length,
      completedTasks: taskList.filter((t) => t.status === TaskStatus.COMPLETED)
        .length,
      tasks: taskList,
      tutorialCompleted: userData.currentStatus?.isTutorialCompleted || false,
    },
  });
}

// 🔥 Admin SDK로 개별 태스크 상태 업데이트
async function updateTaskStatus(req: NextApiRequest, res: NextApiResponse) {
  const { userId, updates } = req.body;
  const userCollectionName =
    process.env.NEXT_PUBLIC_DB_USER_COLLECTION || "users-temp";

  if (!userId || !updates || !Array.isArray(updates)) {
    return res.status(400).json({
      success: false,
      message: "userId와 updates 배열이 필요합니다.",
    });
  }

  // 🔥 Admin SDK 사용
  const userDocRef = adminDb.collection(userCollectionName).doc(userId);
  const userDoc = await userDocRef.get();

  if (!userDoc.exists) {
    return res.status(404).json({
      success: false,
      message: "사용자를 찾을 수 없습니다.",
    });
  }

  const userData = userDoc.data() as User;
  const now = new Date().toISOString();

  // 현재 회차 문서 참조
  const currentRoundNumber = userData.currentStatus?.currentRoundNumber || 1;
  const roundDocRef = adminDb
    .collection(`${userCollectionName}/${userId}/rounds`)
    .doc(currentRoundNumber.toString());

  const roundDoc = await roundDocRef.get();
  const roundData = roundDoc.data() as ParticipationRound;

  // 태스크 업데이트 로직
  const updatedTasks = { ...roundData.tasks };

  // 각 업데이트 적용
  updates.forEach(
    (update: {
      taskType: "situational" | "formal";
      taskIndex: number;
      status: string;
    }) => {
      const { taskType, taskIndex, status } = update;
      // 한 번만 현재 시간을 가져와서 모든 곳에서 동일한 시간 사용
      const now = Timestamp.now();
      if (updatedTasks[taskType][taskIndex]) {
        const task = updatedTasks[taskType][taskIndex];

        if (status === "completed" && task.status !== TaskStatus.COMPLETED) {
          task.status = TaskStatus.COMPLETED;
          task.completedAt = now;
          task.audioRecordId =
            task.audioRecordId || `admin_test_${task.taskKey}_${Date.now()}`;
          task.quality = task.quality || {
            duration: 10.0,
            volumeLevel: 0.8,
            silenceRatio: 0.1,
            isValidRecording: true,
          };
        } else if (status === "not_started") {
          task.status = TaskStatus.NOT_STARTED;
          task.completedAt = undefined;
          task.audioRecordId = undefined;
          task.quality = undefined;
        }
      }
    }
  );

  // 진행률 재계산
  // 진행률 재계산
  const situationalCompleted = updatedTasks.situational.filter(
    (t) => t.status === TaskStatus.COMPLETED
  ).length;
  const formalCompleted = updatedTasks.formal.filter(
    (t) => t.status === TaskStatus.COMPLETED
  ).length;
  const totalCompleted = situationalCompleted + formalCompleted;
  const totalTasks =
    updatedTasks.situational.length + updatedTasks.formal.length;

  const newProgress: RoundProgress = {
    totalTasks,
    completedTasks: totalCompleted,
    submittedTasks: totalCompleted, // 완료되면 제출된 것으로 간주
    approvedTasks: totalCompleted, // 테스트용이므로 자동 승인
    byTaskType: {
      situational: {
        total: updatedTasks.situational.length,
        completed: situationalCompleted,
        submitted: situationalCompleted,
        approved: situationalCompleted,
      },
      formal: {
        total: updatedTasks.formal.length,
        completed: formalCompleted,
        submitted: formalCompleted,
        approved: formalCompleted,
      },
    },
  };

  // 회차 상태 결정
  let roundStatus = RoundStatus.ASSIGNED;
  if (totalCompleted === totalTasks) {
    roundStatus = RoundStatus.COMPLETED;
  } else if (totalCompleted > 0) {
    roundStatus = RoundStatus.IN_PROGRESS;
  }

  // 🔥 Admin SDK로 Firestore 업데이트 (보안 규칙 우회)
  // 서브컬렉션 업데이트

  await roundDocRef.update({
    tasks: updatedTasks,
    progress: newProgress,
    status: roundStatus,
    updatedAt: now,
  });

  // 메인 문서의 현재 상태 업데이트
  await userDocRef.update({
    "currentStatus.currentRoundProgress": {
      completedPercentage: Math.round((totalCompleted / totalTasks) * 100),
      submittedPercentage: Math.round((totalCompleted / totalTasks) * 100),
      approvedPercentage: Math.round((totalCompleted / totalTasks) * 100),
    },
    "statistics.current": {
      ...userData.statistics?.current,
      completedTasks: totalCompleted,
      submittedTasks: totalCompleted,
      approvedTasks: totalCompleted,
      completedPercentage: Math.round((totalCompleted / totalTasks) * 100),
      approvedPercentage: Math.round((totalCompleted / totalTasks) * 100),
      lastUpdatedAt: now,
    },
    updatedAt: now,
  });

  return res.status(200).json({
    success: true,
    message: "Admin API로 태스크 상태가 업데이트되었습니다.",
  });
}

// 🔥 Admin SDK로 모든 태스크 완료
async function completeAllTasks(req: NextApiRequest, res: NextApiResponse) {
  const { userId } = req.body;
  const userCollectionName =
    process.env.NEXT_PUBLIC_DB_USER_COLLECTION || "users-temp";

  if (!userId) {
    return res.status(400).json({
      success: false,
      message: "userId는 필수입니다.",
    });
  }

  const userDocRef = adminDb.collection(userCollectionName).doc(userId);
  const userDoc = await userDocRef.get();

  if (!userDoc.exists) {
    return res.status(404).json({
      success: false,
      message: "사용자를 찾을 수 없습니다.",
    });
  }

  const userData = userDoc.data() as User;
  const currentRoundNumber = userData.currentStatus?.currentRoundNumber || 1;

  // 현재 회차 문서 가져오기
  const roundDocRef = adminDb
    .collection(`${userCollectionName}/${userId}/rounds`)
    .doc(currentRoundNumber.toString());

  const roundDoc = await roundDocRef.get();
  if (!roundDoc.exists) {
    return res.status(400).json({
      success: false,
      message: "현재 회차가 할당되지 않았습니다.",
    });
  }
  // 한 번만 현재 시간을 가져와서 모든 곳에서 동일한 시간 사용
  const now = Timestamp.now();
  const roundData = roundDoc.data() as ParticipationRound;

  // 모든 태스크를 완료 상태로 변경
  const updatedTasks = {
    situational: roundData.tasks.situational.map((task) => ({
      ...task,
      status: TaskStatus.COMPLETED,
      completedAt: now,
      audioRecordId:
        task.audioRecordId || `admin_complete_${task.taskKey}_${Date.now()}`,
      quality: task.quality || {
        duration: 10.5,
        volumeLevel: 0.8,
        silenceRatio: 0.1,
        isValidRecording: true,
      },
    })),
    formal: roundData.tasks.formal.map((task) => ({
      ...task,
      status: TaskStatus.COMPLETED,
      completedAt: now,
      audioRecordId:
        task.audioRecordId || `admin_complete_${task.taskKey}_${Date.now()}`,
      quality: task.quality || {
        duration: 8.2,
        volumeLevel: 0.75,
        silenceRatio: 0.15,
        isValidRecording: true,
      },
    })),
  };

  const totalTasks =
    updatedTasks.situational.length + updatedTasks.formal.length;

  const newProgress: RoundProgress = {
    totalTasks,
    completedTasks: totalTasks,
    submittedTasks: totalTasks,
    approvedTasks: totalTasks,
    byTaskType: {
      situational: {
        total: updatedTasks.situational.length,
        completed: updatedTasks.situational.length,
        submitted: updatedTasks.situational.length,
        approved: updatedTasks.situational.length,
      },
      formal: {
        total: updatedTasks.formal.length,
        completed: updatedTasks.formal.length,
        submitted: updatedTasks.formal.length,
        approved: updatedTasks.formal.length,
      },
    },
  };

  // 서브컬렉션 업데이트
  await roundDocRef.update({
    tasks: updatedTasks,
    progress: newProgress,
    status: RoundStatus.COMPLETED,
    completedAt: now,
    submittedAt: now,
    approvedAt: now,
  });

  // 메인 문서 업데이트
  await userDocRef.update({
    "currentStatus.currentRoundProgress": {
      completedPercentage: 100,
      submittedPercentage: 100,
      approvedPercentage: 100,
    },
    "statistics.current": {
      roundNumber: currentRoundNumber,
      totalTasks: totalTasks,
      completedTasks: totalTasks,
      submittedTasks: totalTasks,
      approvedTasks: totalTasks,
      recordingTime:
        (userData.statistics?.current?.recordingTime || 0) + totalTasks * 10,
      completedPercentage: 100,
      approvedPercentage: 100,
      lastUpdatedAt: now,
    },
    updatedAt: now,
  });

  return res.status(200).json({
    success: true,
    message: "Admin API로 모든 태스크가 완료되었습니다.",
    data: {
      userId,
      roundNumber: currentRoundNumber,
      totalTasks: totalTasks,
      completedAt: new Date().toISOString(),
    },
  });
}
// 🔥 Admin SDK로 튜토리얼 상태 업데이트
async function updateTutorialStatus(req: NextApiRequest, res: NextApiResponse) {
  const userCollectionName =
    process.env.NEXT_PUBLIC_DB_USER_COLLECTION || "users-temp";
  const { userId, isTutorialCompleted } = req.body;

  if (!userId) {
    return res.status(400).json({
      success: false,
      message: "userId는 필수입니다.",
    });
  }

  // 🔥 Admin SDK 사용
  const userDocRef = adminDb.collection(userCollectionName).doc(userId);
  const userDoc = await userDocRef.get();

  if (!userDoc.exists) {
    return res.status(404).json({
      success: false,
      message: "사용자를 찾을 수 없습니다.",
    });
  }
  // 한 번만 현재 시간을 가져와서 모든 곳에서 동일한 시간 사용
  const now = Timestamp.now();
  await userDocRef.update({
    "currentStatus.isTutorialCompleted": isTutorialCompleted,
    "recordingStatus.isTutorialCompleted": isTutorialCompleted,
    updatedAt: now,
  });

  return res.status(200).json({
    success: true,
    message: "Admin API로 튜토리얼 상태가 업데이트되었습니다.",
  });
}

// 🔥 Admin SDK로 사용자 데이터 완전 리셋 (추가 기능)
async function resetUserData(req: NextApiRequest, res: NextApiResponse) {
  const { userId } = req.body;
  const userCollectionName =
    process.env.NEXT_PUBLIC_DB_USER_COLLECTION || "users-temp";

  if (!userId) {
    return res.status(400).json({
      success: false,
      message: "userId는 필수입니다.",
    });
  }

  const userDocRef = adminDb.collection(userCollectionName).doc(userId);
  const userDoc = await userDocRef.get();

  if (!userDoc.exists) {
    return res.status(404).json({
      success: false,
      message: "사용자를 찾을 수 없습니다.",
    });
  }

  const userData = userDoc.data() as User;
  const currentRoundNumber = userData.currentStatus?.currentRoundNumber || 1;

  // 현재 회차 문서 가져오기
  const roundDocRef = adminDb
    .collection(`${userCollectionName}/${userId}/rounds`)
    .doc(currentRoundNumber.toString());

  const roundDoc = await roundDocRef.get();
  if (!roundDoc.exists) {
    return res.status(400).json({
      success: false,
      message: "현재 회차가 할당되지 않았습니다.",
    });
  }

  const roundData = roundDoc.data() as ParticipationRound;

  // 현재 회차의 모든 태스크 리셋
  const resetTasks = {
    situational: roundData.tasks.situational.map((task) => ({
      ...task,
      status: TaskStatus.NOT_STARTED,
      completedAt: undefined,
      audioRecordId: undefined,
      quality: undefined,
    })),
    formal: roundData.tasks.formal.map((task) => ({
      ...task,
      status: TaskStatus.NOT_STARTED,
      completedAt: undefined,
      audioRecordId: undefined,
      quality: undefined,
    })),
  };

  const resetProgress: RoundProgress = {
    totalTasks: resetTasks.situational.length + resetTasks.formal.length,
    completedTasks: 0,
    submittedTasks: 0,
    approvedTasks: 0,
    byTaskType: {
      situational: {
        total: resetTasks.situational.length,
        completed: 0,
        submitted: 0,
        approved: 0,
      },
      formal: {
        total: resetTasks.formal.length,
        completed: 0,
        submitted: 0,
        approved: 0,
      },
    },
  };

  // 서브컬렉션 업데이트
  await roundDocRef.update({
    tasks: resetTasks,
    progress: resetProgress,
    status: RoundStatus.ASSIGNED,
  });
  // 한 번만 현재 시간을 가져와서 모든 곳에서 동일한 시간 사용
  const now = Timestamp.now();
  // 메인 문서 업데이트
  await userDocRef.update({
    "currentStatus.isTutorialCompleted": false,
    "currentStatus.currentRoundProgress": {
      completedPercentage: 0,
      submittedPercentage: 0,
      approvedPercentage: 0,
    },
    "statistics.current": {
      roundNumber: currentRoundNumber,
      totalTasks: resetProgress.totalTasks,
      completedTasks: 0,
      submittedTasks: 0,
      approvedTasks: 0,
      recordingTime: 0,
      completedPercentage: 0,
      approvedPercentage: 0,
      lastUpdatedAt: now,
    },
    updatedAt: now,
  });

  return res.status(200).json({
    success: true,
    message: "Admin API로 사용자 데이터가 리셋되었습니다.",
  });
}
// ===== Admin API 사용법 =====
/*


환경 변수 추가 필요:
FIREBASE_SERVICE_ACCOUNT_KEY={"type":"service_account",...} // Firebase Admin SDK JSON

1. 태스크 목록 조회:
GET /api/test/manage-tasks-admin?userId=user123

2. 개별 태스크 상태 업데이트:
POST /api/test/manage-tasks-admin
Body: { "userId": "user123", "updates": [...] }

3. 모든 태스크 완료:
PUT /api/test/manage-tasks-admin
Body: { "userId": "user123" }

4. 튜토리얼 상태 업데이트:
PATCH /api/test/manage-tasks-admin
Body: { "userId": "user123", "isTutorialCompleted": true }

5. 사용자 데이터 리셋 (새로 추가):
DELETE /api/test/manage-tasks-admin
Body: { "userId": "user123" }
*/
