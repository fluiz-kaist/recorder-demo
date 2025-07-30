// api/scripts/complete.ts - 수정된 버전

import {
  getDocByIdTypedAdmin,
  updateDocByIdAdmin,
} from "@/lib/firebase/firestoreAdmin";
import { FieldValue } from "firebase-admin/firestore";
import { NextApiRequest, NextApiResponse } from "next";
import { CompleteScriptRequest } from "@/hooks/mutations/useUserMutations";

// Firestore 내 개별 task의 타입
interface TaskEntry {
  taskKey: string;
  taskType: "situational" | "formal";
  status:
    | "not_started"
    | "in_progress"
    | "completed"
    | "submitted"
    | "approved";
  assignedAt: string;
  setId?: number;
  audioRecordId?: string;
}

// Firestore 내 set의 타입 (부분 정의)
interface ParticipationSet {
  setNumber: number; // ✅ 추가
  setId: number;
  tasks: {
    situational?: TaskEntry[];
    formal?: TaskEntry[];
  };
  progress: {
    totalTasks: number;
    completedTasks: number;
    submittedTasks: number;
    approvedTasks: number;
    situational: {
      total: number;
      completed: number;
      submitted: number;
      approved: number;
    };
    formal: {
      total: number;
      completed: number;
      submitted: number;
      approved: number;
    };
    currentTaskIndex?: number;
    currentTaskType?: "situational" | "formal";
  };
}
// 🎯 progress 계산 함수
function calculateProgress(tasks: {
  situational?: TaskEntry[];
  formal?: TaskEntry[];
}) {
  const situationalTasks = tasks.situational || [];
  const formalTasks = tasks.formal || [];

  // 상황발화 통계
  const situationalCompleted = situationalTasks.filter((t) =>
    ["completed", "submitted", "approved"].includes(t.status)
  ).length;
  const situationalSubmitted = situationalTasks.filter((t) =>
    ["submitted", "approved"].includes(t.status)
  ).length;
  const situationalApproved = situationalTasks.filter(
    (t) => t.status === "approved"
  ).length;

  // 정형발화 통계
  const formalCompleted = formalTasks.filter((t) =>
    ["completed", "submitted", "approved"].includes(t.status)
  ).length;
  const formalSubmitted = formalTasks.filter((t) =>
    ["submitted", "approved"].includes(t.status)
  ).length;
  const formalApproved = formalTasks.filter(
    (t) => t.status === "approved"
  ).length;

  // 전체 통계
  const totalTasks = situationalTasks.length + formalTasks.length;
  const completedTasks = situationalCompleted + formalCompleted;
  const submittedTasks = situationalSubmitted + formalSubmitted;
  const approvedTasks = situationalApproved + formalApproved;

  return {
    totalTasks,
    completedTasks,
    submittedTasks,
    approvedTasks,
    situational: {
      total: situationalTasks.length,
      completed: situationalCompleted,
      submitted: situationalSubmitted,
      approved: situationalApproved,
    },
    formal: {
      total: formalTasks.length,
      completed: formalCompleted,
      submitted: formalSubmitted,
      approved: formalApproved,
    },
  };
}

// 🎯 currentStatus 계산 함수
function calculateCurrentStatus(
  sets: ParticipationSet[],
  currentSetNumber: number
) {
  const currentSet = sets.find((s) => s.setNumber === currentSetNumber);
  if (!currentSet) {
    return {
      completedPercentage: 0,
      submittedPercentage: 0,
      approvedPercentage: 0,
    };
  }

  const { totalTasks, completedTasks, submittedTasks, approvedTasks } =
    currentSet.progress;

  if (totalTasks === 0) {
    return {
      completedPercentage: 0,
      submittedPercentage: 0,
      approvedPercentage: 0,
    };
  }

  return {
    completedPercentage: Math.round((completedTasks / totalTasks) * 100),
    submittedPercentage: Math.round((submittedTasks / totalTasks) * 100),
    approvedPercentage: Math.round((approvedTasks / totalTasks) * 100),
  };
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method Not Allowed" });
  }
  const userCollectionName =
    process.env.NEXT_PUBLIC_DB_USER_COLLECTION || "users-temp";
  const { userId, taskKey, taskType, status, audioRecordId } =
    req.body as CompleteScriptRequest;

  if (!userId || !taskKey || !taskType) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  console.log("완료 처리 요청:", {
    userId,
    taskKey,
    taskType,
    status,
    audioRecordId,
  });

  try {
    const userData = await getDocByIdTypedAdmin<any>(
      userCollectionName,
      userId
    );
    if (!userData?.participation?.sets) {
      return res
        .status(404)
        .json({ message: "User participation data not found" });
    }

    if (!userData?.participation?.sets) {
      return res
        .status(404)
        .json({ message: "User participation data not found" });
    }

    const sets: ParticipationSet[] = userData.participation.sets;
    const currentSetNumber = userData.participation?.currentSetNumber || 1;

    // ✅ 1. tasks 배열 업데이트
    const updatedSets = sets.map((set) => {
      const originalTasks = set.tasks?.[taskType] || [];
      const tasks: TaskEntry[] = [...originalTasks];

      const taskIndex = tasks.findIndex((t) => t.taskKey === taskKey);

      if (taskIndex !== -1) {
        // 기존 task가 있는 경우: status와 audioRecordId 갱신
        tasks[taskIndex] = {
          ...tasks[taskIndex],
          status,
          ...(audioRecordId && { audioRecordId }),
        };
      } else {
        // 없는 경우: 새로 추가
        tasks.push({
          taskKey,
          taskType,
          status,
          assignedAt: new Date().toISOString(),
          setId: set.setId,
          ...(audioRecordId && { audioRecordId }),
        });
      }

      // ✅ 2. progress 통계 다시 계산
      const updatedTasks = {
        ...set.tasks,
        [taskType]: tasks,
      };

      const newProgress = calculateProgress(updatedTasks);

      return {
        ...set,
        tasks: updatedTasks,
        progress: {
          ...set.progress,
          ...newProgress,
        },
      };
    });

    // ✅ 3. currentStatus 업데이트
    const newCurrentStatus = calculateCurrentStatus(
      updatedSets,
      currentSetNumber
    );

    // ✅ 4. Firestore 업데이트
    const updateData: any = {
      "participation.sets": updatedSets,
      "currentStatus.progress": newCurrentStatus,
      lastAccessAt: new Date().toISOString(),
    };

    // 📊 로그 출력
    console.log("업데이트 데이터:", {
      taskKey,
      taskType,
      status,
      newProgress: updatedSets.find((s) => s.setNumber === currentSetNumber)
        ?.progress,
      newCurrentStatus,
    });

    await updateDocByIdAdmin(userCollectionName, userId, {
      ...updateData,
      lastAccessAt: FieldValue.serverTimestamp(), // if you prefer server timestamp
    });

    return res.status(200).json({
      message: "Participation status updated successfully",
      progress: newCurrentStatus,
    });
  } catch (err: any) {
    console.error("Error updating participation:", err);
    return res
      .status(500)
      .json({ message: "Internal Server Error", error: err.message });
  }
}
