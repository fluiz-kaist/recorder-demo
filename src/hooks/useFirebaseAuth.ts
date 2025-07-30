// hooks/useFirebaseAuth.ts - 간단한 버전
import { useState, useEffect } from "react";
import { FirebaseAuthManager } from "@/lib/firebase/auth";
import { User } from "firebase/auth";

export const useFirebaseAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Firebase Auth 상태 변화 감지
  useEffect(() => {
    const unsubscribe = FirebaseAuthManager.onAuthStateChanged((user) => {
      setUser(user);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // 🆕 쿠키에 Firebase Token이 있으면 자동 로그인 시도
  useEffect(() => {
    const attemptAutoLogin = async () => {
      if (!user && !isLoading) {
        const firebaseToken = getCookie("firebase-token");

        if (firebaseToken) {
          try {
            console.log("🔥 저장된 Firebase Token으로 자동 로그인 시도");
            await signInWithToken(firebaseToken);
          } catch (error) {
            console.error("자동 로그인 실패:", error);
            // 토큰 갱신 시도
            await refreshToken();
          }
        }
      }
    };

    attemptAutoLogin();
  }, [user, isLoading]);

  const signInWithToken = async (customToken: string) => {
    try {
      setIsLoading(true);
      const user = await FirebaseAuthManager.signInWithCustomToken(customToken);
      return user;
    } catch (error) {
      console.error("Firebase 로그인 실패:", error);
      throw error;
    } finally {
      setIsLoading(false);
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
          console.log("🔄 Firebase Token 갱신 완료");
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
    signOut,
    refreshToken,
    isAuthenticated: !!user,
  };
};

// 쿠키 읽기 유틸리티 함수
export function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;

  console.log("🍪 전체 쿠키:", document.cookie); // 🔧 디버그 추가
  console.log("🍪 찾는 쿠키 이름:", name); // 🔧 디버그 추가

  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);

  console.log("🍪 파싱 결과:", parts); // 🔧 디버그 추가

  if (parts.length === 2) {
    const result = parts.pop()?.split(";").shift() || null;
    console.log("🍪 최종 결과:", result); // 🔧 디버그 추가
    return result;
  }
  return null;
}
