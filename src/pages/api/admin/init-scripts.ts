/* eslint-disable @typescript-eslint/no-explicit-any */
// pages/api/admin/init-scripts.ts
// 정적 파일의 스크립트들을 DB에 사용 가능 상태로 초기화하는 API (백업 기능 포함)

import { NextApiRequest, NextApiResponse } from "next";
import { doc, writeBatch, collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { loadAllScripts } from "../../../lib/scriptLoader";
import {
  ScriptType,
  ScriptStatus,
  Script,
  ScriptKey,
} from "../../../types/firebase";
import fs from "fs";
import path from "path";

interface InitResponse {
  success: boolean;
  message?: string;
  initialized?: {
    situational: number;
    formal: number;
    qaScenario: number;
    total: number;
  };
  backupInfo?: {
    backupPath: string;
    backupCount: number;
    timestamp: string;
  };
}

// 백업 함수
async function backupExistingScripts(): Promise<{
  backupPath: string;
  backupCount: number;
  timestamp: string;
}> {
  try {
    const scriptsCollection = collection(db, "scripts");
    const snapshot = await getDocs(scriptsCollection);

    const backupData: any[] = [];
    snapshot.forEach((doc) => {
      backupData.push({
        id: doc.id,
        ...doc.data(),
      });
    });

    // 백업 파일 이름 생성 (한국 시간 기준)
    const now = new Date();
    const koreanTime = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    const timestamp = koreanTime
      .toISOString()
      .replace(/[:.]/g, "-")
      .slice(0, 19);

    // 백업 디렉토리 확인/생성
    const backupDir = path.join(process.cwd(), "backups", "scripts");
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    // 백업 파일 저장
    const backupFileName = `scripts-backup-${timestamp}.json`;
    const backupPath = path.join(backupDir, backupFileName);

    fs.writeFileSync(
      backupPath,
      JSON.stringify(
        {
          timestamp: koreanTime.toISOString(),
          totalCount: backupData.length,
          data: backupData,
        },
        null,
        2
      )
    );

    console.log(`📦 백업 완료: ${backupPath} (${backupData.length}개 문서)`);

    return {
      backupPath: `backups/scripts/${backupFileName}`,
      backupCount: backupData.length,
      timestamp: koreanTime.toISOString(),
    };
  } catch (error) {
    console.error("❌ 백업 중 오류:", error);
    throw new Error(
      `백업 실패: ${error instanceof Error ? error.message : String(error)}`
    );
  }
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

  // 쿼리 파라미터로 백업 스킵 여부 확인
  const skipBackup = req.query.skipBackup === "true";

  try {
    let backupInfo;

    // 1. 백업 실행 (skipBackup이 true가 아닌 경우)
    if (!skipBackup) {
      console.log("📦 기존 스크립트 백업 중...");
      backupInfo = await backupExistingScripts();
    } else {
      console.log("⚠️  백업 스킵됨 (skipBackup=true)");
    }

    // 2. 모든 스크립트 로드
    console.log("📋 정적 스크립트 파일 로딩 중...");
    const allScripts = await loadAllScripts();

    // 3. Script 문서들 생성을 위한 배치 처리
    const batch = writeBatch(db);
    let totalScripts = 0;

    // 4-1. Formal 스크립트들 초기화
    allScripts.formal.forEach((script) => {
      const scriptKey: ScriptKey = `${ScriptType.FORMAL}_${script.id}`;
      const scriptRef = doc(db, "scripts", scriptKey);

      const scriptDoc: Omit<
        Script,
        "assignedAt" | "completedAt" | "recordingUrl"
      > = {
        id: script.id,
        type: ScriptType.FORMAL,
        status: ScriptStatus.UNASSGINED, // 초기 상태는 모두 미할당 상태
      };

      batch.set(scriptRef, scriptDoc);
      totalScripts++;
    });

    // 4-2. QA Scenario 스크립트들 초기화
    allScripts.qaScenario.forEach((script) => {
      const scriptKey: ScriptKey = `${ScriptType.QA_SCENARIO}_${script.id}`;
      const scriptRef = doc(db, "scripts", scriptKey);

      const scriptDoc: Omit<
        Script,
        "assignedAt" | "completedAt" | "recordingUrl"
      > = {
        id: script.id,
        type: ScriptType.QA_SCENARIO,
        status: ScriptStatus.UNASSGINED,
      };

      batch.set(scriptRef, scriptDoc);
      totalScripts++;
    });

    // 4-3. Situational 스크립트들 초기화
    allScripts.situational.forEach((script) => {
      const scriptKey: ScriptKey = `${ScriptType.SITUATIONAL}_${script.id}`;
      const scriptRef = doc(db, "scripts", scriptKey);

      const scriptDoc: Omit<
        Script,
        "assignedAt" | "completedAt" | "recordingUrl"
      > = {
        id: script.id,
        type: ScriptType.SITUATIONAL,
        status: ScriptStatus.UNASSGINED,
      };

      batch.set(scriptRef, scriptDoc);
      totalScripts++;
    });

    // 5. 배치 커밋
    console.log("🔄 Firestore 업데이트 중...");
    await batch.commit();

    const initResult = {
      formal: allScripts.formal.length,
      qaScenario: allScripts.qaScenario.length,
      situational: allScripts.situational.length,
      total: totalScripts,
    };

    console.log("✅ 스크립트 초기화 완료:", initResult);

    return res.status(200).json({
      success: true,
      message: "모든 스크립트가 성공적으로 초기화되었습니다.",
      initialized: initResult,
      backupInfo: backupInfo,
    });
  } catch (error) {
    console.error("❌ Error initializing scripts:", error);
    return res.status(500).json({
      success: false,
      message: `초기화 중 오류가 발생했습니다: ${
        error instanceof Error ? error.message : String(error)
      }`,
    });
  }
}

// 사용법:
//
// 1. 백업과 함께 초기화 (기본, 권장):
// POST /api/admin/init-scripts
//
// 2. 백업 없이 초기화 (빠른 개발용):
// POST /api/admin/init-scripts?skipBackup=true
//
// 이 API를 실행하면:
// 1. 기존 scripts 컬렉션의 모든 데이터를 JSON 파일로 백업합니다
// 2. 정적 파일의 모든 스크립트가 scripts 컬렉션에 등록됩니다
// 3. 각 스크립트는 ScriptKey (예: "formal_0", "qaScenario_1") 형태의 문서 ID를 가집니다
// 4. 초기 상태는 할당 가능(status: UNASSIGNED) 상태입니다
// 5. 실제 할당 시 assignedTo, assignedAt 필드가 추가됩니다
//
// 백업 파일 위치: /backups/scripts/scripts-backup-YYYY-MM-DDTHH-MM-SS.json
//
// 주의: 기존 데이터를 덮어씁니다. 백업이 자동으로 생성되지만 중요한 데이터는 별도로 보관하세요.

// # 백업과 함께 초기화 (권장)
// curl -X POST http://localhost:3000/api/admin/init-scripts \
//  -H "Content-Type: application/json"

// # 백업 없이 빠른 초기화 (개발용)
// curl -X POST "http://localhost:3000/api/admin/init-scripts?skipBackup=true" \
//  -H "Content-Type: application/json"

// curl -X POST http://localhost:3000/api/admin/init-scripts
