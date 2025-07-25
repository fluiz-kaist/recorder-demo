import { db } from "@/lib/firebase/config";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { NextApiRequest, NextApiResponse } from "next";
import { CompleteScriptRequest } from "@/hooks/mutations/useUserMutations";
// 요청 body의 타입
// interface CompleteScriptRequest {
//   userId: string;
//   taskKey: string;
//   taskType: "situational" | "formal";
//   audioRecordId: string;
// }

// Firestore 내 개별 task의 타입
interface TaskEntry {
  taskKey: string;
  taskType: "situational" | "formal";
  status: "not_started" | "in_progress" | "completed";
  assignedAt: string;
  setId: number;
  audioRecordId: string;
}

// Firestore 내 set의 타입 (부분 정의)
interface ParticipationSet {
  setId: number;
  tasks: {
    situational?: TaskEntry[];
    formal?: TaskEntry[];
  };
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  const { userId, taskKey, taskType, status, audioRecordId } =
    req.body as CompleteScriptRequest;

  if (!userId || !taskKey || !taskType) {
    return res.status(400).json({ message: "Missing required fields" });
  }
  console.log("여기서 status", status);
  try {
    const userRef = doc(db, "usersV2", userId);
    const userSnap = await getDoc(userRef);
    const userData = userSnap.data();

    console.log("?? userData?? ", userData);

    if (!userData?.participation?.sets) {
      return res
        .status(404)
        .json({ message: "User participation data not found" });
    }

    const sets: ParticipationSet[] = userData.participation.sets;

    const updatedSets = sets.map((set) => {
      const originalTasks = set.tasks?.[taskType] || [];
      const tasks: TaskEntry[] = [...originalTasks];
      const taskIndex = tasks.findIndex((t) => t.taskKey === taskKey);

      if (taskIndex !== -1) {
        // 기존 task가 있는 경우: status만 갱신
        tasks[taskIndex] = {
          ...tasks[taskIndex],
          status,
          audioRecordId,
        };
      } else {
        // 없는 경우: 새로 추가
        tasks.push({
          taskKey,
          taskType,
          status,
          assignedAt: new Date().toISOString(),
          setId: set.setId,
          audioRecordId,
        });
      }

      return {
        ...set,
        tasks: {
          ...set.tasks,
          [taskType]: tasks,
        },
      };
    });

    await updateDoc(userRef, {
      "participation.sets": updatedSets,
    });

    return res
      .status(200)
      .json({ message: "Participation status updated successfully" });
  } catch (err: any) {
    console.error("Error updating participation:", err);
    return res
      .status(500)
      .json({ message: "Internal Server Error", error: err.message });
  }
}
