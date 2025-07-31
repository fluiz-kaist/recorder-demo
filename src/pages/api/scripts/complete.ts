// api/scripts/complete.ts - 수정된 버전
import {
  TaskStatus,
  ParticipationRound,
  Task,
  RoundProgress,
  UserStatistics,
} from "@/types/user";
import {
  getDocByIdTypedAdmin,
  updateDocByIdAdmin,
} from "@/lib/firebase/firestoreAdmin";
import { Timestamp } from "firebase-admin/firestore";
import { NextApiRequest, NextApiResponse } from "next";
import { CompleteScriptRequest } from "@/hooks/mutations/useUserMutations";
// status 매핑 함수
function mapToTaskStatus(status: string): TaskStatus {
  switch (status) {
    case "not_started":
      return TaskStatus.NOT_STARTED;
    case "in_progress":
      return TaskStatus.RECORDING; // 또는 TaskStatus.ASSIGNED
    case "completed":
      return TaskStatus.COMPLETED;
    case "submitted":
      return TaskStatus.SUBMITTED;
    case "approved":
      return TaskStatus.APPROVED;
    case "rejected":
      return TaskStatus.REJECTED;
    default:
      return TaskStatus.NOT_STARTED;
  }
}

// progress 계산 함수
function calculateProgress(tasks: {
  situational?: Task[];
  formal?: Task[];
}): RoundProgress {
  const situationalTasks = tasks.situational || [];
  const formalTasks = tasks.formal || [];

  // 상황발화 통계
  const situationalCompleted = situationalTasks.filter((t) =>
    [TaskStatus.COMPLETED, TaskStatus.SUBMITTED, TaskStatus.APPROVED].includes(
      t.status
    )
  ).length;
  const situationalSubmitted = situationalTasks.filter((t) =>
    [TaskStatus.SUBMITTED, TaskStatus.APPROVED].includes(t.status)
  ).length;
  const situationalApproved = situationalTasks.filter(
    (t) => t.status === TaskStatus.APPROVED
  ).length;

  // 정형발화 통계
  const formalCompleted = formalTasks.filter((t) =>
    [TaskStatus.COMPLETED, TaskStatus.SUBMITTED, TaskStatus.APPROVED].includes(
      t.status
    )
  ).length;

  const formalSubmitted = formalTasks.filter((t) =>
    [TaskStatus.SUBMITTED, TaskStatus.APPROVED].includes(t.status)
  ).length;

  const formalApproved = formalTasks.filter(
    (t) => t.status === TaskStatus.APPROVED
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
    byTaskType: {
      formal: {
        total: formalTasks.length,
        completed: formalCompleted,
        submitted: formalSubmitted,
        approved: formalApproved,
      },
      situational: {
        total: situationalTasks.length,
        completed: situationalCompleted,
        submitted: situationalSubmitted,
        approved: situationalApproved,
      },
    },
  };
}

// currentStatus 계산 함수
function calculateCurrentStatus(progress: RoundProgress) {
  const { totalTasks, completedTasks, submittedTasks, approvedTasks } =
    progress;

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
  const {
    userId,
    taskKey,
    taskType,
    status,
    audioRecordId,
    recordingDuration,
  } = req.body as CompleteScriptRequest;

  if (!userId || !taskKey || !taskType) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  // console.log("완료 처리 요청:", {
  //   userId,
  //   taskKey,
  //   taskType,
  //   status,
  //   audioRecordId,
  // });

  try {
    const userData = await getDocByIdTypedAdmin<any>(
      userCollectionName,
      userId
    );

    // console.log("여기서 userData?", userData);
    if (!userData?.currentStatus) {
      return res
        .status(404)
        .json({ message: "User currentStatus data not found" });
    }

    if (!userData?.statistics) {
      return res
        .status(404)
        .json({ message: "User statistics data not found" });
    }

    const existingStats = userData.statistics?.current;
    const existingRecordingTime = existingStats?.recordingTime || 0;

    const currentRoundNumber = userData.currentStatus?.currentRoundNumber || 1;

    // 서브컬렉션에서 현재 라운드 데이터 읽기
    const currentRoundDoc = await getDocByIdTypedAdmin<ParticipationRound>(
      `${userCollectionName}/${userId}/rounds`,
      currentRoundNumber.toString()
    );

    //현재 라운드 데이터 검증 및 준비
    if (!currentRoundDoc) {
      return res.status(404).json({ message: "Current round not found" });
    }

    // 현재 라운드에서 작업할 tasks 가져오기
    const currentRound = currentRoundDoc;
    const originalTasks = currentRound.tasks?.[taskType] || [];
    const tasks: Task[] = [...originalTasks];

    const taskIndex = tasks.findIndex((t) => t.taskKey === taskKey);
    // console.log(
    //   "taskIndex?",
    //   taskIndex,
    //   "이번 회차에서 작업할 tasks들?",
    //   tasks
    // );

    // 한 번만 현재 시간을 가져와서 모든 곳에서 동일한 시간 사용
    const now = Timestamp.now();

    if (taskIndex !== -1) {
      // 기존 task 업데이트
      tasks[taskIndex] = {
        ...tasks[taskIndex],
        status: mapToTaskStatus(status),
        ...(audioRecordId && { audioRecordId }),
        ...(status === "completed" && {
          completedAt: now,
        }),
      };
    } else {
      // 새 task 추가
      tasks.push({
        taskKey,
        taskType,
        status: mapToTaskStatus(status),
        assignedAt: now,
        ...(audioRecordId && { audioRecordId }),
      });
    }
    const updatedTasks = {
      ...currentRound.tasks,
      [taskType]: tasks,
    };

    console.log("업뎃된거", updatedTasks);

    const newProgress = calculateProgress(updatedTasks);

    //  3. currentStatus 업데이트
    const newCurrentStatus = calculateCurrentStatus(newProgress);

    // 현재 회차 통계 계산
    const newCurrentStatistics = calculateCurrentStatistics(
      currentRoundNumber,
      newProgress,
      newCurrentStatus,
      recordingDuration, // 현재 작업의 녹음 시간
      existingRecordingTime
    );

    console.group("어떻게 저장?");
    console.log(" updatedTasks", updatedTasks);
    console.log("new progress,", newProgress);
    console.log("newCurrentStatus", newCurrentStatus);
    console.groupEnd();

    // 4. Firestore 업데이트
    // 1. 서브컬렉션의 현재 라운드 문서 업데이트
    await updateDocByIdAdmin(
      `${userCollectionName}/${userId}/rounds`,
      currentRoundNumber.toString(),
      {
        tasks: updatedTasks,
        progress: newProgress,
        // 상태 변경시 타임스탬프 업데이트
        ...(status === "completed" && {
          completedAt: now,
        }),
        ...(status === "submitted" && {
          submittedAt: now,
        }),
      }
    );

    // 2. 메인 문서의 currentStatus만 업데이트
    await updateDocByIdAdmin(userCollectionName, userId, {
      "currentStatus.currentRoundProgress": newCurrentStatus,
      "statistics.current": newCurrentStatistics, // 추가
      "profile.lastAccessAt": now,
    });
    // 로그 출력
    console.log("업데이트 데이터:", {
      taskKey,
      taskType,
      status,
      roundNumber: currentRoundNumber, // setNumber → roundNumber
      newProgress,
      newCurrentStatus,
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
function calculateCurrentStatistics(
  roundNumber: number,
  progress: RoundProgress,
  currentStatus: any,
  recordingDuration?: number,
  existingRecordingTime = 0
): UserStatistics["current"] {
  return {
    roundNumber,
    totalTasks: progress.totalTasks,
    completedTasks: progress.completedTasks,
    submittedTasks: progress.submittedTasks,
    approvedTasks: progress.approvedTasks,
    recordingTime: existingRecordingTime + (recordingDuration || 0),
    completedPercentage: currentStatus.completedPercentage,
    approvedPercentage: currentStatus.approvedPercentage,
    lastUpdatedAt: Timestamp.now(),
  };
}
