// hooks/queries/useAdminQueries.ts
import { useQuery, UseQueryResult } from "@tanstack/react-query";
import { ParticipantOverview } from "@/pages/api/admin/participants/overview";
import { ParticipantDetail } from "@/pages/api/admin/participants/[userId]";
import { ProgressOverview } from "@/pages/api/admin/progress/overview";
import { useState, useEffect } from "react";
import { AudioRecording } from "@/types/audio";

// ===== 타입 정의 =====

interface ParticipantsOverviewData {
  participants: ParticipantOverview[];
  totalCount: number;
  pagination: {
    currentPage: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
  statistics: {
    // 신규
    totalApplicants: number; // 참가 신청자 (화이트리스트)
    totalRegisteredUsers: number; // 가입 완료자 (users)
    activeParticipants: number; // 작업 참여자 (실제 작업 시작한 사람)

    // 기존 통계
    totalParticipants: number; // = totalRegisteredUsers와 동일
    startedParticipants: number;
    completedParticipants: number;
    activeInLast7Days: number;
  };
}

interface RecordingsData {
  recordings: AudioRecording[];
  totalCount: number;
  pagination: {
    currentPage: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
  statistics: {
    totalRecordings: number;
    byDomain: Record<string, number>;
    byTaskType: {
      situational: number;
      formal: number;
    };
    byQuality: {
      high: number;
      medium: number;
      low: number;
    };
    byStatus: Record<string, number>;
  };
}

interface UserRecordingsData {
  userInfo: {
    userId: string;
    userName?: string;
    gender: string;
    ageGroup: string;
  };
  recordings: AudioRecording[];
  statistics: {
    totalRecordings: number;
    averageDuration: number;
    totalFileSize: number;
    qualityDistribution: {
      high: number;
      medium: number;
      low: number;
    };
    domainBreakdown: Record<string, number>;
  };
}

// ===== 참여자 관리 훅 =====

/**
 * 참여자 목록 조회 훅
 */
interface UseAdminParticipantsParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  status?: string;
  gender?: string;
  ageGroup?: string;
  search?: string;
}

export const useAdminParticipants = (
  params: UseAdminParticipantsParams = {}
): UseQueryResult<ParticipantsOverviewData, Error> => {
  const {
    page = 1,
    limit = 20,
    sortBy = "createdAt",
    sortOrder = "desc",
    status,
    gender,
    ageGroup,
    search,
  } = params;

  return useQuery({
    queryKey: ["adminParticipants", params],
    queryFn: async (): Promise<ParticipantsOverviewData> => {
      const queryParams = new URLSearchParams();
      queryParams.append("page", page.toString());
      queryParams.append("limit", limit.toString());
      queryParams.append("sortBy", sortBy);
      queryParams.append("sortOrder", sortOrder);

      if (status) queryParams.append("status", status);
      if (gender) queryParams.append("gender", gender);
      if (ageGroup) queryParams.append("ageGroup", ageGroup);
      if (search) queryParams.append("search", search);

      const response = await fetch(
        `/api/admin/participants/overview?${queryParams.toString()}`
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "참여자 목록 조회에 실패했습니다.");
      }

      return data.data;
    },
    staleTime: 2 * 60 * 1000, // 2분간 캐시 유지
    retry: 1,
  });
};

/**
 * 특정 참여자 상세 정보 조회 훅
 */
export const useAdminParticipantDetail = (
  userId: string
): UseQueryResult<ParticipantDetail, Error> => {
  return useQuery({
    queryKey: ["adminParticipantDetail", userId],
    queryFn: async (): Promise<ParticipantDetail> => {
      const response = await fetch(`/api/admin/participants/${userId}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "참여자 상세 정보 조회에 실패했습니다."
        );
      }

      return data.data;
    },
    enabled: !!userId,
    staleTime: 1 * 60 * 1000, // 1분간 캐시 유지
    retry: 1,
  });
};

// ===== 진행 상황 관리 훅 =====

/**
 * 전체 진행 상황 개요 조회 훅
 */
export const useAdminProgressOverview = (): UseQueryResult<
  ProgressOverview,
  Error
> => {
  return useQuery({
    queryKey: ["adminProgressOverview"],
    queryFn: async (): Promise<ProgressOverview> => {
      const response = await fetch("/api/admin/progress/overview");
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "진행 상황 조회에 실패했습니다.");
      }

      return data.data;
    },
    staleTime: 5 * 60 * 1000, // 5분간 캐시 유지
    retry: 1,
    refetchInterval: 5 * 60 * 1000, // 5분마다 자동 갱신
  });
};

/**
 * 특정 사용자 진행 상황 상세 조회 훅
 */
export const useAdminUserProgress = (
  userId: string
): UseQueryResult<ParticipantDetail, Error> => {
  return useQuery({
    queryKey: ["adminUserProgress", userId],
    queryFn: async (): Promise<ParticipantDetail> => {
      const response = await fetch(`/api/admin/progress/${userId}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "사용자 진행 상황 조회에 실패했습니다."
        );
      }

      return data.data;
    },
    enabled: !!userId,
    staleTime: 2 * 60 * 1000, // 2분간 캐시 유지
    retry: 1,
  });
};

// ===== 녹음 데이터 관리 훅 =====

/**
 * 녹음 목록 조회 훅
 */
interface UseAdminRecordingsParams {
  page?: number;
  limit?: number;
  userId?: string;
  domain?: string;
  taskType?: "situational" | "formal";
  quality?: "high" | "medium" | "low";
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  search?: string;
  targetUserId?: string; //검색대상유저아이디
  targetUserName?: string;
}

export const useAdminRecordings = (
  params: UseAdminRecordingsParams = {}
): UseQueryResult<RecordingsData, Error> => {
  const {
    page = 1,
    limit = 50,
    userId,
    domain,
    taskType,
    quality,
    sortBy = "uploadedAt",
    sortOrder = "desc",
    search,
  } = params;

  console.log("여기서 param?", params);

  return useQuery({
    queryKey: ["adminRecordings", params],
    queryFn: async (): Promise<RecordingsData> => {
      const queryParams = new URLSearchParams();
      queryParams.append("page", page.toString());
      queryParams.append("limit", limit.toString());
      queryParams.append("sortBy", sortBy);
      queryParams.append("sortOrder", sortOrder);

      if (userId) queryParams.append("userId", userId);
      if (domain) queryParams.append("domain", domain);
      if (taskType) queryParams.append("taskType", taskType);
      if (quality) queryParams.append("quality", quality);
      if (search) queryParams.append("search", search);

      const response = await fetch(
        `/api/admin/recordings?${queryParams.toString()}`
      );
      const data = await response.json();

      console.log("녹음 목록 조회:", data);

      if (!response.ok) {
        throw new Error(data.message || "녹음 목록 조회에 실패했습니다.");
      }

      return data.data;
    },
    staleTime: 3 * 60 * 1000, // 3분간 캐시 유지
    retry: 1,
  });
};

/**
 * 특정 사용자의 녹음 목록 조회 훅
 */
export const useAdminUserRecordings = (
  userId: string
): UseQueryResult<UserRecordingsData, Error> => {
  return useQuery({
    queryKey: ["adminUserRecordings", userId],
    queryFn: async (): Promise<UserRecordingsData> => {
      const response = await fetch(`/api/admin/recordings/${userId}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "사용자 녹음 목록 조회에 실패했습니다."
        );
      }

      return data.data;
    },
    enabled: !!userId,
    staleTime: 2 * 60 * 1000, // 2분간 캐시 유지
    retry: 1,
  });
};

// ===== 유틸리티 훅 =====
/**
 * 관리자 권한 확인 훅 (API 호출 없음!)
 */
export const useAdminAuth = (): {
  data: {
    isAdmin: boolean;
    adminName?: string;
    adminId?: string;
  };
  isLoading: boolean;
} => {
  const [adminInfo, setAdminInfo] = useState<{
    isAdmin: boolean;
    adminName?: string;
    adminId?: string;
  }>({ isAdmin: false });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkAdminFromJWT = () => {
      try {
        const token = document.cookie
          .split("; ")
          .find((row) => row.startsWith("admin-token="))
          ?.split("=")[1];

        if (!token) {
          setAdminInfo({ isAdmin: false });
          setIsLoading(false);
          return;
        }

        const payload = JSON.parse(atob(token.split(".")[1]));

        if (payload.exp && Date.now() >= payload.exp * 1000) {
          setAdminInfo({ isAdmin: false });
          setIsLoading(false);
          return;
        }

        setAdminInfo({
          isAdmin: true,
          adminName: payload.name,
          adminId: payload.adminId,
        });
      } catch (error) {
        console.error("JWT 디코딩 실패:", error);
        setAdminInfo({ isAdmin: false });
      } finally {
        setIsLoading(false);
      }
    };

    checkAdminFromJWT();
  }, []);

  return {
    data: adminInfo,
    isLoading,
  };
};

/**
 * 관리자 대시보드 통합 데이터 훅 (여러 API를 한 번에)
 */
export const useAdminDashboard = () => {
  const participantsQuery = useAdminParticipants({ limit: 10 });
  const progressQuery = useAdminProgressOverview();
  // const recordingsQuery = useAdminRecordings({ limit: 50 });

  return {
    participants: participantsQuery,
    progress: progressQuery,
    // recordings: recordingsQuery,

    // 통합 로딩 상태
    isLoading: participantsQuery.isLoading || progressQuery.isLoading,
    // recordingsQuery.isLoading,

    // 통합 에러 상태
    hasError: participantsQuery.isError || progressQuery.isError,
    // recordingsQuery.isError,

    // 모든 데이터 로드 완료 여부
    isReady: participantsQuery.isSuccess && progressQuery.isSuccess,
    // recordingsQuery.isSuccess,
  };
};

// ===== 데이터 변환 유틸리티 =====

/**
 * 진행률 색상 반환 함수
 */
export const getProgressColor = (progress: number): string => {
  if (progress === 0) return "#6b7280"; // gray
  if (progress < 25) return "#ef4444"; // red
  if (progress < 50) return "#f97316"; // orange
  if (progress < 75) return "#eab308"; // yellow
  if (progress < 100) return "#3b82f6"; // blue
  return "#10b981"; // green
};

/**
 * 상태별 색상 반환 함수
 */
export const getStatusColor = (status: string): string => {
  switch (status) {
    case "not_started":
      return "#6b7280"; // gray
    case "in_progress":
      return "#3b82f6"; // blue
    case "completed":
      return "#10b981"; // green
    case "inactive":
      return "#ef4444"; // red
    default:
      return "#6b7280";
  }
};

/**
 * 품질 등급별 색상 반환 함수
 */
export const getQualityColor = (quality: string): string => {
  switch (quality) {
    case "high":
      return "#10b981"; // green
    case "medium":
      return "#eab308"; // yellow
    case "low":
      return "#ef4444"; // red
    default:
      return "#6b7280";
  }
};

/**
 * 3단계 통계를 위한 유틸리티 함수들 추가
 */

/**
 * 참여 단계별 색상 반환 함수
 */
export const getParticipationStageColor = (
  stage: "applicant" | "registered" | "active"
): string => {
  switch (stage) {
    case "applicant":
      return "#8b5cf6"; // purple - 신청
    case "registered":
      return "#3b82f6"; // blue - 가입
    case "active":
      return "#10b981"; // green - 활동
    default:
      return "#6b7280";
  }
};

/**
 * 참여 전환율 계산 함수
 */
export const calculateConversionRates = (
  statistics: ParticipantsOverviewData["statistics"]
) => {
  const { totalApplicants, totalRegisteredUsers, activeParticipants } =
    statistics;

  return {
    // 신청자 → 가입자 전환율
    applicantToRegistered:
      totalApplicants > 0
        ? Math.round((totalRegisteredUsers / totalApplicants) * 100)
        : 0,

    // 가입자 → 활동자 전환율
    registeredToActive:
      totalRegisteredUsers > 0
        ? Math.round((activeParticipants / totalRegisteredUsers) * 100)
        : 0,

    // 신청자 → 활동자 전환율 (전체)
    applicantToActive:
      totalApplicants > 0
        ? Math.round((activeParticipants / totalApplicants) * 100)
        : 0,
  };
};

/**
 * 파일 크기 포맷팅 함수
 */
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
};

/**
 * 시간 포맷팅 함수 (초 → 분:초)
 */
export const formatDuration = (seconds: number): string => {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
};
