// types/firebase.ts
export interface SituationalScript {
  id: string;
  category: string;
  intent: string;
  title: string;
  description: string;
}

export interface FormalScript {
  id: string;
  category: string;
  type: "command" | "request";
  content: string;
  difficulty?: "easy" | "medium" | "hard";
}

export interface QAScenarioScript {
  id: string;
  title: string;
  scenario: string;
  questions: string[];
  expectedDuration: number; // 분 단위
}

export interface ScriptUsage {
  [scriptId: string]: boolean; // true: 사용됨, false: 사용 가능
}

export interface UserData {
  id: string;
  createdAt: Date;
  lastAccess: Date;
  assignedScripts: {
    situational: string[]; // 8개
    formal: string[]; // 8개
    qaScenario: string[]; // 1개
  };
  completedScripts: {
    situational: string[];
    formal: string[];
    qaScenario: string[];
  };
  totalAssigned: number;
  totalCompleted: number;
}

export interface UserProgress {
  scriptId: string;
  scriptType: "situational" | "formal" | "qaScenario";
  status: "assigned" | "recording" | "completed";
  assignedAt: Date;
  recordedAt?: Date;
  sttText?: string;
  audioUrl?: string;
}

export interface AssignScriptsRequest {
  userId: string;
}

export interface AssignScriptsResponse {
  success: boolean;
  scripts: {
    situational: SituationalScript[];
    formal: FormalScript[];
    qaScenario: QAScenarioScript[];
  };
  message?: string;
}

export interface CompleteScriptRequest {
  userId: string;
  scriptId: string;
  scriptType: "situational" | "formal" | "qaScenario";
  audioUrl: string;
  sttText: string;
}

export interface ScriptStats {
  situational: {
    total: number;
    available: number;
    used: number;
  };
  formal: {
    total: number;
    available: number;
    used: number;
  };
  qaScenario: {
    total: number;
    available: number;
    used: number;
  };
}
