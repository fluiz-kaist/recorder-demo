// pages/api/test/manage-tasks-admin.ts - Admin SDK 기반 테스트 API
import { NextApiRequest, NextApiResponse } from "next";
import { adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
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
          task.status = "completed";
          task.completedAt = now;
          task.recordingId =
            task.recordingId || `admin_test_${task.taskKey}_${Date.now()}`;
          task.quality = task.quality || {
            duration: 10.0,
            volumeLevel: 0.8,
            silenceRatio: 0.1,
            isValidRecording: true,
          };
        } else if (status === "not_started") {
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

    if (totalCompleted === totalTasks) {
      set.status = "completed";
      set.completedAt = now;
    } else if (totalCompleted > 0) {
      set.status = "in_progress";
    } else {
      set.status = "assigned";
    }
  });

  // 🔥 Admin SDK로 Firestore 업데이트 (보안 규칙 우회)
  await userDocRef.update({
    "participation.sets": updatedSets,
    updatedAt: FieldValue.serverTimestamp(),
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
      recordingId:
        task.recordingId || `admin_complete_${task.taskKey}_${Date.now()}`,
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
      recordingId:
        task.recordingId || `admin_complete_${task.taskKey}_${Date.now()}`,
      quality: task.quality || {
        duration: 8.2,
        volumeLevel: 0.75,
        silenceRatio: 0.15,
        isValidRecording: true,
      },
    }));

    const totalTasks =
      updatedSituationalTasks.length + updatedFormalTasks.length;
    const completedTasks = totalTasks;

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

  const totalCompletedSets = updatedSets.length;
  const totalRecordings = updatedSets.reduce(
    (sum, set) => sum + set.progress.completedTasks,
    0
  );

  const updatedCurrentStatus = {
    isTutorialCompleted: true,
    canStartRecording: false,
    progress: {
      completedPercentage: 100,
      submittedPercentage: 100,
      approvedPercentage: 100,
    },
    pendingApproval: false,
    canStartNextSet: totalCompletedSets < userData.participation.maxAllowedSets,
  };

  // 🔥 Admin SDK로 업데이트 (보안 규칙 우회)
  await userDocRef.update({
    "participation.sets": updatedSets,
    "participation.totalCompletedSets": totalCompletedSets,
    "participation.stats.totalRecordings": totalRecordings,
    "participation.stats.totalApprovedRecordings": totalRecordings,
    "participation.stats.averageQualityScore": 85,
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
    updatedAt: FieldValue.serverTimestamp(),
  });

  console.log(`Admin API: 사용자 ${userId}의 모든 태스크 완료 처리`);

  return res.status(200).json({
    success: true,
    message: "Admin API로 모든 태스크가 완료되었습니다.",
    data: {
      userId,
      totalSets: updatedSets.length,
      completedSets: totalCompletedSets,
      totalTasks: totalRecordings,
      completedAt: now,
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

  await userDocRef.update({
    "currentStatus.isTutorialCompleted": isTutorialCompleted,
    "recordingStatus.isTutorialCompleted": isTutorialCompleted,
    updatedAt: FieldValue.serverTimestamp(),
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

  // 모든 태스크를 not_started로 리셋
  if (userData.participation?.sets?.length) {
    const resetSets = userData.participation.sets.map((set) => ({
      ...set,
      tasks: {
        situational: set.tasks.situational.map((task) => ({
          ...task,
          status: "not_started" as const,
          completedAt: undefined,
          recordingId: undefined,
          quality: undefined,
        })),
        formal: set.tasks.formal.map((task) => ({
          ...task,
          status: "not_started" as const,
          completedAt: undefined,
          recordingId: undefined,
          quality: undefined,
        })),
      },
      progress: {
        ...set.progress,
        completedTasks: 0,
        submittedTasks: 0,
        approvedTasks: 0,
        situational: {
          total: set.tasks.situational.length,
          completed: 0,
          submitted: 0,
          approved: 0,
        },
        formal: {
          total: set.tasks.formal.length,
          completed: 0,
          submitted: 0,
          approved: 0,
        },
      },
      status: "assigned" as const,
      completedAt: undefined,
      submittedAt: undefined,
      approvedAt: undefined,
    }));

    await userDocRef.update({
      "participation.sets": resetSets,
      "participation.totalCompletedSets": 0,
      "participation.stats.totalRecordings": 0,
      "participation.stats.totalApprovedRecordings": 0,
      "participation.stats.averageQualityScore": 0,
      "currentStatus.isTutorialCompleted": false,
      "currentStatus.canStartRecording": true,
      "currentStatus.progress.completedPercentage": 0,
      "currentStatus.progress.submittedPercentage": 0,
      "currentStatus.progress.approvedPercentage": 0,
      "recordingStatus.isAllRecordingCompleted": false,
      "recordingStatus.isTutorialCompleted": false,
      updatedAt: FieldValue.serverTimestamp(),
    });
  }

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
