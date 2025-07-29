// pages/api/scripts/assign.ts
import { NextApiRequest, NextApiResponse } from "next";
import {
  User,
  ParticipationSet,
  RecordingTask,
  ProgressMode,
  SituationalScript,
  FormalScript,
  FormalScriptSets,
} from "@/types/firebase";
import path from "path";
import fs from "fs";

import {
  getDocByIdTypedAdmin,
  updateDocByIdAdmin,
} from "@/lib/firebase/firestoreAdmin";
import { FieldValue } from "firebase-admin/firestore"; // 시간용

// API 요청/응답 타입
interface AssignScriptsRequest {
  userId: string;
  setNumber?: number; // 세트 번호 (기본값: 1)
  progressMode?: ProgressMode; // 진행 방식 (기본값: "mixed")
  setId?: number; // 정형발화 세트 ID (기본값: 1)
}

interface AssignScriptsResponse {
  success: boolean;
  message?: string;
  participationSet?: ParticipationSet;
  scripts: {
    situational: SituationalScript[];
    formal: FormalScript[];
  };
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<AssignScriptsResponse>
) {
  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      message: "Method not allowed",
      scripts: { situational: [], formal: [] },
    });
  }
  const userCollectionName =
    process.env.NEXT_PUBLIC_DB_USER_COLLECTION || "users-temp";

  try {
    const {
      userId,
      setNumber = 1,
      progressMode = "mixed", //기본세팅 혼합
      setId = 1,
    }: AssignScriptsRequest = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required",
        scripts: { situational: [], formal: [] },
      });
    }

    console.log("🎯 [assign] 스크립트 로컬 저장 요청:", {
      userId,
      setNumber,
      progressMode,
      setId,
    });

    // 1. 사용자 존재 확인
    const userData = await getDocByIdTypedAdmin<User>(
      userCollectionName,
      userId
    );
    if (!userData) {
      return res.status(404).json({
        success: false,
        message: "사용자를 찾을 수 없습니다. 먼저 회원가입을 완료해주세요.",
        scripts: { situational: [], formal: [] },
      });
    }

    // 2. 이미 해당 세트가 할당되어 있는지 확인
    const existingSet = userData.participation?.sets?.find(
      (set) => set.setNumber === setNumber
    );

    if (existingSet) {
      // 기존 세트가 있으면 해당 스크립트 데이터와 함께 반환
      const scripts = await getScriptsForSet(existingSet);
      return res.status(200).json({
        success: true,
        message: `세트 ${setNumber}가 이미 할당되어 있습니다.`,
        participationSet: existingSet,
        scripts,
      });
    }

    // 3. 스크립트 데이터 로드 (서버에서 직접 파일 읽기)
    const scripts = await loadScriptData(setId);

    // 4. 새로운 ParticipationSet 생성
    // task 내부의 데이터이므로 date string사용
    const now = new Date().toISOString();
    const newParticipationSet: ParticipationSet = {
      setNumber,
      setId,
      progressMode,
      tasks: {
        situational: createSituationalTasks(scripts.situational, now),
        formal: createFormalTasks(scripts.formal, now),
      },
      progress: {
        totalTasks: scripts.situational.length + scripts.formal.length,
        completedTasks: 0,
        submittedTasks: 0,
        approvedTasks: 0,
        situational: {
          total: scripts.situational.length,
          completed: 0,
          submitted: 0,
          approved: 0,
        },
        formal: {
          total: scripts.formal.length,
          completed: 0,
          submitted: 0,
          approved: 0,
        },
        currentTaskIndex: 0,
        currentTaskType: "situational",
      },
      status: "assigned",
      assignedAt: now,
    };

    // 5. 사용자 데이터 업데이트
    const updatedParticipation = {
      currentSetNumber: setNumber,
      totalCompletedSets: userData.participation?.totalCompletedSets || 0,
      maxAllowedSets: userData.participation?.maxAllowedSets || 3,
      preferredMode: progressMode,
      sets: [...(userData.participation?.sets || []), newParticipationSet],
      stats: userData.participation?.stats || {
        totalRecordings: 0,
        totalApprovedRecordings: 0,
        averageQualityScore: 0,
        firstParticipationAt: now,
      },
    };

    const updatedCurrentStatus = {
      isTutorialCompleted: userData.currentStatus?.isTutorialCompleted || false,
      canStartRecording: true,
      nextTask: {
        taskKey: newParticipationSet.tasks.situational[0]?.taskKey || "",
        taskType: "situational" as const,
        index: 0,
      },
      progress: {
        completedPercentage: 0,
        submittedPercentage: 0,
        approvedPercentage: 0,
      },
      pendingApproval: false,
      canStartNextSet: false,
    };

    // 6. Firestore 업데이트
    await updateDocByIdAdmin(userCollectionName, userId, {
      participation: updatedParticipation,
      currentStatus: updatedCurrentStatus,
      lastAccessAt: FieldValue.serverTimestamp(),
    });

    console.log("✅ [assign] 스크립트 할당 완료:", {
      userId,
      setNumber,
      totalTasks: newParticipationSet.progress.totalTasks,
      situationalTasks: scripts.situational.length,
      formalTasks: scripts.formal.length,
    });

    return res.status(200).json({
      success: true,
      message: `세트 ${setNumber} 할당이 완료되었습니다.`,
      participationSet: newParticipationSet,
      scripts,
    });
  } catch (error) {
    console.error("❌ [assign] Error assigning scripts:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      scripts: { situational: [], formal: [] },
    });
  }
}

// 서버에서 스크립트 데이터 로드
async function loadScriptData(setId: number): Promise<{
  situational: SituationalScript[];
  formal: FormalScript[];
}> {
  try {
    // 서버에서 파일 시스템 직접 접근
    const situationalPath = path.join(
      process.cwd(),
      "public/data/situational_scripts.json"
    );
    const formalPath = path.join(
      process.cwd(),
      "public/data/formal_scripts.json"
    );

    const situationalData = JSON.parse(
      fs.readFileSync(situationalPath, "utf8")
    ) as SituationalScript[];

    const formalData = JSON.parse(
      fs.readFileSync(formalPath, "utf8")
    ) as FormalScriptSets;

    // 현재 세트의 정형발화만 필터링
    const currentSetFormalScripts = filterFormalScriptsBySet(formalData, setId);

    console.log("📂 [loadScriptData] 스크립트 로드 완료:", {
      situational: situationalData.length,
      formal: currentSetFormalScripts.length,
      setId,
    });

    return {
      situational: situationalData,
      formal: currentSetFormalScripts,
    };
  } catch (error) {
    console.error("❌ [loadScriptData] 스크립트 로드 실패:", error);
    throw error;
  }
}

// 현재 세트의 정형발화만 필터링
function filterFormalScriptsBySet(
  formalData: FormalScriptSets,
  setId: number
): FormalScript[] {
  const filtered: FormalScript[] = [];

  Object.entries(formalData).forEach(([taskKey, sets]) => {
    const setData = sets[setId.toString()];
    if (setData && Array.isArray(setData)) {
      filtered.push(...setData);
    }
  });

  return filtered;
}

// 상황발화 태스크 생성
function createSituationalTasks(
  scripts: SituationalScript[],
  assignedAt: string
): RecordingTask[] {
  return scripts.map((script) => ({
    taskKey: script.task_key,
    taskType: "situational",
    status: "not_started",
    assignedAt,
  }));
}

// 정형발화 태스크 생성
function createFormalTasks(
  scripts: FormalScript[],
  assignedAt: string
): RecordingTask[] {
  return scripts.map((script) => ({
    taskKey: script.task_key,
    taskType: "formal",
    setId: script["set-id"],
    status: "not_started",
    assignedAt,
  }));
}

// 기존 세트의 스크립트 데이터 조회
async function getScriptsForSet(participationSet: ParticipationSet): Promise<{
  situational: SituationalScript[];
  formal: FormalScript[];
}> {
  const scripts = await loadScriptData(participationSet.setId);

  // 할당된 태스크에 해당하는 스크립트만 필터링
  const situationalTaskKeys = participationSet.tasks.situational.map(
    (task) => task.taskKey
  );
  const formalTaskKeys = participationSet.tasks.formal.map(
    (task) => task.taskKey
  );

  return {
    situational: scripts.situational.filter((script) =>
      situationalTaskKeys.includes(script.task_key)
    ),
    formal: scripts.formal.filter((script) =>
      formalTaskKeys.includes(script.task_key)
    ),
  };
}
/**
 * [assign.ts 설명]
 *
 * 사용자에게 새 발화 세트를 할당하는 API입니다.
 *
 * ✅ setNumber vs setId 구분
 * - setNumber: 사용자의 진행 회차 (1회차, 2회차 등) — UI 및 진행 추적용
 * - setId: 실제 불러올 정형 발화 세트 번호 — formal_scripts.json에서 스크립트 분기용
 *
 * 예: 2회차 사용자에게 2세트를 할당하려면
 * {
 *   userId: "...",
 *   setNumber: 2, // 사용자 진행 기록용
 *   setId: 2,     // 불러올 정형 스크립트 세트 ID
 *   progressMode: "mixed"
 * }
 *
 * 둘 다 명확히 구분해 설정하지 않으면 스크립트 로딩 또는 기록에 오류 발생 가능
 */
