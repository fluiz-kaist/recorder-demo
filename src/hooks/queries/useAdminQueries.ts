// // hooks/queries/useAdminQueries.ts
// import { useQuery, UseQueryResult } from "@tanstack/react-query";
// import { useState, useEffect } from "react";
// import { User} from "@/types/firebase";

// interface AdminData {
//   name: string;
// }

// /**
//  * 관리자 통계 데이터 타입
//  */
// export interface AdminStats {
//   totalUsers: number;
//   totalRecordings: number;
//   totalCompletedScripts: number;
//   averageProgress: number;
//   usersByAgeGroup: { [ageGroup: string]: number };
//   usersByGender: { [gender: string]: number };
//   recordingsByDate: { date: string; count: number }[];
// }

// // 관리자 권한 확인 훅
// export const useIsAdmin = () => {
//   const [isAdmin, setIsAdmin] = useState<boolean>(false);
//   const [adminData, setAdminData] = useState<AdminData | null>(null);
//   const [isLoading, setIsLoading] = useState(true);

//   useEffect(() => {
//     const checkAdminStatus = async () => {
//       try {
//         const response = await fetch("/api/auth/checkAdmin", {
//           method: "GET",
//           credentials: "include",
//         });

//         if (response.ok) {
//           const data = await response.json();
//           setIsAdmin(true);
//           setAdminData(data.admin);
//         } else {
//           setIsAdmin(false);
//           setAdminData(null);
//         }
//       } catch (error) {
//         console.error("관리자 권한 확인 중 오류:", error);
//         setIsAdmin(false);
//         setAdminData(null);
//       } finally {
//         setIsLoading(false);
//       }
//     };

//     checkAdminStatus();
//   }, []);

//   return { isAdmin, adminData, isLoading };
// };

// // 관리자 권한 쿼리 훅
// export const useAdminAuth = () => {
//   return useQuery({
//     queryKey: ["adminAuth"],
//     queryFn: async () => {
//       const response = await fetch("/api/auth/checkAdmin", {
//         method: "GET",
//         credentials: "include",
//       });

//       if (!response.ok) {
//         throw new Error("관리자 권한이 없습니다.");
//       }

//       return response.json();
//     },
//     retry: false,
//     staleTime: 1000 * 60 * 5, // 5분간 캐시
//   });
// };

// // 특정 권한 확인 훅 (간단한 관리자 확인으로 변경)
// export const useAdminPermission = () => {
//   const { adminData } = useIsAdmin();

//   // name이 있으면 모든 권한이 있다고 가정
//   return !!adminData?.name;
// };

// /**
//  * 관리자 전체 통계 조회
//  */
// export const useAdminStatsQuery = (): UseQueryResult<AdminStats, Error> => {
//   return useQuery({
//     queryKey: ["adminStats"],
//     queryFn: async (): Promise<AdminStats> => {
//       const response = await fetch("/api/admin/stats");
//       const data = await response.json();

//       if (!response.ok) {
//         throw new Error(data.message || "통계 데이터를 불러올 수 없습니다.");
//       }

//       return data.stats as AdminStats;
//     },
//     staleTime: 1 * 60 * 1000, // 1분간 캐시 유지
//     retry: 1,
//   });
// };

// /**
//  * 전체 사용자 목록 조회 (관리자용)
//  */
// export const useAllUsersQuery = (params?: {
//   page?: number;
//   limit?: number;
//   sortBy?: string;
//   sortOrder?: string;
//   ageGroup?: string;
//   gender?: string;
//   hasAssignments?: string;
// }): UseQueryResult<{ users: User[]; totalCount: number }, Error> => {
//   const queryParams = new URLSearchParams();
//   if (params?.page) queryParams.append("page", params.page.toString());
//   if (params?.limit) queryParams.append("limit", params.limit.toString());
//   if (params?.sortBy) queryParams.append("sortBy", params.sortBy);
//   if (params?.sortOrder) queryParams.append("sortOrder", params.sortOrder);
//   if (params?.ageGroup) queryParams.append("ageGroup", params.ageGroup);
//   if (params?.gender) queryParams.append("gender", params.gender);
//   if (params?.hasAssignments)
//     queryParams.append("hasAssignments", params.hasAssignments);

//   return useQuery({
//     queryKey: ["allUsers", params],
//     queryFn: async () => {
//       const response = await fetch(
//         `/api/admin/users?${queryParams.toString()}`
//       );
//       const data = await response.json();

//       if (!response.ok) {
//         throw new Error(data.message || "사용자 목록을 불러올 수 없습니다.");
//       }

//       return {
//         users: data.users as User[],
//         totalCount: data.totalCount as number,
//       };
//     },
//     staleTime: 2 * 60 * 1000, // 2분간 캐시 유지
//     retry: 1,
//   });
// };

// /**
//  * 특정 사용자의 상세 정보 조회 (관리자용)
//  */
// export const useUserDetailQuery = (
//   userId: string
// ): UseQueryResult<User, Error> => {
//   return useQuery({
//     queryKey: ["userDetail", userId],
//     queryFn: async (): Promise<User> => {
//       const response = await fetch(`/api/admin/users/${userId}`);
//       const data = await response.json();

//       if (!response.ok) {
//         throw new Error(data.message || "사용자 정보를 불러올 수 없습니다.");
//       }

//       return data.user as User;
//     },
//     enabled: !!userId,
//     staleTime: 1 * 60 * 1000, // 1분간 캐시 유지
//     retry: 1,
//   });
// };

// // hooks/mutations/useAdminMutations.ts
// import { useMutation, useQueryClient } from "@tanstack/react-query";
// import { useRouter } from "next/router";

// interface AdminLoginData {
//   name: string;
//   password: string;
// }

// // 관리자 로그인 뮤테이션
// export const useAdminLoginMutation = () => {
//   const router = useRouter();
//   const queryClient = useQueryClient();

//   return useMutation({
//     mutationFn: async (loginData: AdminLoginData) => {
//       const response = await fetch("/api/auth/verifyAdmin", {
//         method: "POST",
//         headers: {
//           "Content-Type": "application/json",
//         },
//         body: JSON.stringify(loginData),
//         credentials: "include",
//       });

//       if (!response.ok) {
//         const error = await response.json();
//         throw new Error(error.message || "관리자 로그인 실패");
//       }

//       return response.json();
//     },
//     onSuccess: () => {
//       // 관리자 인증 성공 시 캐시 무효화
//       queryClient.invalidateQueries({ queryKey: ["adminAuth"] });

//       // 관리자 대시보드로 리다이렉트
//       router.push("/admin/dashboard");
//     },
//     onError: (error) => {
//       console.error("관리자 로그인 실패:", error);
//     },
//   });
// };

// // 관리자 로그아웃 뮤테이션
// export const useAdminLogoutMutation = () => {
//   const router = useRouter();
//   const queryClient = useQueryClient();

//   return useMutation({
//     mutationFn: async () => {
//       const response = await fetch("/api/auth/logoutAdmin", {
//         method: "POST",
//         credentials: "include",
//       });

//       if (!response.ok) {
//         throw new Error("로그아웃 실패");
//       }

//       return response.json();
//     },
//     onSuccess: () => {
//       // 관리자 캐시 클리어
//       queryClient.removeQueries({ queryKey: ["adminAuth"] });

//       // 로그인 페이지로 리다이렉트
//       router.push("/admin/login");
//     },
//     onError: (error) => {
//       console.error("관리자 로그아웃 실패:", error);
//       // 실패해도 로그인 페이지로 이동
//       router.push("/admin/login");
//     },
//   });
// };

// // 사용자 삭제 뮤테이션
// export const useDeleteUserMutation = () => {
//   const queryClient = useQueryClient();

//   return useMutation({
//     mutationFn: async (userId: string) => {
//       const response = await fetch(`/api/admin/users/${userId}`, {
//         method: "DELETE",
//         credentials: "include",
//       });

//       if (!response.ok) {
//         const error = await response.json();
//         throw new Error(error.message || "사용자 삭제에 실패했습니다.");
//       }

//       return response.json();
//     },
//     onSuccess: () => {
//       // 사용자 목록과 통계 캐시 무효화
//       queryClient.invalidateQueries({ queryKey: ["allUsers"] });
//       queryClient.invalidateQueries({ queryKey: ["adminStats"] });
//     },
//     onError: (error) => {
//       console.error("사용자 삭제 실패:", error);
//     },
//   });
// };
