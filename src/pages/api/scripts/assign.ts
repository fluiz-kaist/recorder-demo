// pages/api/scripts/assign.ts
import { NextApiRequest, NextApiResponse } from "next";
import {
  SituationalScript,
  FormalScript,
  FormalScriptSets,
  SituationalScriptSets,
} from "@/types/firebase";
import path from "path";
import fs from "fs";
import {
  User,
  ParticipationRound,
  Task,
  TaskStatus,
  RoundStatus,
  RoundSummary,
  CurrentUserStatus,
  ProgressMode,
} from "@/types/user";
import { getDisplaySetId } from "@/utils/converter";
import {
  getDocByIdTypedAdmin,
  updateDocByIdAdmin,
  saveDocAdmin,
  docExistsAdmin,
} from "@/lib/firebase/firestoreAdmin";
import { FieldValue, Timestamp } from "firebase-admin/firestore"; // 시간용
import { getEnv } from "@/utils/envConfig";
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
  participationRound?: ParticipationRound;
  scripts: {
    situational: SituationalScript[];
    formal: FormalScript[];
  };
}
/**
 * [assign.ts 설명]
 *
 * 튜토리얼 완료 후 사용자에게 첫 번째 또는 새로운 발화 세트를 할당하는 API입니다.
 * 할당된 발화 태스크들은 사용자별 서브컬렉션에 저장되어 진행 상황을 추적합니다.
 *
 * ✅ setNumber vs setId 구분
 * - setNumber: 사용자의 진행 회차 (1회차, 2회차 등) — 사용자 진행 기록 및 UI 표시용
 * - setId: 실제 불러올 정형 발화 세트 번호 — formal_scripts.json에서 해당 세트 스크립트 로딩용
 *
 * 📝 사용 예시:
 * - 1회차 시작: { userId: "...", setNumber: 1, setId: 1, progressMode: "mixed" }
 * - 2회차 시작: { userId: "...", setNumber: 2, setId: 2, progressMode: "mixed" }
 *
 * ⚠️ 주의사항: setNumber와 setId를 명확히 구분하지 않으면
 *    스크립트 로딩 오류 또는 진행 기록 혼란이 발생할 수 있습니다.
 */

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
      progressMode = ProgressMode.MIXED, //기본세팅 혼합
      setId = 1,
    }: AssignScriptsRequest = req.body;
    const { isPreview, isDev } = getEnv();
    const isDevMode = isPreview || isDev;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required",
        scripts: { situational: [], formal: [] },
      });
    }

    console.log("🎯 [assign] 발화 세트 할당 요청:", {
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
        message: "사용자를 찾을 수 없습니다. 튜토리얼을 먼저 완료해주세요.",
        scripts: { situational: [], formal: [] },
      });
    }

    // 2. 이미 해당 세트가 할당되어 있는지 확인
    const existingRound = userData.roundSummaries?.find(
      (summary) => summary.roundNumber === setNumber
    );
    // 기존 라운드 확인 시 (기존 저장된 데이터를 읽어야 하므로 getDisplaySetId 사용)
    if (existingRound) {
      // 기존 회차가 있으면 항상 서브컬렉션도 있어야 함
      // 서브컬렉션 문서 존재 여부만 먼저 확인
      const roundExists = await docExistsAdmin(
        `${userCollectionName}/${userId}/rounds`,
        setNumber.toString()
      );

      if (!roundExists) {
        // 이는 서브컬렉션이 생성되지 않은 상황 → 새로 생성해야 함
        console.log("🔄 [assign] 서브컬렉션 생성:", { userId, setNumber });
        // 기존 요약 정보로 서브컬렉션 생성 - 기존 데이터이므로 getDisplaySetId 사용
        const currentSetId = getDisplaySetId(existingRound);
        // 기존 요약 정보로 서브컬렉션 생성
        const scripts = await loadScriptData(currentSetId);
        const newRoundDetail = recreateParticipationRound(
          userId,
          existingRound,
          scripts
        );

        // 서브컬렉션에 저장
        await saveDocAdmin(
          `${userCollectionName}/${userId}/rounds`,
          setNumber.toString(),
          newRoundDetail
        );

        return res.status(200).json({
          success: true,
          message: `${setNumber}회차 진행 데이터를 생성했습니다.`,
          participationRound: newRoundDetail,
          scripts,
        });
      }
      // 존재하면 데이터 로드
      const existingRoundDetail =
        await getDocByIdTypedAdmin<ParticipationRound>(
          `${userCollectionName}/${userId}/rounds`,
          setNumber.toString()
        );

      // null 체크 추가 - 이론적으로는 roundExists가 true이므로 null일 수 없지만 타입 안전성을 위해
      if (!existingRoundDetail) {
        console.error(
          "❌ [assign] 예상치 못한 상황: 문서는 존재하지만 데이터를 가져올 수 없음"
        );
        return res.status(500).json({
          success: false,
          message: "데이터 로딩 중 오류가 발생했습니다.",
          scripts: { situational: [], formal: [] },
        });
      }

      // 이제 existingRoundDetail은 확실히 ParticipationRound 타입
      const scripts = await getScriptsForSet(existingRoundDetail);

      console.log("✅ [assign] 기존 세트 반환:", {
        userId,
        setNumber,
        taskCount: existingRoundDetail.progress.totalTasks,
      });

      return res.status(200).json({
        success: true,
        message: `${setNumber}회차 발화 세트를 불러왔습니다.`,
        participationRound: existingRoundDetail,
        scripts,
      });
    }
    // 3. 스크립트 데이터 로드 (서버에서 직접 파일 읽기)
    const scripts = await loadScriptData(setId);

    // 4. 새로운 ParticipationSet 생성
    // 한 번만 현재 시간을 가져와서 모든 곳에서 동일한 시간 사용
    const now = Timestamp.now();
    const newParticipationRound: ParticipationRound = {
      userId,
      roundNumber: setNumber,
      setId: setId, // 새로운 구조는 setId만 사용
      // formalSetId는 설정하지 않음
      progressMode,
      status: RoundStatus.ASSIGNED,
      assignedAt: now,

      tasks: {
        situational: createSituationalTasks(scripts.situational, now),
        formal: createFormalTasks(scripts.formal, now),
      },

      progress: {
        totalTasks: scripts.situational.length + scripts.formal.length,
        completedTasks: 0,
        submittedTasks: 0,
        approvedTasks: 0,
        byTaskType: {
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
        },
        currentTaskIndex: 0,
        currentTaskType: "situational",
      },
    };

    // 5. 사용자 데이터 업데이트
    const newRoundSummary: RoundSummary = {
      roundNumber: setNumber,
      setId: setId, // 새로운 구조는 setId만 사용
      // formalSetId는 설정하지 않음
      status: RoundStatus.ASSIGNED,
      assignedAt: now,
      progressSummary: {
        totalTasks: newParticipationRound.progress.totalTasks,
        approvedTasks: 0,
        approvalRate: 0,
      },
    };

    const updatedCurrentStatus: CurrentUserStatus = {
      isOnboardingCompleted:
        userData.currentStatus?.isOnboardingCompleted || false,
      isTutorialCompleted: userData.currentStatus?.isTutorialCompleted || false,
      currentRoundNumber: setNumber,
      canStartRecording: true,
      canStartNextRound: true, //처음 배정하는 건
      hasPendingApproval: false,
      currentRoundProgress: {
        completedPercentage: 0,
        submittedPercentage: 0,
        approvedPercentage: 0,
      },
      nextTask: {
        taskKey: newParticipationRound.tasks.situational[0]?.taskKey || "",
        taskType: "situational",
        taskIndex: 0,
      },
    };

    // 6. Firestore 업데이트
    // Firestore 업데이트 - 메인 문서와 서브컬렉션 분리
    await updateDocByIdAdmin(userCollectionName, userId, {
      // roundSummaries 배열에 새 항목 추가
      roundSummaries: [...(userData.roundSummaries || []), newRoundSummary],
      currentStatus: updatedCurrentStatus,
      updatedAt: FieldValue.serverTimestamp(),
    });

    // 서브컬렉션에 상세 라운드 데이터 저장
    await saveDocAdmin(
      `${userCollectionName}/${userId}/rounds`,
      setNumber.toString(),
      newParticipationRound
    );
    console.log("✅ [assign] 스크립트 할당 완료:", {
      userId,
      setNumber,
      totalTasks: newRoundSummary.progressSummary.totalTasks,
      situationalTasks: scripts.situational.length,
      formalTasks: scripts.formal.length,
    });

    return res.status(200).json({
      success: true,
      message: `${setNumber}회차 발화 세트 할당이 완료되었습니다.`, // 수정
      participationRound: newParticipationRound, // 변경
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
  const { isPreview, isDev } = getEnv();
  const isDevMode = isPreview || isDev;

  const situationScriptPath = isDevMode
    ? "public/data/prod_situational_script.json"
    : "public/data/prod_situational_script.json";
  const formalScriptPath = isDevMode
    ? "public/data/prod_formal_script.json"
    : "public/data/prod_formal_script.json";

  try {
    const situationalPath = path.join(process.cwd(), situationScriptPath);
    const formalPath = path.join(process.cwd(), formalScriptPath);

    // 새로운 구조: { "1": [...], "2": [...] }
    const situationalData = JSON.parse(
      fs.readFileSync(situationalPath, "utf8")
    ) as SituationalScriptSets;

    // 새로운 구조: { "task_key": [...] } (setId 없음)
    const formalData = JSON.parse(
      fs.readFileSync(formalPath, "utf8")
    ) as FormalScriptSets;

    // setId에 해당하는 상황발화 추출
    const situationalScripts = situationalData[setId.toString()] || [];

    // 상황발화의 task_key들만 추출
    const taskKeys = situationalScripts.map((script) => script.task_key);

    // 해당 task_key에 맞는 정형발화만 필터링
    const formalScripts: FormalScript[] = [];
    taskKeys.forEach((taskKey) => {
      const scripts = formalData[taskKey] || [];
      formalScripts.push(...scripts);
    });

    console.log("📂 [loadScriptData] 스크립트 로드 완료:", {
      situational: situationalScripts.length,
      formal: formalScripts.length,
      setId,
    });

    return {
      situational: situationalScripts,
      formal: formalScripts,
    };
  } catch (error) {
    console.error("❌ [loadScriptData] 스크립트 로드 실패:", error);
    throw error;
  }
}

function getAllFormalScripts(formalData: FormalScriptSets): FormalScript[] {
  return Object.values(formalData).flat();
}

// 상황발화 태스크 생성
function createSituationalTasks(
  scripts: SituationalScript[],
  assignedAt: FieldValue | string // 타입 확장
): Task[] {
  return scripts.map((script) => ({
    taskKey: script.task_key,
    taskType: "situational",
    status: TaskStatus.ASSIGNED, // enum 사용
    assignedAt,
  }));
}
// 정형발화 태스크 생성
function createFormalTasks(
  scripts: FormalScript[],
  assignedAt: FieldValue | string // 타입 확장
): Task[] {
  return scripts.map((script) => ({
    taskKey: script.task_key,
    taskType: "formal",
    status: TaskStatus.ASSIGNED, // enum 사용
    assignedAt,
  }));
}

// 기존 세트의 스크립트 데이터 조회
async function getScriptsForSet(
  participationRound: ParticipationRound
): Promise<{
  situational: SituationalScript[];
  formal: FormalScript[];
}> {
  // setId 대신 roundNumber를 사용하여 상황발화 로드
  // 기존 저장된 데이터이므로 formalSetId 우선, 없으면 setId 사용
  const currentSetId = getDisplaySetId(participationRound);
  const scripts = await loadScriptData(currentSetId);

  const situationalTaskKeys = participationRound.tasks.situational.map(
    (task) => task.taskKey
  );
  const formalTaskKeys = participationRound.tasks.formal.map(
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
// 기존 요약 데이터를 기반으로 새로운 ParticipationRound 생성
function recreateParticipationRound(
  userId: string,
  existingRound: RoundSummary,
  scripts: { situational: SituationalScript[]; formal: FormalScript[] }
): ParticipationRound {
  const baseRound: ParticipationRound = {
    userId: userId,
    roundNumber: existingRound.roundNumber,
    // 기존 데이터 구조 그대로 유지
    ...(existingRound.formalSetId && {
      formalSetId: existingRound.formalSetId,
    }),
    ...(existingRound.setId && { setId: existingRound.setId }),
    progressMode: ProgressMode.MIXED, // 기본값
    status: existingRound.status,
    assignedAt: existingRound.assignedAt,

    // 태스크 재구성
    tasks: {
      situational: scripts.situational.map((script) => ({
        taskKey: script.task_key,
        taskType: "situational" as const,
        status: TaskStatus.ASSIGNED, // 기본 상태로 설정
        assignedAt: existingRound.assignedAt,
      })),
      formal: scripts.formal.map((script) => ({
        taskKey: script.task_key,
        taskType: "formal" as const,
        status: TaskStatus.ASSIGNED, // 기본 상태로 설정
        assignedAt: existingRound.assignedAt,
      })),
    },

    // 진행률 재구성
    progress: {
      totalTasks: scripts.situational.length + scripts.formal.length,
      completedTasks: 0, // 기본값
      submittedTasks: 0,
      approvedTasks: 0,
      byTaskType: {
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
      },
      currentTaskIndex: 0,
      currentTaskType: "situational",
    },
  };

  // undefined가 아닌 경우에만 추가
  // 하지만 할당 시에는 당연히 ud이므로 패스 됨
  if (existingRound.completedAt !== undefined) {
    baseRound.completedAt = existingRound.completedAt;
  }

  if (existingRound.approvedAt !== undefined) {
    baseRound.approvedAt = existingRound.approvedAt;
  }

  return baseRound;
}
