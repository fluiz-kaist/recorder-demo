// hooks/queries/useAdminQueries.ts - 관리자용 데이터 조회 훅
import { useQuery, UseQueryResult } from "@tanstack/react-query";
import { User, ScriptStats } from "@/types/firebase";

/**
 * 관리자 통계 데이터 타입
 */
export interface AdminStats {
  totalUsers: number;
  totalRecordings: number;
  totalCompletedScripts: number;
  averageProgress: number;
  usersByAgeGroup: { [ageGroup: string]: number };
  usersByGender: { [gender: string]: number };
  recordingsByDate: { date: string; count: number }[];
}

/**
 * 관리자 전체 통계 조회
 */
export const useAdminStatsQuery = (): UseQueryResult<AdminStats, Error> => {
  return useQuery({
    queryKey: ["adminStats"],
    queryFn: async (): Promise<AdminStats> => {
      const response = await fetch("/api/admin/stats");
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "통계 데이터를 불러올 수 없습니다.");
      }

      return data.stats as AdminStats;
    },
    staleTime: 1 * 60 * 1000, // 1분간 캐시 유지
    retry: 1,
  });
};

/**
 * 전체 사용자 목록 조회 (관리자용)
 */
export const useAllUsersQuery = (): UseQueryResult<User[], Error> => {
  return useQuery({
    queryKey: ["allUsers"],
    queryFn: async (): Promise<User[]> => {
      const response = await fetch("/api/admin/users");
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "사용자 목록을 불러올 수 없습니다.");
      }

      return data.users as User[];
    },
    staleTime: 2 * 60 * 1000, // 2분간 캐시 유지
    retry: 1,
  });
};

/**
 * 스크립트 사용 통계 조회
 */
export const useScriptStatsQuery = (): UseQueryResult<ScriptStats, Error> => {
  return useQuery({
    queryKey: ["scriptStats"],
    queryFn: async (): Promise<ScriptStats> => {
      const response = await fetch("/api/admin/script-stats");
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "스크립트 통계를 불러올 수 없습니다.");
      }

      return data.stats as ScriptStats;
    },
    staleTime: 5 * 60 * 1000, // 5분간 캐시 유지
    retry: 1,
  });
};

/**
 * 특정 사용자의 상세 정보 조회 (관리자용)
 */
export const useUserDetailQuery = (
  userId: string
): UseQueryResult<User, Error> => {
  return useQuery({
    queryKey: ["userDetail", userId],
    queryFn: async (): Promise<User> => {
      const response = await fetch(`/api/admin/users/${userId}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "사용자 정보를 불러올 수 없습니다.");
      }

      return data.user as User;
    },
    enabled: !!userId,
    staleTime: 1 * 60 * 1000, // 1분간 캐시 유지
    retry: 1,
  });
};

/**
 * 시스템 상태 조회
 */
export const useSystemStatusQuery = (): UseQueryResult<
  {
    status: string;
    version: string;
    uptime: number;
    memoryUsage: number;
  },
  Error
> => {
  return useQuery({
    queryKey: ["systemStatus"],
    queryFn: async () => {
      const response = await fetch("/api/admin/system-status");
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "시스템 상태를 불러올 수 없습니다.");
      }

      return data;
    },
    staleTime: 30 * 1000, // 30초간 캐시 유지
    refetchInterval: 60 * 1000, // 1분마다 자동 갱신
    retry: 1,
  });
};
