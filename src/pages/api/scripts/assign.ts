// pages/api/scripts/assign.ts
import { NextApiRequest, NextApiResponse } from "next";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  writeBatch,
  serverTimestamp,
} from "firebase/firestore";

import { db } from "@/lib/firebase/config";
import {
  AssignScriptsRequest,
  AssignScriptsResponse,
  UserData,
  ScriptUsage,
} from "@/types/firebase";
import { loadAllScripts, getRandomItems } from "@/lib/scriptLoader";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<AssignScriptsResponse>
) {
  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      message: "Method not allowed",
      scripts: { situational: [], formal: [], qaScenario: [] },
    });
  }

  try {
    const { userId }: AssignScriptsRequest = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required",
        scripts: { situational: [], formal: [], qaScenario: [] },
      });
    }

    // 1. 사용자가 이미 할당받았는지 확인
    const userRef = doc(db, "users", userId);
    const userDoc = await getDoc(userRef);

    if (userDoc.exists()) {
      const userData = userDoc.data() as UserData;
      if (
        userData.assignedScripts &&
        (userData.assignedScripts.situational?.length > 0 ||
          userData.assignedScripts.formal?.length > 0 ||
          userData.assignedScripts.qaScenario?.length > 0)
      ) {
        const assignedScripts = await getAssignedScriptsContent(
          userData.assignedScripts
        );
        return res.status(200).json({
          success: true,
          scripts: assignedScripts,
          message: "이미 할당받은 스크립트가 있습니다.",
        });
      }
    }

    // 2. 모든 스크립트 로드
    const allScripts = await loadAllScripts();
    console.log("🔍 Total scripts loaded:", {
      situational: allScripts.situational.length,
      formal: allScripts.formal.length,
      qaScenario: allScripts.qaScenario.length,
    });

    // 3. 사용 가능한 스크립트 ID들 가져오기
    const availableScriptIds = await getAvailableScriptIds(allScripts);

    console.log("🔍 Available script IDs:", availableScriptIds);

    // 4. 사용 가능한 스크립트들 필터링
    const availableSituational = allScripts.situational.filter((script) =>
      availableScriptIds.situational.includes(script.id)
    );
    const availableFormal = allScripts.formal.filter((script) =>
      availableScriptIds.formal.includes(script.id)
    );
    const availableQAScenario = allScripts.qaScenario.filter((script) =>
      availableScriptIds.qaScenario.includes(script.id)
    );

    console.log("🔍 Filtered available scripts:", {
      situational: availableSituational.length,
      formal: availableFormal.length,
      qaScenario: availableQAScenario.length,
    });

    // 5. 충분한 스크립트가 있는지 확인
    if (
      availableSituational.length < 8 ||
      availableFormal.length < 8 ||
      availableQAScenario.length < 1
    ) {
      return res.status(400).json({
        success: false,
        message: `사용 가능한 스크립트가 부족합니다. (상황: ${availableSituational.length}/8, 정형: ${availableFormal.length}/8, QA: ${availableQAScenario.length}/1)`,
        scripts: { situational: [], formal: [], qaScenario: [] },
      });
    }

    // 6. 랜덤 선택
    const selectedSituational = getRandomItems(availableSituational, 8);
    const selectedFormal = getRandomItems(availableFormal, 8);
    const selectedQAScenario = getRandomItems(availableQAScenario, 1);

    // 7. DB 업데이트 (배치 처리)
    const batch = writeBatch(db);

    // 스크립트 사용 상태 업데이트
    const situationalUsageRef = doc(db, "scriptUsage", "situational");
    const formalUsageRef = doc(db, "scriptUsage", "formal");
    const qaScenarioUsageRef = doc(db, "scriptUsage", "qaScenario");

    // 선택된 스크립트들을 사용됨으로 표시
    const situationalUpdates: { [key: string]: boolean } = {};
    const formalUpdates: { [key: string]: boolean } = {};
    const qaScenarioUpdates: { [key: string]: boolean } = {};

    selectedSituational.forEach((script) => {
      situationalUpdates[script.id.toString()] = true;
    });
    selectedFormal.forEach((script) => {
      formalUpdates[script.id.toString()] = true;
    });
    selectedQAScenario.forEach((script) => {
      qaScenarioUpdates[script.id.toString()] = true;
    });

    batch.update(situationalUsageRef, situationalUpdates);
    batch.update(formalUsageRef, formalUpdates);
    batch.update(qaScenarioUsageRef, qaScenarioUpdates);

    // 사용자 데이터 생성/업데이트
    const assignedScriptIds = {
      situational: selectedSituational.map((s) => s.id),
      formal: selectedFormal.map((s) => s.id),
      qaScenario: selectedQAScenario.map((s) => s.id),
    };

    if (!userDoc.exists()) {
      const newUserData: Omit<UserData, "id"> = {
        createdAt: new Date(),
        lastAccess: new Date(),
        assignedScripts: assignedScriptIds,
        completedScripts: {
          situational: [],
          formal: [],
          qaScenario: [],
        },
        totalAssigned: 17,
        totalCompleted: 0,
      };
      batch.set(userRef, {
        ...newUserData,
        createdAt: serverTimestamp(),
        lastAccess: serverTimestamp(),
      });
    } else {
      batch.update(userRef, {
        assignedScripts: assignedScriptIds,
        totalAssigned: 17,
        lastAccess: serverTimestamp(),
      });
    }

    // 사용자별 진도 초기화
    [...selectedSituational, ...selectedFormal, ...selectedQAScenario].forEach(
      (script) => {
        const progressRef = doc(
          db,
          "users",
          userId,
          "progress",
          script.id.toString()
        );
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const scriptType = selectedSituational.includes(script as any)
          ? "situational"
          : // eslint-disable-next-line @typescript-eslint/no-explicit-any
          selectedFormal.includes(script as any)
          ? "formal"
          : "qaScenario";

        batch.set(progressRef, {
          scriptId: script.id,
          scriptType,
          status: "assigned",
          assignedAt: serverTimestamp(),
        });
      }
    );

    await batch.commit();

    return res.status(200).json({
      success: true,
      scripts: {
        situational: selectedSituational,
        formal: selectedFormal,
        qaScenario: selectedQAScenario,
      },
    });
  } catch (error) {
    console.error("❌ Error assigning scripts:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      scripts: { situational: [], formal: [], qaScenario: [] },
    });
  }
}

// 수정된 getAvailableScriptIds 함수
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getAvailableScriptIds(allScripts: any) {
  try {
    const usageCollection = collection(db, "scriptUsage");
    const usageDocs = await getDocs(usageCollection);

    console.log("🔍 ScriptUsage docs found:", usageDocs.size);

    const availableIds = {
      situational: [] as number[],
      formal: [] as number[],
      qaScenario: [] as number[],
    };

    // scriptUsage 컬렉션이 비어있는 경우, 모든 스크립트를 사용 가능으로 초기화
    if (usageDocs.empty) {
      console.log(
        "⚠️ No scriptUsage docs found. Initializing all scripts as available."
      );

      // 모든 스크립트를 사용 가능으로 설정
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      availableIds.situational = allScripts.situational.map((s: any) => s.id);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      availableIds.formal = allScripts.formal.map((s: any) => s.id);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      availableIds.qaScenario = allScripts.qaScenario.map((s: any) => s.id);

      // Firebase에 초기 데이터 생성
      await initializeScriptUsage(allScripts);

      return availableIds;
    }

    // 기존 로직
    usageDocs.forEach((doc) => {
      const data = doc.data() as ScriptUsage;
      const scriptType = doc.id as keyof typeof availableIds;

      console.log(`🔍 Processing ${scriptType} usage:`, data);

      Object.entries(data).forEach(([scriptId, isUsed]) => {
        if (!isUsed) {
          const numericId = parseInt(scriptId);
          if (!isNaN(numericId)) {
            availableIds[scriptType].push(numericId);
          }
        }
      });
    });

    console.log("🔍 Final available IDs:", availableIds);
    return availableIds;
  } catch (error) {
    console.error("❌ Error getting available script IDs:", error);

    // 에러 발생 시 모든 스크립트를 사용 가능으로 반환
    return {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      situational: allScripts.situational.map((s: any) => s.id),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      formal: allScripts.formal.map((s: any) => s.id),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      qaScenario: allScripts.qaScenario.map((s: any) => s.id),
    };
  }
}

// scriptUsage 컬렉션 초기화 함수
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function initializeScriptUsage(allScripts: any) {
  try {
    const batch = writeBatch(db);

    // situational 스크립트 사용 현황 초기화
    const situationalUsage: { [key: string]: boolean } = {};
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    allScripts.situational.forEach((script: any) => {
      situationalUsage[script.id.toString()] = false;
    });
    batch.set(doc(db, "scriptUsage", "situational"), situationalUsage);

    // formal 스크립트 사용 현황 초기화
    const formalUsage: { [key: string]: boolean } = {};
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    allScripts.formal.forEach((script: any) => {
      formalUsage[script.id.toString()] = false;
    });
    batch.set(doc(db, "scriptUsage", "formal"), formalUsage);

    // qaScenario 스크립트 사용 현황 초기화
    const qaScenarioUsage: { [key: string]: boolean } = {};
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    allScripts.qaScenario.forEach((script: any) => {
      qaScenarioUsage[script.id.toString()] = false;
    });
    batch.set(doc(db, "scriptUsage", "qaScenario"), qaScenarioUsage);

    await batch.commit();
    console.log("✅ Script usage initialized successfully");
  } catch (error) {
    console.error("❌ Error initializing script usage:", error);
    throw error;
  }
}

// 할당받은 스크립트 내용 가져오기
async function getAssignedScriptsContent(
  assignedScripts: UserData["assignedScripts"]
) {
  const allScripts = await loadAllScripts();

  const situational =
    assignedScripts.situational
      ?.map((id) => allScripts.situational.find((script) => script.id === id))
      .filter(Boolean) || [];

  const formal =
    assignedScripts.formal
      ?.map((id) => allScripts.formal.find((script) => script.id === id))
      .filter(Boolean) || [];

  const qaScenario =
    assignedScripts.qaScenario
      ?.map((id) => allScripts.qaScenario.find((script) => script.id === id))
      .filter(Boolean) || [];

  return {
    situational,
    formal,
    qaScenario,
  };
}
