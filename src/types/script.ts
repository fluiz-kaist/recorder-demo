export interface Script {
  id: string;
  type: string;
  content: string;
  isActive: boolean;
  assignedCount: number;
  createdAt: Date;
}

export interface ScriptContent {
  scriptId: string;
  content: string;
  type: string;
}
