// // hooks/useProgressMode.ts
// import { useMinimalUserQuery } from "@/hooks/queries/useUserQueries";
// import { RecordingTask, ProgressMode } from "@/types/firebase";

// /**
//  * 녹음 진행 방식 관리 훅
//  * mixed: 상황발화 → 정형발화 → 상황발화 → 정형발화...
//  * separated: 상황발화 전체 → 정형발화 전체
//  */
// export const useProgressMode = () => {
//   const { minimalUserInfo, isLoading } = useMinimalUserQuery();

//   const currentSet = localUser?.participation?.sets?.find(
//     set => set.setNumber === localUser.participation.currentSetNumber
//   );

//   const progressMode = currentSet?.progressMode || localUser?.participation?.preferredMode || "mixed";

//   // 다음 수행할 작업 가져오기
//   const getNextTask = () => {
//     if (!currentSet) return null;

//     const { tasks, progress } = currentSet;
//     const allSituational = tasks.situational || [];
//     const allFormal = tasks.formal || [];

//     if (progressMode === "separated") {
//       // 분리 모드: 상황발화 먼저 다 하고, 정형발화 다 하기

//       // 1. 상황발화 중 미완료된 것 찾기
//       const incompleteSituational = allSituational.find(
//         task => task.status === "not_started" || task.status === "recording"
//       );

//       if (incompleteSituational) {
//         return {
//           task: incompleteSituational,
//           type: "situational" as const,
//           index: allSituational.indexOf(incompleteSituational),
//           phase: "situational" as const
//         };
//       }

//       // 2. 상황발화 완료되면 정형발화
//       const incompleteFormal = allFormal.find(
//         task => task.status === "not_started" || task.status === "recording"
//       );

//       if (incompleteFormal) {
//         return {
//           task: incompleteFormal,
//           type: "formal" as const,
//           index: allFormal.indexOf(incompleteFormal),
//           phase: "formal" as const
//         };
//       }

//       return null; // 모든 작업 완료
//     } else {
//       // 혼합 모드: 상황발화 → 정형발화 번갈아가며

//       const totalSituational = allSituational.length;
//       const totalFormal = allFormal.length;
//       const maxTasks = Math.max(totalSituational, totalFormal);

//       for (let i = 0; i < maxTasks; i++) {
//         // 상황발화 확인
//         if (i < totalSituational) {
//           const situationalTask = allSituational[i];
//           if (situationalTask.status === "not_started" || situationalTask.status === "recording") {
//             return {
//               task: situationalTask,
//               type: "situational" as const,
//               index: i,
//               phase: "mixed" as const
//             };
//           }
//         }

//         // 정형발화 확인
//         if (i < totalFormal) {
//           const formalTask = allFormal[i];
//           if (formalTask.status === "not_started" || formalTask.status === "recording") {
//             return {
//               task: formalTask,
//               type: "formal" as const,
//               index: i,
//               phase: "mixed" as const
//             };
//           }
//         }
//       }

//       return null; // 모든 작업 완료
//     }
//   };

//   // 진행률 계산
//   const getProgress = () => {
//     if (!currentSet) {
//       return {
//         overall: 0,
//         situational: 0,
//         formal: 0,
//         completed: { situational: 0, formal: 0, total: 0 },
//         total: { situational: 0, formal: 0, total: 0 }
//       };
//     }

//     const { tasks, progress } = currentSet;

//     return {
//       overall: Math.round((progress.completedTasks / progress.totalTasks) * 100),
//       situational: Math.round((progress.situational.completed / progress.situational.total) * 100),
//       formal: Math.round((progress.formal.completed / progress.formal.total) * 100),
//       completed: {
//         situational: progress.situational.completed,
//         formal: progress.formal.completed,
//         total: progress.completedTasks
//       },
//       total: {
//         situational: progress.situational.total,
//         formal: progress.formal.total,
//         total: progress.totalTasks
//       }
//     };
//   };

//   // 특정 타입의 남은 작업 수
//   const getRemainingTasks = (type?: "situational" | "formal") => {
//     if (!currentSet) return 0;

//     if (type === "situational") {
//       return currentSet.progress.situational.total - currentSet.progress.situational.completed;
//     } else if (type === "formal") {
//       return currentSet.progress.formal.total - currentSet.progress.formal.completed;
//     } else {
//       return currentSet.progress.totalTasks - currentSet.progress.completedTasks;
//     }
//   };

//   // 진행 방식 설명
//   const getModeDescription = () => {
//     if (progressMode === "mixed") {
//       return "상황별 말하기와 문장 읽기를 번갈아가며 진행합니다.";
//     } else {
//       return "상황별 말하기를 모두 완료한 후, 문장 읽기를 진행합니다.";
//     }
//   };

//   // 현재 단계 설명
//   const getCurrentPhaseDescription = () => {
//     const nextTask = getNextTask();

//     if (!nextTask) {
//       return "모든 녹음을 완료했습니다!";
//     }

//     if (progressMode === "separated") {
//       const remainingSituational = getRemainingTasks("situational");
//       const remainingFormal = getRemainingTasks("formal");

//       if (remainingSituational > 0) {
//         return `상황별 말하기 진행 중 (${remainingSituational}개 남음)`;
//       } else if (remainingFormal > 0) {
//         return `문장 읽기 진행 중 (${remainingFormal}개 남음)`;
//       }
//     } else {
//       const overall = getRemainingTasks();
//       return `번갈아가며 진행 중 (${overall}개 남음)`;
//     }

//     return "";
//   };

//   return {
//     isLoading,

//     // 현재 설정
//     progressMode,
//     currentSet,

//     // 다음 작업
//     nextTask: getNextTask(),

//     // 진행 상태
//     progress: getProgress(),

//     // 유틸리티
//     getRemainingTasks,
//     getModeDescription,
//     getCurrentPhaseDescription,

//     // 상태 체크
//     canStartRecording: !!getNextTask(),
//     isAllCompleted: !getNextTask(),

//     // 진행 방식별 로직
//     isInSituationalPhase: () => {
//       if (progressMode === "mixed") return true;
//       return getRemainingTasks("situational") > 0;
//     },

//     isInFormalPhase: () => {
//       if (progressMode === "mixed") return true;
//       return getRemainingTasks("situational") === 0 && getRemainingTasks("formal") > 0;
//     }
//   };
// };
