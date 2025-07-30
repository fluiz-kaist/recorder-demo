// hooks/useFirebaseAuth.ts - 단순화된 버전 (ID Token 자동 저장 제거)
import { useState, useEffect } from "react";
import { FirebaseAuthManager } from "@/lib/firebase/auth";
import { User } from "firebase/auth";

export const useFirebaseAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Firebase Auth 상태 변화 감지만 - ID Token 저장은 수동으로만
  useEffect(() => {
    const unsubscribe = FirebaseAuthManager.onAuthStateChanged((user) => {
      console.log("Firebase Auth 상태 변화:", user?.uid || "없음");
      setUser(user);
      setIsLoading(false);

      // ✅ ID Token 자동 저장 제거 - 필요한 곳에서만 수동 저장
      // 이렇게 하면 타이밍 이슈를 방지할 수 있음
    });

    return () => unsubscribe();
  }, []);

  const signInWithToken = async (customToken: string) => {
    try {
      setIsLoading(true);
      const user = await FirebaseAuthManager.signInWithCustomToken(customToken);
      console.log("Firebase 로그인 성공:", user.uid);
      return user;
    } catch (error) {
      console.error("Firebase 로그인 실패:", error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // ✅ ID Token 저장을 위한 유틸리티 메서드 추가
  const saveIdTokenToCookie = async (user?: User) => {
    try {
      const targetUser = user;
      if (targetUser) {
        const idToken = await targetUser.getIdToken();
        document.cookie = `firebase-token=${idToken}; path=/; max-age=3600`;
        console.log("ID Token을 쿠키에 저장 완료");
        return idToken;
      }
    } catch (error) {
      console.error("ID Token 저장 실패:", error);
      throw error;
    }
  };

  const refreshToken = async () => {
    try {
      const response = await fetch("/api/auth/refreshToken", {
        method: "POST",
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();
        if (data.customToken) {
          console.log("Firebase Token 갱신 완료");
          await signInWithToken(data.customToken);
        }
      }
    } catch (error) {
      console.error("토큰 갱신 실패:", error);
    }
  };

  const signOut = async () => {
    try {
      setIsLoading(true);
      await FirebaseAuthManager.signOut();

      // 쿠키에서 토큰 제거
      document.cookie = "firebase-token=; path=/; max-age=0";

      // HTTP 쿠키도 함께 로그아웃
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });
    } catch (error) {
      console.error("로그아웃 실패:", error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    user,
    isLoading,
    signInWithToken,
    saveIdTokenToCookie, // ✅ 추가된 유틸리티
    signOut,
    refreshToken,
    isAuthenticated: !!user,
  };
};
