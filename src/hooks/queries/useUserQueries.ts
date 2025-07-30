// hooks/queries/useUserQueries.ts - Firebase Auth 기반으로 완전 변경

import { useQuery, UseQueryResult } from "@tanstack/react-query";
import { User } from "@/types/firebase";
import { useFirebaseAuth } from "@/hooks/useFirebaseAuth";
import { db } from "@/lib/firebase/config";
import { doc, getDoc } from "firebase/firestore";
import { Timestamp, FieldValue } from "firebase/firestore";
/**
 * 🔥 Firebase Auth 기반 인증 상태 확인
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
 * 🔥 Firebase Auth + Firestore Client SDK 기반 사용자 정보 조회
 * 보안 규칙이 자동으로 적용됩니다
 */
export const useUserQuery = (
  userId?: string | null
): UseQueryResult<User, Error> => {
  const { user: firebaseUser, isAuthenticated } = useFirebaseAuth();
  const targetUserId = userId || firebaseUser?.uid;

  return useQuery({
    queryKey: targetUserId ? ["user", targetUserId] : ["user", "no-user"],
    queryFn: async (): Promise<User> => {
      console.log(
        "🔥 useUserQuery (Firestore 직접 조회) 실행, targetUserId:",
        targetUserId
      );

      if (!targetUserId) {
        throw new Error("사용자 ID가 없습니다.");
      }

      if (!isAuthenticated || !firebaseUser) {
        throw new Error("Firebase 인증이 필요합니다.");
      }

      // 🔥 Firestore Client SDK 직접 사용 - 보안 규칙 자동 적용
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
        console.log("✅ Firestore에서 사용자 데이터 조회 성공:", {
          id: targetUserId,
          userName: userData?.userName,
        });

        return {
          id: targetUserId,
          ...userData,
        } as User;
      } catch (error: any) {
        console.error("❌ Firestore 사용자 조회 오류:", error);

        // Firebase Auth 권한 오류 처리
        if (error.code === "permission-denied") {
          throw new Error("접근 권한이 없습니다.");
        }

        // 네트워크 오류 처리
        if (error.code === "unavailable") {
          throw new Error("네트워크 연결을 확인해주세요.");
        }

        throw error;
      }
    },
    enabled: isAuthenticated && !!targetUserId && !!firebaseUser,
    staleTime: 5 * 60 * 1000, // 5분
    retry: (failureCount, error) => {
      // 등록되지 않은 사용자나 권한 오류는 재시도하지 않음
      if (
        error?.message === "USER_NOT_REGISTERED" ||
        error?.message === "접근 권한이 없습니다."
      ) {
        return false;
      }
      return failureCount < 2;
    },
  });
};

/**
 * 🔥 Firebase Auth 기반 최소 사용자 정보
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

  return useQuery({
    queryKey: ["minimalUserInfo", firebaseUser?.uid],
    queryFn: async () => {
      if (fullUser && firebaseUser) {
        console.log("🔥 useMinimalUserQuery: Firebase 사용자 데이터에서 추출", {
          id: firebaseUser.uid,
          userName: fullUser.userName,
        });
        return {
          id: firebaseUser.uid,
          userName: fullUser.userName,
          completedAt: fullUser.completedAt,
        };
      }
      return null;
    },
    enabled: !!fullUser && !!firebaseUser,
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });
};

/**
 * 🔥 Firebase Auth 기반 사용자 등록 완료 상태 확인
 */
export const useUserCompletionStatusQuery = (
  userId?: string | null
): UseQueryResult<boolean, Error> => {
  const { user: firebaseUser, isAuthenticated } = useFirebaseAuth();
  const targetUserId = userId || firebaseUser?.uid;

  return useQuery({
    queryKey: ["userCompletionStatus", targetUserId],
    queryFn: async (): Promise<boolean> => {
      console.log(
        "🔥 useUserCompletionStatusQuery 실행, targetUserId:",
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
        // 🔥 Firestore Client SDK 직접 사용
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
    enabled: !!targetUserId && isAuthenticated && !!firebaseUser,
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

  return (
    fullUser?.currentStatus?.isTutorialCompleted ||
    fullUser?.recordingStatus?.isTutorialCompleted ||
    false
  );
};

/**
 * 🔥 Firebase Auth 기반 현재 세트 번호 조회
 */
export const useCurrentSetNumber = (): number => {
  const { user: firebaseUser } = useFirebaseAuth();
  const { data: fullUser } = useUserQuery(firebaseUser?.uid);

  return fullUser?.participation?.currentSetNumber || 1;
};

/**
 * 🔥 Firebase Auth 기반 현재 세트 ID 조회
 */
export const useCurrentSetId = (): number => {
  const { user: firebaseUser } = useFirebaseAuth();
  const { data: fullUser } = useUserQuery(firebaseUser?.uid);
  const currentSetNumber = fullUser?.participation?.currentSetNumber || 1;
  const currentSet = fullUser?.participation?.sets?.find(
    (set) => set.setNumber === currentSetNumber
  );
  return currentSet?.setId || 1;
};

/**
 * 🔥 Firebase Auth 기반 전체 녹음 작업 완료 상태 확인
 */
export const useAllRecordingCompletionQuery = (
  userId?: string | null
): UseQueryResult<boolean, Error> => {
  const { user: firebaseUser } = useFirebaseAuth();
  const { data: fullUser } = useUserQuery(userId || firebaseUser?.uid);

  return useQuery({
    queryKey: ["allRecordingCompletion", userId || firebaseUser?.uid],
    queryFn: async (): Promise<boolean> => {
      console.log("🔥 전체 녹음 완료 상태 확인:", {
        completedPercentage:
          fullUser?.currentStatus?.progress?.completedPercentage,
        isAllRecordingCompleted:
          fullUser?.recordingStatus?.isAllRecordingCompleted,
      });

      // 서버 데이터에서 모든 녹음 완료 여부 확인
      if (fullUser?.currentStatus?.progress?.completedPercentage === 100) {
        return true;
      }

      // 레거시 구조도 확인
      if (fullUser?.recordingStatus?.isAllRecordingCompleted) {
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
 * 🔥 Firebase Auth 기반 인증 상태 확인 유틸리티
 */
export const useIsAuthenticated = (): boolean => {
  const { isAuthenticated } = useFirebaseAuth();
  return isAuthenticated;
};

/**
 * 🔥 Firebase Auth 상태를 직접 노출하는 훅 (필요시 사용)
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
