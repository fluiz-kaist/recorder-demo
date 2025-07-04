// export interface User {
//     id: string;
//     ageGroup: string;
//     gender: string;
//     hasConsented: boolean;
//     createdAt: Date;
//     lastAccessAt: Date;
//     assignedScripts: AssignedScript[];
//     sessionProgress: SessionProgress;
//   }
  
//   export interface AssignedScript {
//     scriptId: string;
//     assignedAt: Date;
//     status: 'assigned' | 'completed';
//     completedAt?: Date;
//     scriptType: string;
//   }
  
//   export interface SessionProgress {
//     currentScriptIndex: number;
//     totalScripts: number;
//     lastAccessedAt: Date;
//   }