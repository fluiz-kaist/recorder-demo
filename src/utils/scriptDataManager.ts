//utils/scriptDataManager.ts - 스크립트 데이터 전담

import { SituationalScript, FormalScript } from "@/types/firebase";
import { getKoreanTimeISO } from "@/utils/time";
interface LocalScriptData {
  version: string;
  loadedAt: string;
  userId: string;
  setNumber: number;
  setId: number; // formalSetId → setId (이제 상황발화 세트 ID)

  // API에서 받은 스크립트 데이터
  situationalScripts: SituationalScript[];
  formalScripts: FormalScript[];

  // 간단한 인덱스만 유지
  indexes: {
    situationalByTaskKey: Record<string, SituationalScript>;
    formalByTaskKey: Record<string, FormalScript>;
    // 서비스별 태스크 키 목록
    taskKeysByService: Record<string, string[]>;
    // 서비스별 통계
    serviceStats: Record<
      string,
      {
        situationalCount: number;
        formalCount: number;
        totalCount: number;
      }
    >;
  };
}

// localStorage 관리 유틸리티 (스크립트 데이터만)
export class ScriptDataManager {
  private static readonly STORAGE_KEY = "voice-recording-scripts";

  // API에서 받은 데이터 저장
  static saveScriptData(
    userId: string,
    roundNumber: number, // setNumber → roundNumber (의미 명확화)
    setId: number, // formalSetId → setId (이제 상황발화 세트 ID)
    scripts: {
      situational: SituationalScript[];
      formal: FormalScript[];
    }
  ): void {
    if (typeof window === "undefined") return; // SSR 체크
    const now = getKoreanTimeISO();
    const scriptData: LocalScriptData = {
      version: "1.0",
      loadedAt: now,
      userId,
      setNumber: roundNumber, // 내부적으로는 기존 필드명 유지
      setId: setId, // 새로운 구조에서는 상황발화 세트 ID
      situationalScripts: scripts.situational,
      formalScripts: scripts.formal,
      indexes: this.createSimpleIndexes(scripts.situational, scripts.formal),
    };

    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(scriptData));
  }

  // 간단한 인덱스 생성
  private static createSimpleIndexes(
    situational: SituationalScript[],
    formal: FormalScript[]
  ) {
    const situationalByTaskKey: Record<string, SituationalScript> = {};
    const formalByTaskKey: Record<string, FormalScript> = {};
    const taskKeysByService: Record<string, string[]> = {};
    const serviceStats: Record<
      string,
      {
        situationalCount: number;
        formalCount: number;
        totalCount: number;
      }
    > = {};

    // 상황발화 인덱싱
    situational.forEach((script) => {
      situationalByTaskKey[script.task_key] = script;

      // 서비스별 태스크 키 목록 생성
      if (!taskKeysByService[script.service_name]) {
        taskKeysByService[script.service_name] = [];
      }
      taskKeysByService[script.service_name].push(script.task_key);

      // 서비스별 통계 생성
      if (!serviceStats[script.service_name]) {
        serviceStats[script.service_name] = {
          situationalCount: 0,
          formalCount: 0,
          totalCount: 0,
        };
      }
      serviceStats[script.service_name].situationalCount++;
    });

    // 정형발화 인덱싱
    formal.forEach((script) => {
      formalByTaskKey[script.task_key] = script;

      // 서비스별 태스크 키 목록에 추가
      if (!taskKeysByService[script.service_name]) {
        taskKeysByService[script.service_name] = [];
      }
      if (!taskKeysByService[script.service_name].includes(script.task_key)) {
        taskKeysByService[script.service_name].push(script.task_key);
      }

      // 서비스별 통계 업데이트
      if (!serviceStats[script.service_name]) {
        serviceStats[script.service_name] = {
          situationalCount: 0,
          formalCount: 0,
          totalCount: 0,
        };
      }
      serviceStats[script.service_name].formalCount++;
    });

    // 전체 카운트 계산
    Object.values(serviceStats).forEach((stat) => {
      stat.totalCount = stat.situationalCount + stat.formalCount;
    });

    return {
      situationalByTaskKey,
      formalByTaskKey,
      taskKeysByService,
      serviceStats,
    };
  }

  // localStorage에서 스크립트 데이터 조회
  static getScriptData(): LocalScriptData | null {
    console.log("콜?");
    if (typeof window === "undefined") return null; // SSR 체크
    try {
      const data = localStorage.getItem(this.STORAGE_KEY);
      console.log("🧧🧧지금 여기 데이터?", data);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error("스크립트 데이터 조회 실패:", error);
      return null;
    }
  }

  // 특정 서비스의 태스크 키들 조회
  static getTaskKeysByService(serviceName: string): string[] {
    if (typeof window === "undefined") return []; // SSR 체크

    const data = this.getScriptData();
    return data?.indexes.taskKeysByService[serviceName] || [];
  }

  // 특정 태스크의 스크립트 조회
  static getScriptByTaskKey(taskKey: string, type: "situational" | "formal") {
    if (typeof window === "undefined") return null; // SSR 체크

    const data = this.getScriptData();
    if (!data) return null;

    if (type === "situational") {
      return data.indexes.situationalByTaskKey[taskKey] || null;
    } else {
      return data.indexes.formalByTaskKey[taskKey] || null;
    }
  }

  // 서비스별 총 태스크 수 조회
  static getServiceStats(serviceName: string) {
    if (typeof window === "undefined") return null; // SSR 체크

    const data = this.getScriptData();
    return data?.indexes.serviceStats[serviceName] || null;
  }

  // 모든 서비스 목록 조회
  static getAllServices(): string[] {
    if (typeof window === "undefined") return []; // SSR 체크

    const data = this.getScriptData();
    return data ? Object.keys(data.indexes.taskKeysByService) : [];
  }

  // 전체 스크립트 통계 조회
  static getTotalStats() {
    if (typeof window === "undefined") return null; // SSR 체크

    const data = this.getScriptData();
    if (!data) return null;

    return {
      totalSituational: data.situationalScripts.length,
      totalFormal: data.formalScripts.length,
      totalScripts: data.situationalScripts.length + data.formalScripts.length,
      setNumber: data.setNumber,
      setId: data.setId,
      loadedAt: data.loadedAt,
    };
  }

  // 데이터 초기화
  static clearData(): void {
    if (typeof window === "undefined") return; // SSR 체크
    localStorage.removeItem(this.STORAGE_KEY);
  }
}
