// pages/api/admin/init-script-usage.ts
// 정적 파일의 스크립트들을 DB에 사용 가능 상태로 초기화하는 API

import { NextApiRequest, NextApiResponse } from "next";
import { doc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { loadAllScripts } from "../../../lib/scriptLoader";
import { ScriptUsage } from "../../../types/firebase";

interface InitResponse {
  success: boolean;
  message?: string;
  initialized?: {
    situational: number;
    formal: number;
    qaScenario: number;
  };
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<InitResponse>
) {
  if (req.method !== "POST") {
    return res
      .status(405)
      .json({ success: false, message: "Method not allowed" });
  }

  try {
    // 1. 모든 스크립트 로드
    const allScripts = await loadAllScripts();

    // 2. 각 스크립트 타입별로 사용 상태 초기화
    const situationalUsage: ScriptUsage = {};
    const formalUsage: ScriptUsage = {};
    const qaScenarioUsage: ScriptUsage = {};

    // 모든 스크립트를 사용 가능(false) 상태로 초기화
    allScripts.situational.forEach((script) => {
      situationalUsage[script.id] = false;
    });

    allScripts.formal.forEach((script) => {
      formalUsage[script.id] = false;
    });

    allScripts.qaScenario.forEach((script) => {
      qaScenarioUsage[script.id] = false;
    });

    // 3. Firestore에 저장
    await Promise.all([
      setDoc(doc(db, "scriptUsage", "situational"), situationalUsage),
      setDoc(doc(db, "scriptUsage", "formal"), formalUsage),
      setDoc(doc(db, "scriptUsage", "qaScenario"), qaScenarioUsage),
    ]);

    return res.status(200).json({
      success: true,
      message: "스크립트 사용 상태가 성공적으로 초기화되었습니다.",
      initialized: {
        situational: allScripts.situational.length,
        formal: allScripts.formal.length,
        qaScenario: allScripts.qaScenario.length,
      },
    });
  } catch (error) {
    console.error("Error initializing script usage:", error);
    return res.status(500).json({
      success: false,
      message: `초기화 중 오류가 발생했습니다: ${
        error instanceof Error ? error.message : String(error)
      }`,
    });
  }
}

// 사용법:
// POST /api/admin/init-script-usage
// 이 API를 한 번 실행하면 정적 파일의 모든 스크립트가 DB에 사용 가능 상태로 등록됩니다.
