// lib/firebase/auth.ts - 클라이언트 사이드 Firebase Auth 유틸리티
import { auth } from "@/lib/firebase/config";
import { signInWithCustomToken, signOut } from "firebase/auth";

export class FirebaseAuthManager {
  static async signInWithCustomToken(customToken: string) {
    try {
      const userCredential = await signInWithCustomToken(auth, customToken);
      console.log("🔥 Firebase Auth 로그인 성공:", userCredential.user.uid);
      return userCredential.user;
    } catch (error) {
      console.error("Firebase Auth 로그인 실패:", error);
      throw error;
    }
  }

  static async signOut() {
    try {
      await signOut(auth);
      console.log("🔥 Firebase Auth 로그아웃 완료");
    } catch (error) {
      console.error("Firebase Auth 로그아웃 실패:", error);
      throw error;
    }
  }

  static getCurrentUser() {
    return auth.currentUser;
  }

  static onAuthStateChanged(callback: (user: any) => void) {
    return auth.onAuthStateChanged(callback);
  }
}
