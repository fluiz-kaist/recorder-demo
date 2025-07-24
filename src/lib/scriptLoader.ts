// lib/scriptLoader.ts
import { SituationalScript, FormalScript } from "@/types/firebase";
import fs from "fs";
import path from "path";

// 서버 메모리 캐시
let situationalScriptsCache: SituationalScript[] | null = null;
let formalScriptsCache: FormalScript[] | null = null;

function getDataFilePath(filename: string): string {
  // 여러 가능한 경로를 시도
  const possiblePaths = [
    path.join(process.cwd(), "public", "data", filename),
    path.join(__dirname, "..", "..", "public", "data", filename),
    path.join(process.cwd(), "data", filename), // Vercel에서 때때로 다른 경로
  ];

  for (const filePath of possiblePaths) {
    if (fs.existsSync(filePath)) {
      return filePath;
    }
  }

  throw new Error(
    `Data file not found: ${filename}. Tried paths: ${possiblePaths.join(", ")}`
  );
}
export async function loadSituationalScripts(): Promise<SituationalScript[]> {
  if (situationalScriptsCache) {
    return situationalScriptsCache;
  }

  try {
    const filePath = getDataFilePath("situationalScripts.json");
    const fileContent = fs.readFileSync(filePath, "utf8");
    const parsedData = JSON.parse(fileContent) as SituationalScript[];
    situationalScriptsCache = parsedData;
    console.log(
      `✅ Loaded ${parsedData.length} situational scripts from: ${filePath}`
    );
    return parsedData; // 캐시 변수 대신 파싱된 데이터 직접 반환
  } catch (error) {
    console.error("❌ Error loading situational scripts:", error);
    throw new Error("Failed to load situational scripts");
  }
}

export async function loadFormalScripts(): Promise<FormalScript[]> {
  if (formalScriptsCache) {
    return formalScriptsCache;
  }

  try {
    const filePath = getDataFilePath("formalScripts.json");
    const fileContent = fs.readFileSync(filePath, "utf8");
    const parsedData = JSON.parse(fileContent) as FormalScript[];
    formalScriptsCache = parsedData;
    console.log(
      `✅ Loaded ${parsedData.length} formal scripts from: ${filePath}`
    );
    return parsedData;
  } catch (error) {
    console.error("❌ Error loading formal scripts:", error);
    throw new Error("Failed to load formal scripts");
  }
}

export async function loadAllScripts() {
  const [situational, formal, qaScenario] = await Promise.all([
    loadSituationalScripts(),
    loadFormalScripts(),
  ]);

  return {
    situational,
    formal,
    qaScenario,
  };
}

// 랜덤 선택 유틸리티
export function getRandomItems<T>(items: T[], count: number): T[] {
  const shuffled = [...items].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}

// 스크립트 ID로 특정 스크립트 찾기
export function findScriptById(
  scripts: (SituationalScript | FormalScript)[],
  id: number
) {
  return scripts.find((script) => script.id === id);
}
