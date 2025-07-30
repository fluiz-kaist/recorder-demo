// lib/firebase/customToken.ts - Custom Token 생성 유틸리티
import { adminAuth } from "@/lib/firebase/admin";

export async function createCustomToken(userId: string, claims?: object) {
  try {
    const customToken = await adminAuth.createCustomToken(userId, claims);
    return customToken;
  } catch (error) {
    console.error("Custom Token 생성 실패:", error);
    throw new Error("Custom Token 생성에 실패했습니다.");
  }
}
