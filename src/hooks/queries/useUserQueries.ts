// hooks/queries/useUserQueries.ts - Firebase Auth 기반으로 완전 변경
import { useEffect, useRef, useMemo, useCallback } from "react";
import {
  useQuery,
  UseQueryResult,
  useQueryClient,
} from "@tanstack/react-query";
// import { User } from "@/types/firebase";
import { User } from "@/types/user";
import { useFirebaseAuth } from "@/hooks/useFirebaseAuth";
import { db } from "@/lib/firebase/config";
import { doc, getDoc, Unsubscribe } from "firebase/firestore";
import { Timestamp, FieldValue } from "firebase/firestore";
import {
  getCurrentRoundData,
  subscribeToCurrentRound,
  subscribeToUserRounds,
  getUserRounds,
} from "@/lib/firebase/userService";
import { ParticipationRound } from "@/types/user";
/**
 * Firebase Auth 기반 인증 상태 확인
 * HTTP 쿠키 대신 Firebase Auth 상태 사용
 */
export const useAuthStatusQuery = (): UseQueryResult<
  { isAuthenticated: boolean; userId: string | null; user: any },
  Error
> => {
  const { user: firebaseUser, isLoading, isAuthenticated } = useFirebaseAuth();

  return {
    data: {
      isAuthenticated,
      userId: firebaseUser?.uid || null,
      user: firebaseUser,
    },
    isLoading,
    isError: false,
    error: null,
  } as UseQueryResult<
    { isAuthenticated: boolean; userId: string | null; user: any },
    Error
  >;
};

/**
 * Firebase Auth + Firestore Client SDK 기반 사용자 정보 조회
 * 보안 규칙이 자동으로 적용됩니다
 */

export const useUserQuery = (
  userId?: string | null
): UseQueryResult<User, Error> => {
  const { user: firebaseUser, isAuthenticated } = useFirebaseAuth();
  const targetUserId = userId || firebaseUser?.uid;

  // 🔧 등록 과정 중인지 확인 - 한 곳에서만 체크
  const isPendingRegistration = (() => {
    try {
      const pendingAuth = localStorage.getItem("pendingAuth");
      if (pendingAuth) {
        const authData = JSON.parse(pendingAuth);
        // 신규 사용자이고 아직 등록 과정 중이면 true
        return !authData.isExistingUser;
      }
      return false;
    } catch {
      return false;
    }
  })();

  return useQuery({
    queryKey: targetUserId ? ["user", targetUserId] : ["user", "no-user"],
    queryFn: async (): Promise<User> => {
      console.log("🔥 useUserQuery 실행, targetUserId:", targetUserId);

      if (!targetUserId || !isAuthenticated || !firebaseUser) {
        throw new Error("인증이 필요합니다.");
      }

      const userCollectionName =
        process.env.NEXT_PUBLIC_DB_USER_COLLECTION || "users-temp";
      const userDocRef = doc(db, userCollectionName, targetUserId);

      try {
        const userDoc = await getDoc(userDocRef);

        if (!userDoc.exists()) {
          console.log("❌ 사용자 문서가 존재하지 않음:", targetUserId);
          throw new Error("USER_NOT_REGISTERED");
        }

        const userData = userDoc.data();
        console.log("✅ Firestore에서 사용자 데이터 조회 성공");

        return userData as User;
      } catch (error: any) {
        console.error("❌ Firestore 사용자 조회 오류:", error);
        throw error;
      }
    },
    //  pendingAuth만으로 등록 과정 중 쿼리 방지
    enabled:
      isAuthenticated &&
      !!targetUserId &&
      !!firebaseUser &&
      !isPendingRegistration,
    staleTime: 5 * 60 * 1000,
    retry: (failureCount, error) => {
      if (error?.message === "USER_NOT_REGISTERED") {
        return false;
      }
      return failureCount < 2;
    },
  });
};

/**
 * Firebase Auth 기반 최소 사용자 정보
 * useUserQuery 결과에서 필요한 정보만 추출
 */
export const useMinimalUserQuery = (): UseQueryResult<
  {
    id: string;
    userName?: string;
    completedAt?: string | FieldValue | Timestamp;
  } | null,
  Error
> => {
  const { user: firebaseUser } = useFirebaseAuth();
  const {
    data: fullUser,
    isLoading,
    isError,
    error,
  } = useUserQuery(firebaseUser?.uid);

  const isPendingRegistration = (() => {
    try {
      const pendingAuth = localStorage.getItem("pendingAuth");
      if (pendingAuth) {
        const authData = JSON.parse(pendingAuth);
        return !authData.isExistingUser;
      }
      return false;
    } catch {
      return false;
    }
  })();

  return useQuery({
    queryKey: ["minimalUserInfo", firebaseUser?.uid],
    queryFn: async () => {
      if (fullUser && firebaseUser) {
        console.log("🔥 useMinimalUserQuery: Firebase 사용자 데이터에서 추출", {
          id: firebaseUser.uid,
          userName: fullUser.profile.userName,
          completedAt: fullUser.profile.createdAt,
        });
        return {
          id: firebaseUser.uid,
          userName: fullUser.profile.userName,
          completedAt: fullUser.profile.createdAt,
        };
      }
      return null;
    },
    enabled: !!fullUser && !!firebaseUser && !isPendingRegistration,
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });
};

/**
 * Firebase Auth 기반 사용자 등록 완료 상태 확인
 */
export const useUserCompletionStatusQuery = (
  userId?: string | null
): UseQueryResult<boolean, Error> => {
  const { user: firebaseUser, isAuthenticated } = useFirebaseAuth();
  const targetUserId = userId || firebaseUser?.uid;

  const isPendingRegistration = (() => {
    try {
      const pendingAuth = localStorage.getItem("pendingAuth");
      if (pendingAuth) {
        const authData = JSON.parse(pendingAuth);
        return !authData.isExistingUser;
      }
      return false;
    } catch {
      return false;
    }
  })();

  return useQuery({
    queryKey: ["userCompletionStatus", targetUserId],
    queryFn: async (): Promise<boolean> => {
      console.log(
        " useUserCompletionStatusQuery 실행, targetUserId:",
        targetUserId
      );

      if (!targetUserId || !isAuthenticated || !firebaseUser) {
        return false;
      }

      // 🔧 pendingAuth 확인 - 아직 등록 과정 중인 사용자
      const pendingAuth = localStorage.getItem("pendingAuth");
      if (pendingAuth) {
        try {
          const authData = JSON.parse(pendingAuth);
          // 기존 사용자라면 완료된 것으로 간주
          if (authData.isExistingUser) {
            return true;
          }
          // 신규 사용자라면 아직 미완료
          return false;
        } catch (error) {
          console.error("pendingAuth 파싱 오류:", error);
        }
      }

      try {
        // Firestore Client SDK 직접 사용
        const userCollectionName =
          process.env.NEXT_PUBLIC_DB_USER_COLLECTION || "users-temp";
        const userDocRef = doc(db, userCollectionName, targetUserId);
        const userDoc = await getDoc(userDocRef);

        if (!userDoc.exists()) {
          console.log("❌ 사용자 문서 없음 - 미등록 상태");
          return false;
        }

        const userData = userDoc.data();
        const isCompleted = !!userData?.completedAt;

        console.log("✅ 사용자 완료 상태 확인:", {
          userId: targetUserId,
          completedAt: userData?.completedAt,
          isCompleted,
        });

        return isCompleted;
      } catch (error: any) {
        console.error("❌ 사용자 완료 상태 확인 오류:", error);

        if (error.code === "permission-denied") {
          console.error("권한 거부 - Firebase 보안 규칙 확인 필요");
        }

        return false;
      }
    },
    enabled:
      !!targetUserId &&
      isAuthenticated &&
      !!firebaseUser &&
      !isPendingRegistration,
    staleTime: 5 * 60 * 1000, // 5분
    retry: 1,
  });
};

/**
 * 🔥 Firebase Auth 기반 튜토리얼 완료 여부 확인
 */
export const useIsTutorialCompleted = (): boolean => {
  const { user: firebaseUser } = useFirebaseAuth();
  const { data: fullUser } = useUserQuery(firebaseUser?.uid);

  return fullUser?.currentStatus?.isTutorialCompleted || false;
};

/**
 *  Firebase Auth 기반 현재 세트 번호 조회
 */
export const useCurrentSetNumber = (): number => {
  const { user: firebaseUser } = useFirebaseAuth();
  const { data: fullUser } = useUserQuery(firebaseUser?.uid);

  return fullUser?.currentStatus?.currentRoundNumber || 1;
};

/**
 * Firebase Auth 기반 현재 세트 ID 조회
 */
export const useCurrentSetId = (): number => {
  const { user: firebaseUser } = useFirebaseAuth();
  const { data: fullUser } = useUserQuery(firebaseUser?.uid);
  return fullUser?.currentStatus?.currentRoundNumber || 1;
};

/**
 * Firebase Auth 기반 전체 녹음 작업 완료 상태 확인
 */
export const useAllRecordingCompletionQuery = (
  userId?: string | null
): UseQueryResult<boolean, Error> => {
  const { user: firebaseUser } = useFirebaseAuth();
  const { data: fullUser } = useUserQuery(userId || firebaseUser?.uid);

  return useQuery({
    queryKey: ["allRecordingCompletion", userId || firebaseUser?.uid],
    queryFn: async (): Promise<boolean> => {
      console.log(" 전체 녹음 완료 상태 확인:", {
        completedPercentage:
          fullUser?.currentStatus?.currentRoundProgress?.completedPercentage,
        isAllRecordingCompleted:
          fullUser?.recordingStatus?.isAllRecordingCompleted,
      });

      // 서버 데이터에서 모든 녹음 완료 여부 확인
      if (
        fullUser?.currentStatus?.currentRoundProgress?.completedPercentage ===
        100
      ) {
        return true;
      }

      return false;
    },
    enabled: !!fullUser && !!firebaseUser,
    staleTime: 2 * 60 * 1000, // 2분
    retry: 1,
  });
};

/**
 * Firebase Auth 기반 인증 상태 확인 유틸리티
 */
export const useIsAuthenticated = (): boolean => {
  const { isAuthenticated } = useFirebaseAuth();
  return isAuthenticated;
};

/**
 * Firebase Auth 상태를 직접 노출하는 훅 (필요시 사용)
 */
export const useFirebaseAuthStatus = () => {
  const { user, isLoading, isAuthenticated, signOut } = useFirebaseAuth();

  return {
    firebaseUser: user,
    isFirebaseLoading: isLoading,
    isFirebaseAuthenticated: isAuthenticated,
    firebaseSignOut: signOut,
  };
};

/**
 * 🔧 실시간 구독 → 일반 쿼리로 변경
 * 무한 재렌더링 문제 해결 및 성능 최적화
 */

/**
 * 현재 라운드 데이터 조회 (일반 쿼리)
 */
export const useCurrentRoundQuery = (
  userId: string | undefined | null,
  roundNumber: number | undefined
) => {
  return useQuery({
    queryKey: ["currentRound", userId, roundNumber],
    queryFn: async () => {
      if (!userId || !roundNumber || roundNumber <= 0) {
        throw new Error("Invalid parameters");
      }
      return getCurrentRoundData(userId, roundNumber);
    },
    enabled: Boolean(userId && roundNumber && roundNumber > 0),
    staleTime: 30 * 1000, // 30초 동안 fresh
    refetchOnWindowFocus: false,
    refetchOnMount: true,
    retry: 2,
  });
};

/**
 * 사용자 모든 라운드 조회 (일반 쿼리)
 */
export const useUserRoundsQuery = (userId: string | undefined) => {
  return useQuery({
    queryKey: ["userRounds", userId],
    queryFn: async () => {
      if (!userId) {
        throw new Error("User ID is required");
      }
      // 🔧 새로운 함수 필요 - getUserRounds 구현 필요
      return getUserRounds(userId);
    },
    enabled: Boolean(userId),
    staleTime: 60 * 1000, // 1분 동안 fresh
    refetchOnWindowFocus: false,
    refetchOnMount: true,
    retry: 2,
  });
};

/**
 * 🚀 데이터 업데이트를 위한 유틸리티 훅들
 */

/**
 * 현재 라운드 데이터 수동 새로고침
 */
export const useRefreshCurrentRound = () => {
  const queryClient = useQueryClient();

  return useCallback(
    (userId: string, roundNumber: number) => {
      return queryClient.invalidateQueries({
        queryKey: ["currentRound", userId, roundNumber],
      });
    },
    [queryClient]
  );
};

/**
 * 사용자 라운드 목록 수동 새로고침
 */
export const useRefreshUserRounds = () => {
  const queryClient = useQueryClient();

  return useCallback(
    (userId: string) => {
      return queryClient.invalidateQueries({
        queryKey: ["userRounds", userId],
      });
    },
    [queryClient]
  );
};

/**
 * 🎯 녹음 완료 후 캐시 업데이트 유틸리티
 */
export const useUpdateRoundProgress = () => {
  const queryClient = useQueryClient();

  return useCallback(
    (userId: string, roundNumber: number, updateData: Partial<any>) => {
      // 1. 현재 라운드 캐시 업데이트
      queryClient.setQueryData(
        ["currentRound", userId, roundNumber],
        (oldData: any) => {
          if (!oldData) return oldData;
          return {
            ...oldData,
            ...updateData,
            updatedAt: new Date().toISOString(),
          };
        }
      );

      // 2. 사용자 라운드 목록도 업데이트
      queryClient.setQueryData(["userRounds", userId], (oldData: any[]) => {
        if (!oldData) return oldData;
        return oldData.map((round) =>
          round.roundNumber === roundNumber
            ? { ...round, ...updateData }
            : round
        );
      });
    },
    [queryClient]
  );
};
