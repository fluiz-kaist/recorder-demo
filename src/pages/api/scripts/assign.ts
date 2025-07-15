// pages/api/scripts/assign.ts
import { NextApiRequest, NextApiResponse } from "next";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  writeBatch,
  serverTimestamp,
  query,
  where,
} from "firebase/firestore";

import { db } from "@/lib/firebase/config";
import {
  ScriptType,
  ScriptStatus,
  Script,
  FormalScript,
  QAScenarioScript,
  SituationalScript,
  UserScriptAssignment,
} from "@/types/firebase";
import { loadAllScripts, getRandomItems } from "@/lib/scriptLoader";

// API 요청/응답 타입
interface AssignScriptsRequest {
  userId: string;
}

interface AssignScriptsResponse {
  success: boolean;
  message?: string;
  scripts: {
    formal: FormalScript[];
    qaScenario: QAScenarioScript[];
    situational: SituationalScript[];
  };
  assignments: UserScriptAssignment[];
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<AssignScriptsResponse>
) {
  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      message: "Method not allowed",
      scripts: { formal: [], qaScenario: [], situational: [] },
      assignments: [],
    });
  }

  try {
    const { userId }: AssignScriptsRequest = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required",
        scripts: { formal: [], qaScenario: [], situational: [] },
        assignments: [],
      });
    }

    // 1. 사용자 존재 확인
    const userRef = doc(db, "users", userId);
    const userDoc = await getDoc(userRef);

    if (!userDoc.exists()) {
      return res.status(404).json({
        success: false,
        message: "사용자를 찾을 수 없습니다. 먼저 회원가입을 완료해주세요.",
        scripts: { formal: [], qaScenario: [], situational: [] },
        assignments: [],
      });
    }

    // 2. 이미 할당받은 스크립트가 있는지 확인
    const existingAssignments = await checkExistingAssignments(userId);
    if (existingAssignments.length > 0) {
      const assignedScripts = await getAssignedScriptsContent(
        existingAssignments
      );
      return res.status(200).json({
        success: true,
        message: "이미 할당받은 스크립트가 있습니다.",
        scripts: assignedScripts,
        assignments: existingAssignments,
      });
    }

    // 3. 사용 가능한 스크립트들 찾기
    const availableScripts = await getAvailableScripts();

    // 4. 필요한 개수만큼 스크립트가 있는지 확인
    const requiredCounts = { formal: 2, qaScenario: 1, situational: 2 };

    if (
      availableScripts.formal.length < requiredCounts.formal ||
      availableScripts.qaScenario.length < requiredCounts.qaScenario ||
      availableScripts.situational.length < requiredCounts.situational
    ) {
      return res.status(400).json({
        success: false,
        message: `사용 가능한 스크립트가 부족합니다. (formal: ${availableScripts.formal.length}/${requiredCounts.formal}, qaScenario: ${availableScripts.qaScenario.length}/${requiredCounts.qaScenario}, situational: ${availableScripts.situational.length}/${requiredCounts.situational})`,
        scripts: { formal: [], qaScenario: [], situational: [] },
        assignments: [],
      });
    }

    // 5. 랜덤 선택
    const selectedFormal = getRandomItems(
      availableScripts.formal,
      requiredCounts.formal
    );
    const selectedQaScenario = getRandomItems(
      availableScripts.qaScenario,
      requiredCounts.qaScenario
    );
    const selectedSituational = getRandomItems(
      availableScripts.situational,
      requiredCounts.situational
    );

    console.log("🔍 Selected scripts:", {
      formal: selectedFormal,
      qaScenario: selectedQaScenario,
      situational: selectedSituational, // 이게 제대로 선택되는지 확인
    });

    // 6. 할당 처리 (배치)
    const now = new Date().toISOString();
    const batch = writeBatch(db);

    // 6-1. Script 문서들 생성/업데이트
    const allSelectedScripts = [
      ...selectedFormal.map((s) => ({ ...s, type: ScriptType.FORMAL })),
      ...selectedQaScenario.map((s) => ({
        ...s,
        type: ScriptType.QA_SCENARIO,
      })),
      ...selectedSituational.map((s) => ({
        ...s,
        type: ScriptType.SITUATIONAL,
      })),
    ];

    allSelectedScripts.forEach((scriptData) => {
      const scriptKey = `${scriptData.type}_${scriptData.id}`;
      const scriptRef = doc(db, "scripts", scriptKey);

      const scriptDoc: Script = {
        id: scriptData.id,
        type: scriptData.type,
        assignedTo: userId,
        assignedAt: now,
        status: ScriptStatus.ASSIGNED,
      };

      batch.set(scriptRef, {
        ...scriptDoc,
        assignedAt: serverTimestamp(),
      });
    });

    // 6-2. UserScriptAssignment 생성
    const assignments: UserScriptAssignment[] = [
      {
        userId,
        scriptType: ScriptType.FORMAL,
        assignedScriptIds: selectedFormal.map((s) => s.id),
        completedScriptIds: [],
        assignedAt: now,
      },
      {
        userId,
        scriptType: ScriptType.QA_SCENARIO,
        assignedScriptIds: selectedQaScenario.map((s) => s.id),
        completedScriptIds: [],
        assignedAt: now,
      },
      {
        userId,
        scriptType: ScriptType.SITUATIONAL,
        assignedScriptIds: selectedSituational.map((s) => s.id),
        completedScriptIds: [],
        assignedAt: now,
      },
    ];

    // 6-3. 사용자의 scriptAssignments 업데이트
    batch.update(userRef, {
      scriptAssignments: assignments,
      lastAccessAt: serverTimestamp(),
    });

    // 배치 커밋
    await batch.commit();

    console.log("✅ [assgin] 스크립트 할당 완료:", {
      userId,
      totalAssigned: allSelectedScripts.length,
      assignments: assignments.map((a) => ({
        type: a.scriptType,
        count: a.assignedScriptIds.length,
      })),
    });

    return res.status(200).json({
      success: true,
      scripts: {
        formal: selectedFormal,
        qaScenario: selectedQaScenario,
        situational: selectedSituational,
      },
      assignments,
    });
  } catch (error) {
    console.error("❌ Error assigning scripts:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      scripts: { formal: [], qaScenario: [], situational: [] },
      assignments: [],
    });
  }
}

// 사용 가능한 스크립트들 찾기 (Script 컬렉션에서 할당되지 않은 것들)
async function getAvailableScripts() {
  try {
    // 모든 스크립트 데이터 로드
    const allScripts = await loadAllScripts();

    // 이미 할당된 스크립트들 조회
    const scriptsCollection = collection(db, "scripts");
    const assignedQuery = query(
      scriptsCollection,
      where("status", "==", ScriptStatus.ASSIGNED)
    );
    const assignedDocs = await getDocs(assignedQuery);

    // 할당된 스크립트 ID들 추출
    const assignedScriptKeys = new Set<string>();
    assignedDocs.forEach((doc) => {
      const scriptData = doc.data() as Script;
      const scriptKey = `${scriptData.type}_${scriptData.id}`;
      assignedScriptKeys.add(scriptKey);
    });

    // 사용 가능한 스크립트들 필터링
    const availableScripts = {
      formal: allScripts.formal.filter(
        (script) => !assignedScriptKeys.has(`${ScriptType.FORMAL}_${script.id}`)
      ),
      qaScenario: allScripts.qaScenario.filter(
        (script) =>
          !assignedScriptKeys.has(`${ScriptType.QA_SCENARIO}_${script.id}`)
      ),
      situational: allScripts.situational.filter(
        (script) =>
          !assignedScriptKeys.has(`${ScriptType.SITUATIONAL}_${script.id}`)
      ),
    };

    console.log("🔍 Available scripts:", {
      formal: availableScripts.formal.length,
      qaScenario: availableScripts.qaScenario.length,
      situational: availableScripts.situational.length,
    });

    return availableScripts;
  } catch (error) {
    console.error("❌ Error getting available scripts:", error);

    // 에러 발생 시 모든 스크립트를 사용 가능으로 반환
    const allScripts = await loadAllScripts();
    return allScripts;
  }
}

// 기존 할당 확인
async function checkExistingAssignments(
  userId: string
): Promise<UserScriptAssignment[]> {
  try {
    const userRef = doc(db, "users", userId);
    const userDoc = await getDoc(userRef);

    if (userDoc.exists()) {
      const userData = userDoc.data();
      return userData.scriptAssignments || [];
    }

    return [];
  } catch (error) {
    console.error("❌ Error checking existing assignments:", error);
    return [];
  }
}

// 할당된 스크립트 내용 가져오기
async function getAssignedScriptsContent(assignments: UserScriptAssignment[]) {
  const allScripts = await loadAllScripts();

  const result = {
    formal: [] as FormalScript[],
    qaScenario: [] as QAScenarioScript[],
    situational: [] as SituationalScript[],
  };

  assignments.forEach((assignment) => {
    assignment.assignedScriptIds.forEach((scriptId) => {
      switch (assignment.scriptType) {
        case ScriptType.FORMAL:
          const formalScript = allScripts.formal.find(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (s: any) => s.id === scriptId
          );
          if (formalScript) result.formal.push(formalScript);
          break;
        case ScriptType.QA_SCENARIO:
          const qaScript = allScripts.qaScenario.find(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (s: any) => s.id === scriptId
          );
          if (qaScript) result.qaScenario.push(qaScript);
          break;
        case ScriptType.SITUATIONAL:
          const SituationalScript = allScripts.situational.find(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (s: any) => s.id === scriptId
          );
          if (SituationalScript) result.situational.push(SituationalScript);
          break;
      }
    });
  });

  return result;
}
