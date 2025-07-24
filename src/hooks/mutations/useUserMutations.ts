// hooks/mutations/useUserMutations.ts - 개선된 사용자 데이터 변경 훅
import {
  useMutation,
  useQueryClient,
  UseMutationResult,
} from "@tanstack/react-query";
import { User } from "@/types/firebase";
import { getKoreanTime } from "@/utils/auth";
import {
  updateUserRelatedCache,
  updateAuthStatusCache,
  clearUserRelatedCache,
} from "@/utils/queryCache";
import { clearLocalUserData } from "@/utils/localStorage";
import { RegisterUserRequest } from "@/types/api";

/**
 * 사용자 정보 업데이트 요청 데이터 타입
 */
interface UpdateUserRequest {
  userId: string;
  updates: Partial<User>;
}

/**
 * 사용자 인증 확인 뮤테이션 (쿠키 기반)
 * 기존: useVerifyAuthorizedUserMutation (useUserQueries.ts에서 이동)
 */
export const useVerifyAuthorizedUserMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      name,
      socialNumber,
    }: {
      name: string;
      socialNumber: string;
    }) => {
      const response = await fetch("/api/auth/verifyAuthorizedUser", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include", // 쿠키 포함
        body: JSON.stringify({ name, socialNumber }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "인증에 실패했습니다.");
      }

      return data;
    },
    onSuccess: (data) => {
      // 기존 사용자인지 확인
      if (data.user.isExistingUser) {
        console.log("data.user?", data.user);
        console.log("data?", data);
        // 기존 사용자 데이터로 캐시 업데이트
        updateAuthStatusCache(queryClient, true, data.user.userId);
        updateUserRelatedCache(
          queryClient,
          data.user.userId,
          data.user.existingData
        );

        console.log("기존 사용자 로그인 성공:", data.user.name);

        // 기존 사용자는 바로 메인으로 이동
        window.location.href = "/main";
        return;
      }

      // 신규 사용자 처리
      const userInfo = {
        name: data.user.name,
        completedAt: null, // 초기에는 미완료
        scriptAssignments: [],
      };

      // 신규 사용자 캐시 업데이트
      console.log("신규사용자캐시업뎃");
      updateAuthStatusCache(queryClient, true, data.user.userId);

      console.log("신규 사용자 인증 성공:", data.user.name);
    },
    onError: (error) => {
      console.error("인증 실패:", error);
    },
  });
};

/**
 * 사용자 등록 뮤테이션
 * 새로운 사용자를 서버에 등록하고 로컬 스토리지에 저장
 */
export const useRegisterUserMutation = (): UseMutationResult<
  User,
  Error,
  RegisterUserRequest
> => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      userId,
      gender,
      ageGroup,
      hasConsented,
      userName,
      authorizedUserId,
    }: RegisterUserRequest): Promise<User> => {
      const now = getKoreanTime();

      const response = await fetch(`/api/users/${userId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          gender,
          ageGroup,
          hasConsented,
          completedAt: now,
          userName,
          authorizedUserId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "사용자 등록에 실패했습니다.");
      }

      return data.user as User;
    },
    onSuccess: (user, variables) => {
      // 통합된 캐시 업데이트 함수 사용
      updateUserRelatedCache(queryClient, variables.userId, user);
      console.log("사용자 등록/로그인 완료:", user);
    },
    onError: (error) => {
      console.error("사용자 등록 중 오류:", error);
    },
  });
};

/**
 * 사용자 정보 업데이트 뮤테이션
 * 기존 사용자의 정보를 업데이트하고 로컬 캐시 동기화
 */
export const useUpdateUserMutation = (): UseMutationResult<
  User,
  Error,
  UpdateUserRequest
> => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      userId,
      updates,
    }: UpdateUserRequest): Promise<User> => {
      const response = await fetch(`/api/users/${userId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(updates),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "사용자 정보 업데이트에 실패했습니다.");
      }

      return data.user as User;
    },
    onSuccess: (updatedUser, variables) => {
      // 통합된 캐시 업데이트 함수 사용
      updateUserRelatedCache(queryClient, variables.userId, updatedUser);
      console.log("사용자 정보 업데이트 완료:", updatedUser);
    },
    onError: (error) => {
      console.error("사용자 정보 업데이트 중 오류:", error);
    },
  });
};

/**
 * 사용자 스크립트 할당 업데이트 뮤테이션
 * 사용자의 스크립트 할당 상태를 업데이트하고 로컬 캐시 동기화
 */
export const useUpdateScriptAssignmentsMutation = (): UseMutationResult<
  User,
  Error,
  { userId: string; scriptAssignments: User["scriptAssignments"] }
> => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, scriptAssignments }): Promise<User> => {
      const response = await fetch(`/api/users/${userId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          scriptAssignments,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "스크립트 할당 업데이트에 실패했습니다."
        );
      }

      return data.user as User;
    },
    onSuccess: (updatedUser, variables) => {
      // 통합된 캐시 업데이트 함수 사용
      updateUserRelatedCache(queryClient, variables.userId, updatedUser);
      console.log(
        "스크립트 할당 업데이트 완료:",
        updatedUser.scriptAssignments
      );
    },
    onError: (error) => {
      console.error("스크립트 할당 업데이트 중 오류:", error);
    },
  });
};

/**
 * 사용자 lastAccessAt 업데이트 뮤테이션
 * 백그라운드에서 마지막 접속 시간 업데이트 (로컬 캐시 업데이트 안함)
 */
export const useUpdateLastAccessMutation = (): UseMutationResult<
  void,
  Error,
  string
> => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (userId: string): Promise<void> => {
      const now = getKoreanTime();

      const response = await fetch(`/api/users/${userId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          lastAccessAt: now,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(
          data.message || "마지막 접속 시간 업데이트에 실패했습니다."
        );
      }
    },
    onSuccess: (_, userId) => {
      // 백그라운드 업데이트이므로 캐시 무효화만 수행
      // 다음 요청 시 최신 데이터 가져오기
      queryClient.invalidateQueries({ queryKey: ["user", userId] });
    },
    onError: (error) => {
      // 마지막 접속 시간 업데이트 실패는 치명적이지 않으므로 조용히 처리
      console.warn("마지막 접속 시간 업데이트 실패:", error);
    },
  });
};

/**
 * 사용자 로그아웃 뮤테이션
 * 서버에서 쿠키 삭제하고 로컬 스토리지와 쿼리 캐시를 모두 정리
 */
export const useLogoutUserMutation = (): UseMutationResult<
  void,
  Error,
  void
> => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (): Promise<void> => {
      try {
        // 서버에서 쿠키 삭제
        await fetch("/api/auth/logout", {
          method: "POST",
          credentials: "include",
        });
      } catch (error) {
        console.error("로그아웃 API 오류:", error);
        // API 실패해도 클라이언트 정리는 진행
      }
    },
    onSuccess: () => {
      // 통합된 정리 함수들 사용
      clearLocalUserData();
      clearUserRelatedCache(queryClient);

      console.log("사용자 로그아웃 완료");

      // 로그인 페이지로 리다이렉트
      window.location.href = "/";
    },
    onError: (error) => {
      console.error("로그아웃 중 오류:", error);
      // 에러가 발생해도 로그인 페이지로 이동
      window.location.href = "/";
    },
  });
};
