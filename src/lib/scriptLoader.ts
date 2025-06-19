// lib/scriptLoader.ts
import { SituationalScript, FormalScript, QAScenarioScript } from "@/types/firebase"
import fs from 'fs';
import path from 'path';

// 서버 메모리 캐시
let situationalScriptsCache: SituationalScript[] | null = null;
let formalScriptsCache: FormalScript[] | null = null;
let qaScenarioScriptsCache: QAScenarioScript[] | null = null;

export async function loadSituationalScripts(): Promise<SituationalScript[]> {
  if (situationalScriptsCache) {
    return situationalScriptsCache;
  }

  try {
    const filePath = path.join(process.cwd(), 'public', 'data', 'situationalScripts.json');
    const fileContent = fs.readFileSync(filePath, 'utf8');
    situationalScriptsCache = JSON.parse(fileContent);
    return situationalScriptsCache!;
  } catch (error) {
    console.error('Error loading situational scripts:', error);
    throw new Error('Failed to load situational scripts');
  }
}

export async function loadFormalScripts(): Promise<FormalScript[]> {
  if (formalScriptsCache) {
    return formalScriptsCache;
  }

  try {
    const filePath = path.join(process.cwd(), 'public', 'data', 'formalScripts.json');
    const fileContent = fs.readFileSync(filePath, 'utf8');
    formalScriptsCache = JSON.parse(fileContent);
    return formalScriptsCache!;
  } catch (error) {
    console.error('Error loading formal scripts:', error);
    throw new Error('Failed to load formal scripts');
  }
}

export async function loadQAScenarioScripts(): Promise<QAScenarioScript[]> {
  if (qaScenarioScriptsCache) {
    return qaScenarioScriptsCache;
  }

  try {
    const filePath = path.join(process.cwd(), 'public', 'data', 'qaScenarioScripts.json');
    const fileContent = fs.readFileSync(filePath, 'utf8');
    qaScenarioScriptsCache = JSON.parse(fileContent);
    return qaScenarioScriptsCache!;
  } catch (error) {
    console.error('Error loading QA scenario scripts:', error);
    throw new Error('Failed to load QA scenario scripts');
  }
}

export async function loadAllScripts() {
  const [situational, formal, qaScenario] = await Promise.all([
    loadSituationalScripts(),
    loadFormalScripts(),
    loadQAScenarioScripts()
  ]);

  return {
    situational,
    formal,
    qaScenario
  };
}

// 랜덤 선택 유틸리티
export function getRandomItems<T>(items: T[], count: number): T[] {
  const shuffled = [...items].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}

// 스크립트 ID로 특정 스크립트 찾기
export function findScriptById(
  scripts: (SituationalScript | FormalScript | QAScenarioScript)[],
  id: string
) {
  return scripts.find(script => script.id === id);
}