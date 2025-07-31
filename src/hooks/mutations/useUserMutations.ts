// hooks/mutations/useUserMutations.ts - Firebase Auth + Firestore Client SDK 기반으로 완전 변경

import {
  useMutation,
  useQueryClient,
  UseMutationResult,
} from "@tanstack/react-query";
import { User } from "@/types/firebase";
import { RegisterUserRequest } from "@/types/api";
import { useFirebaseAuth } from "@/hooks/useFirebaseAuth";
import { db } from "@/lib/firebase/config";
import {
  doc,
  setDoc,
  updateDoc,
  serverTimestamp,
  getDoc,
  collection,
  addDoc,
} from "firebase/firestore";

/**
 * 사용자 정보 업데이트 요청 데이터 타입
 */
interface UpdateUserRequest {
  userId: string;
  updates: Partial<User>;
}

/**
 * 화이트리스트 체크 전용 뮤테이션
 * Firebase Auth 로그인이나 Custom Token 생성 없음
 * 오직 승인된 사용자인지만 확인
 */
export const useVerifyAuthorizedUserMutation = () => {
  return useMutation({
    mutationFn: async ({
      name,
      socialNumber,
    }: {
      name: string;
      socialNumber: string;
    }) => {
      // 화이트리스트에 있는 승인된 사용자인지만 확인
      const response = await fetch("/api/auth/verifyAuthorizedUserV2", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name, socialNumber }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "인증에 실패했습니다.");
      }

      return data;
    },
    onSuccess: (data) => {
      console.log("화이트리스트 확인 성공:", data);

      // 신규 사용자인 경우만 pendingAuth에 저장
      if (!data.user.isExistingUser) {
        localStorage.setItem("pendingAuth", JSON.stringify(data.user));
        console.log("신규 사용자 - pendingAuth 저장 완료");
      }
    },
    onError: (error) => {
      console.error("화이트리스트 확인 실패:", error);
    },
  });
};

export const useUpdateWhitelistedUserMutation = () => {
  return useMutation({
    mutationFn: async ({ userId }: { userId: string }) => {
      // 화이트리스트 문서의 userId 필드 업데이트
      const response = await fetch("/api/auth/verifyAuthorizedUserV2", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include", // 쿠키의 userHash를 전송하기 위해 필요
        body: JSON.stringify({ userId }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
            "화이트리스트 사용자의 userId 업데이트에 실패했습니다."
        );
      }

      return data;
    },
    onSuccess: (data) => {
      console.log("화이트리스트 userId 업데이트 성공:", data);
    },
    onError: (error) => {
      console.error("화이트리스트 userId 업데이트 실패:", error);
    },
  });
};
/**
 * Firebase Auth + Firestore Client SDK 기반 사용자 등록 뮤테이션
 * API 호출 대신 Firestore에 직접 쓰기
 */
export const useRegisterUserMutation = (): UseMutationResult<
  User,
  Error,
  RegisterUserRequest
> => {
  const queryClient = useQueryClient();
  const { user: firebaseUser } = useFirebaseAuth();

  return useMutation({
    mutationFn: async ({
      userId,
      gender,
      ageGroup,
      hasConsented,
      userName,
      authorizedUserId,
    }: RegisterUserRequest): Promise<User> => {
      if (!firebaseUser) {
        throw new Error("Firebase 인증이 필요합니다.");
      }

      if (firebaseUser.uid !== userId) {
        throw new Error("인증된 사용자와 등록 요청 사용자가 다릅니다.");
      }

      console.log("🔥 Firestore 직접 사용자 등록 시작:", userId);

      // Firestore Client SDK로 직접 등록
      const userCollectionName =
        process.env.NEXT_PUBLIC_DB_USER_COLLECTION || "users-temp";
      const userDocRef = doc(db, userCollectionName, userId);

      const userDoc: User = {
        id: userId,
        gender,
        ageGroup,
        hasConsented,
        userName,
        authorizedUserId,
        createdAt: new Date().toISOString(),
        lastAccessAt: new Date().toISOString(),
        completedAt: new Date().toISOString(), // 등록 즉시 완료로 설정
        currentStatus: {
          isTutorialCompleted: false,
          canStartRecording: false, // 기본값으로 false 설정
          pendingApproval: false, // 기본값 설정
          canStartNextSet: false, // 기본값 설정
          progress: {
            completedPercentage: 0,
            submittedPercentage: 0,
            approvedPercentage: 0,
          },
        },
        participation: {
          currentSetNumber: 0,
          totalCompletedSets: 0,
          maxAllowedSets: 3, // 또는 정책상 정한 값
          preferredMode: "mixed",
          sets: [],
          stats: {
            totalRecordings: 0,
            totalApprovedRecordings: 0,
            averageQualityScore: 0,
          },
        },
      };

      // 🔥 Firestore에 직접 쓰기 (보안 규칙 자동 적용)
      try {
        await setDoc(userDocRef, userDoc);
        console.log("✅ Firestore 사용자 등록 완료:", userId);
        return userDoc;
      } catch (error: any) {
        console.error("❌ Firestore 사용자 등록 실패:", error);

        if (error.code === "permission-denied") {
          throw new Error(
            "사용자 등록 권한이 없습니다. Firebase 인증을 확인해주세요."
          );
        }

        if (error.code === "unavailable") {
          throw new Error("네트워크 연결을 확인해주세요.");
        }

        throw new Error("사용자 등록에 실패했습니다.");
      }
    },
    onSuccess: (user, variables) => {
      console.log("✅ 사용자 등록 성공:", user);

      // React Query 캐시 업데이트
      queryClient.setQueryData(["user", variables.userId], user);
      queryClient.setQueryData(
        ["userCompletionStatus", variables.userId],
        true
      );
      queryClient.setQueryData(["minimalUserInfo", variables.userId], {
        id: variables.userId,
        userName: user.userName,
        completedAt: user.completedAt,
      });
    },
    onError: (error) => {
      console.error("❌ 사용자 등록 중 오류:", error);
    },
  });
};

/**
 * 🔥 Firebase Auth + Firestore Client SDK 기반 사용자 정보 업데이트 뮤테이션
 */
export const useUpdateUserMutation = (): UseMutationResult<
  User,
  Error,
  UpdateUserRequest
> => {
  const queryClient = useQueryClient();
  const { user: firebaseUser } = useFirebaseAuth();

  return useMutation({
    mutationFn: async ({
      userId,
      updates,
    }: UpdateUserRequest): Promise<User> => {
      if (!firebaseUser) {
        throw new Error("Firebase 인증이 필요합니다.");
      }

      if (firebaseUser.uid !== userId) {
        throw new Error("본인의 정보만 수정할 수 있습니다.");
      }

      console.log("🔥 Firestore 사용자 정보 업데이트 시작:", userId, updates);

      // 🔥 Firestore Client SDK로 직접 업데이트
      const userCollectionName =
        process.env.NEXT_PUBLIC_DB_USER_COLLECTION || "users-temp";
      const userDocRef = doc(db, userCollectionName, userId);

      try {
        // 업데이트할 데이터 준비
        const updateData = {
          ...updates,
          lastAccessAt: new Date().toISOString(),
        };

        // Firestore에 업데이트
        await updateDoc(userDocRef, updateData);

        // 업데이트된 데이터 조회
        const updatedDoc = await getDoc(userDocRef);
        if (!updatedDoc.exists()) {
          throw new Error("업데이트 후 사용자 데이터를 찾을 수 없습니다.");
        }

        const updatedUser = {
          id: userId,
          ...updatedDoc.data(),
        } as User;

        console.log("✅ Firestore 사용자 정보 업데이트 완료:", updatedUser);
        return updatedUser;
      } catch (error: any) {
        console.error("❌ Firestore 사용자 정보 업데이트 실패:", error);

        if (error.code === "permission-denied") {
          throw new Error("사용자 정보 수정 권한이 없습니다.");
        }

        if (error.code === "not-found") {
          throw new Error("사용자를 찾을 수 없습니다.");
        }

        throw new Error("사용자 정보 업데이트에 실패했습니다.");
      }
    },
    onSuccess: (updatedUser, variables) => {
      console.log("✅ 사용자 정보 업데이트 성공:", updatedUser);

      // React Query 캐시 업데이트
      queryClient.setQueryData(["user", variables.userId], updatedUser);

      // 관련 캐시들도 무효화
      queryClient.invalidateQueries({ queryKey: ["minimalUserInfo"] });
      queryClient.invalidateQueries({ queryKey: ["userCompletionStatus"] });
    },
    onError: (error) => {
      console.error("❌ 사용자 정보 업데이트 중 오류:", error);
    },
  });
};

/**
 * 🔥 Firebase Auth 기반 마지막 접속 시간 업데이트 뮤테이션
 */
export const useUpdateLastAccessMutation = (): UseMutationResult<
  void,
  Error,
  string
> => {
  const queryClient = useQueryClient();
  const { user: firebaseUser } = useFirebaseAuth();

  return useMutation({
    mutationFn: async (userId: string): Promise<void> => {
      if (!firebaseUser || firebaseUser.uid !== userId) {
        throw new Error("본인의 접속 시간만 업데이트할 수 있습니다.");
      }

      console.log("🔥 마지막 접속 시간 업데이트:", userId);

      const userCollectionName =
        process.env.NEXT_PUBLIC_DB_USER_COLLECTION || "users-temp";
      const userDocRef = doc(db, userCollectionName, userId);

      try {
        await updateDoc(userDocRef, {
          lastAccessAt: new Date().toISOString(),
        });

        console.log("✅ 마지막 접속 시간 업데이트 완료");
      } catch (error: any) {
        console.warn("⚠️ 마지막 접속 시간 업데이트 실패:", error);
        // 치명적이지 않은 오류이므로 조용히 처리
      }
    },
    onSuccess: (_, userId) => {
      // 백그라운드 업데이트이므로 캐시 무효화만 수행
      queryClient.invalidateQueries({ queryKey: ["user", userId] });
    },
    onError: (error) => {
      // 마지막 접속 시간 업데이트 실패는 치명적이지 않으므로 조용히 처리
      console.warn("⚠️ 마지막 접속 시간 업데이트 실패:", error);
    },
  });
};

/**
 * 🔥 Firebase Auth 기반 로그아웃 뮤테이션
 */
export const useLogoutUserMutation = (): UseMutationResult<
  void,
  Error,
  void
> => {
  const queryClient = useQueryClient();
  const { signOut } = useFirebaseAuth();

  return useMutation({
    mutationFn: async (): Promise<void> => {
      try {
        // 🔥 Firebase Auth 로그아웃
        await signOut();
        console.log("✅ Firebase Auth 로그아웃 완료");

        // 🔧 HTTP 쿠키도 정리 (호환성 유지)
        await fetch("/api/auth/logout", {
          method: "POST",
          credentials: "include",
        });
      } catch (error) {
        console.error("❌ 로그아웃 오류:", error);
        // 로그아웃 실패해도 클라이언트 정리는 진행
      }
    },
    onSuccess: () => {
      // 🔥 React Query 캐시 완전 정리
      queryClient.clear();

      // localStorage 정리
      localStorage.removeItem("pendingAuth");

      console.log("✅ 사용자 로그아웃 완료");

      // 로그인 페이지로 리다이렉트
      window.location.href = "/";
    },
    onError: (error) => {
      console.error("❌ 로그아웃 중 오류:", error);
      // 에러가 발생해도 로그인 페이지로 이동
      window.location.href = "/";
    },
  });
};

/**
 * 🔥 Firebase Auth + Firestore 기반 스크립트 완료 뮤테이션
 */
export interface CompleteScriptRequest {
  userId: string;
  taskKey: string;
  taskType: "situational" | "formal";
  status: "not_started" | "in_progress" | "completed";
  audioRecordId: string;
}

export interface CompleteScriptResponse {
  message: string;
}

export const useCompleteScriptMutation = (): UseMutationResult<
  CompleteScriptResponse,
  Error,
  CompleteScriptRequest
> => {
  const queryClient = useQueryClient();
  const { user: firebaseUser } = useFirebaseAuth();

  return useMutation({
    mutationFn: async ({
      userId,
      taskKey,
      taskType,
      status,
      audioRecordId,
    }: CompleteScriptRequest): Promise<CompleteScriptResponse> => {
      if (!firebaseUser || firebaseUser.uid !== userId) {
        throw new Error("본인의 스크립트만 완료 처리할 수 있습니다.");
      }

      console.log("🔥 스크립트 완료 처리 시작:", { taskKey, taskType, status });

      // 🔧 일단 기존 API 유지 (복잡한 비즈니스 로직 때문)
      // 추후 Firestore 함수로 이전 고려
      const response = await fetch("/api/scripts/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          userId,
          taskKey,
          taskType,
          status,
          audioRecordId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "스크립트 완료 처리에 실패했습니다.");
      }

      console.log("✅ 스크립트 완료 처리 성공:", taskKey);
      return data as CompleteScriptResponse;
    },

    onSuccess: (_, variables) => {
      // 🔥 Firebase Auth 기반 캐시 무효화
      queryClient.invalidateQueries({
        queryKey: ["user", variables.userId],
      });

      queryClient.invalidateQueries({
        queryKey: ["user"],
        exact: false,
      });

      console.log(
        "✅ 스크립트 완료 처리 및 캐시 업데이트 완료:",
        variables.taskKey
      );
    },

    onError: (error) => {
      console.error("❌ 스크립트 완료 처리 실패:", error);
    },
  });
};
