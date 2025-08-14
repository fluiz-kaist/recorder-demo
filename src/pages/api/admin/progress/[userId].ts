// // pages/api/admin/progress/[userId].ts - Admin SDK로 변경
// import { NextApiRequest, NextApiResponse } from "next";
// import { getDocByIdAdmin } from "@/lib/firebase/firestoreAdmin"; // Admin SDK 추가
// import { Timestamp } from "firebase-admin/firestore"; // Admin SDK로 변경
// import { User, ParticipationRound } from "@/types/user";
// import { getDisplaySetId } from "@/utils/converter";
// interface UserProgressDetail {
//   userId: string;
//   userName?: string;
//   // basicInfo: UserProfile;
//   basicInfo: {
//     userId: string;
//     userName: string;
//     authorizedUserId: string;
//     gender: "남성" | "여성";
//     ageGroup: string;
//     hasConsented: boolean;
//     consentedAt?: string; // undefined 허용
//     createdAt: string; // 필수값

//     lastAccessAt?: string; // undefined 허용
//     // Client SDK는 중첩 객체에서 serverTimestamp 사용 가능, Admin SDK에서만 문자열 변환 필요
//   };

//   // 전체 진행 상황
//   overallProgress: {
//     percentage: number;
//     totalTasks: number;
//     completedTasks: number;
//     remainingTasks: number;
//   };

//   // 회차별 상세 진행
//   roundDetails: Array<{
//     roundNumber: number;
//     formalSetId: number;
//     status: string;
//     assignedAt?: string; // string으로 변경
//     completedAt?: string; // string으로 변경
//     approvedAt?: string; // string으로 변경

//     progress: {
//       totalTasks: number;
//       completedTasks: number;
//       submittedTasks: number;
//       approvedTasks: number;
//     };

//     taskBreakdown: {
//       situational: {
//         total: number;
//         completed: number;
//         submitted: number;
//         approved: number;
//         remaining: number;
//         tasks: Array<{
//           taskKey: string;
//           status: string;
//           completedAt?: string; // string으로 변경
//           submittedAt?: string; // string으로 변경
//           approvedAt?: string; // string으로 변경
//         }>;
//       };
//       formal: {
//         total: number;
//         completed: number;
//         submitted: number;
//         approved: number;
//         remaining: number;
//         tasks: Array<{
//           taskKey: string;
//           status: string;
//           completedAt?: string; // string으로 변경
//           submittedAt?: string; // string으로 변경
//           approvedAt?: string; // string으로 변경
//         }>;
//       };
//     };
//   }>;

//   // 녹음 품질 정보
//   qualityInfo: {
//     averageScore: number;
//     totalRecordings: number;
//     approvedRecordings: number;
//     recentRecordings: Array<{
//       taskKey: string;
//       taskType: string;
//       recordedAt: string;
//       qualityScore: number;
//       status: string;
//     }>;
//   };

//   // 활동 패턴
//   activityPattern: {
//     firstRecordingAt?: string; // string으로 변경
//     lastRecordingAt?: string; // string으로 변경
//     averageSessionLength?: number;
//     mostActiveTimeOfDay?: string;
//     totalSessions: number;
//   };
// }

// interface UserProgressDetailResponse {
//   success: boolean;
//   data?: UserProgressDetail;
//   message?: string;
// }

// export default async function handler(
//   req: NextApiRequest,
//   res: NextApiResponse<UserProgressDetailResponse>
// ) {
//   if (req.method !== "GET") {
//     return res.status(405).json({
//       success: false,
//       message: "Method not allowed",
//     });
//   }

//   try {
//     // 관리자 권한 확인
//     const adminToken = req.cookies["admin-token"];
//     if (!adminToken) {
//       return res.status(401).json({
//         success: false,
//         message: "관리자 권한이 필요합니다.",
//       });
//     }

//     // 현재 시간을 한 번만 생성 (API 호출 시점의 통일된 시간)
//     const currentTime = new Date().toISOString();

//     const userCollectionName =
//       process.env.NEXT_PUBLIC_DB_USER_COLLECTION || "users-temp";

//     const { userId } = req.query;

//     if (!userId || typeof userId !== "string") {
//       return res.status(400).json({
//         success: false,
//         message: "유효한 사용자 ID가 필요합니다.",
//       });
//     }

//     // 사용자 정보 조회
//     const userData = (await getDocByIdAdmin(
//       userCollectionName,
//       userId
//     )) as User; // 타입 캐스팅 추가

//     if (!userData) {
//       return res.status(404).json({
//         success: false,
//         message: "사용자를 찾을 수 없습니다.",
//       });
//     }

//     // 필수 필드 존재 여부 확인 추가
//     if (!userData.profile || !userData.statistics || !userData.currentStatus) {
//       return res.status(500).json({
//         success: false,
//         message: "사용자 데이터 구조가 올바르지 않습니다.",
//       });
//     }

//     // 전체 진행률 계산 - statistics.current에서 가져오기
//     const totalTasksCompleted = userData.statistics.current.completedTasks || 0;
//     const totalTasksApproved = userData.statistics.current.approvedTasks || 0;
//     // 현재 진행 중인 회차가 있다면 해당 회차의 진행률도 포함
//     const currentRoundProgress = userData.currentStatus.currentRoundProgress;
//     const currentRoundTotalEstimate =
//       userData.currentStatus.currentRoundNumber > 0
//         ? userData.statistics.current.totalTasks
//         : 0;

//     const totalTasks = userData.statistics.current.totalTasks || 0;
//     const completedTasks = totalTasksCompleted;
//     const approvedTasks = totalTasksApproved;

//     const overallPercentage =
//       totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

//     // 회차별 상세 정보 - roundSummaries에서 기본 정보 + 서브컬렉션에서 상세 정보
//     const roundDetails = [];

//     for (const roundSummary of userData.roundSummaries || []) {
//       try {
//         // 각 회차의 상세 정보를 서브컬렉션에서 조회
//         const roundData = (await getDocByIdAdmin(
//           `${userCollectionName}/${userId}/rounds`,
//           roundSummary.roundNumber.toString()
//         )) as ParticipationRound;

//         if (roundData) {
//           roundDetails.push({
//             roundNumber: roundSummary.roundNumber,
//             formalSetId: roundSummary.formalSetId,
//             setId: getDisplaySetId(roundSummary),
//             status: roundSummary.status,
//             // 간단하게 현재 시간 사용 (실제 값이 있으면 그대로, 없으면 현재 시간)
//             assignedAt: roundSummary.assignedAt
//               ? String(roundSummary.assignedAt)
//               : currentTime,
//             completedAt: roundSummary.completedAt
//               ? String(roundSummary.completedAt)
//               : undefined,
//             approvedAt: roundSummary.approvedAt
//               ? String(roundSummary.approvedAt)
//               : undefined,

//             progress: {
//               totalTasks: roundData.progress.totalTasks,
//               completedTasks: roundData.progress.completedTasks,
//               submittedTasks: roundData.progress.submittedTasks,
//               approvedTasks: roundData.progress.approvedTasks,
//             },

//             taskBreakdown: {
//               situational: {
//                 total: roundData.progress.byTaskType.situational.total,
//                 completed: roundData.progress.byTaskType.situational.completed,
//                 submitted: roundData.progress.byTaskType.situational.submitted,
//                 approved: roundData.progress.byTaskType.situational.approved,
//                 remaining:
//                   roundData.progress.byTaskType.situational.total -
//                   roundData.progress.byTaskType.situational.completed,
//                 // 작업 배열도 간단하게 현재 시간 사용
//                 tasks: roundData.tasks.situational.map((task: any) => ({
//                   taskKey: task.taskKey,
//                   status: task.status,
//                   completedAt: task.completedAt
//                     ? String(task.completedAt)
//                     : undefined,
//                   submittedAt: task.submittedAt
//                     ? String(task.submittedAt)
//                     : undefined,
//                   approvedAt: task.approvedAt
//                     ? String(task.approvedAt)
//                     : undefined,
//                 })),
//               },
//               formal: {
//                 total: roundData.progress.byTaskType.formal.total,
//                 completed: roundData.progress.byTaskType.formal.completed,
//                 submitted: roundData.progress.byTaskType.formal.submitted,
//                 approved: roundData.progress.byTaskType.formal.approved,
//                 remaining:
//                   roundData.progress.byTaskType.formal.total -
//                   roundData.progress.byTaskType.formal.completed,
//                 tasks: roundData.tasks.formal.map((task: any) => ({
//                   taskKey: task.taskKey,
//                   status: task.status,
//                   completedAt: task.completedAt || "undefined",
//                   submittedAt: task.submittedAt || "undefined",
//                   approvedAt: task.approvedAt || "undefined",
//                 })),
//               },
//             },
//           });
//         }
//       } catch (error) {
//         console.error(`회차 ${roundSummary.roundNumber} 조회 실패:`, error);
//         // 개별 회차 조회 실패 시에도 전체 응답은 계속 진행
//       }
//     }
//     // 녹음 품질 정보 (간단 버전)
//     // 녹음 품질 정보 (현재 회차 기준)
//     const qualityInfo = {
//       averageScore: 0, // current에는 품질 점수가 없으므로 0으로 설정 또는 별도 계산 필요
//       totalRecordings: userData.statistics.current.completedTasks || 0,
//       approvedRecordings: userData.statistics.current.approvedTasks || 0,
//       recentRecordings: [], // TODO: 최근 녹음 정보는 별도 쿼리나 roundDetails에서 추출 필요
//     };
//     // 활동 패턴 - statistics에서 가져오기
//     const activityPattern = {
//       firstRecordingAt: undefined, // current에는 첫 참여 시점이 없으므로 undefined
//       lastRecordingAt: userData.statistics.current.lastUpdatedAt
//         ? String(userData.statistics.current.lastUpdatedAt)
//         : undefined,
//       averageSessionLength: undefined, // current에는 평균 세션 길이가 없음
//       mostActiveTimeOfDay: "undefined", // TODO: 별도 분석 필요하면 구현
//       totalSessions: 1, // 현재 회차이므로 1로 설정
//     };
//     const userProgressDetail: UserProgressDetail = {
//       userId: userData.profile.userId,
//       userName: userData.profile.userName,
//       basicInfo: {
//         userId: userData.profile.userId,
//         userName: userData.profile.userName,
//         authorizedUserId: userData.profile.authorizedUserId,
//         gender: userData.profile.gender,
//         ageGroup: userData.profile.ageGroup,
//         hasConsented: userData.profile.hasConsented,
//         consentedAt: userData.profile.consentedAt
//           ? String(userData.profile.consentedAt)
//           : undefined,
//         createdAt: userData.profile.createdAt
//           ? String(userData.profile.createdAt)
//           : currentTime,
//         lastAccessAt: userData.profile.lastAccessAt
//           ? String(userData.profile.lastAccessAt)
//           : undefined,
//       },
//       overallProgress: {
//         percentage: overallPercentage,
//         totalTasks,
//         completedTasks,
//         remainingTasks: totalTasks - completedTasks,
//       },
//       roundDetails,
//       qualityInfo,
//       activityPattern,
//     };

//     return res.status(200).json({
//       success: true,
//       data: userProgressDetail,
//     });
//   } catch (error) {
//     console.error("사용자 진행 상황 조회 오류:", error);
//     return res.status(500).json({
//       success: false,
//       message: "서버 오류가 발생했습니다.",
//     });
//   }
// }
