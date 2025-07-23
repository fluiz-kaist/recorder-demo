// utils/localStorage.ts - 로컬스토리지 관련 공통 유틸리티
import { User } from "@/types/firebase";

/**
 * 로컬 스토리지에 사용자 정보 업데이트 (민감하지 않은 정보만)
 */
export const updateLocalUserInfo = (user: User) => {
  const localUserInfo = {
    name: user.name || "", // User 타입에 없지만 별도로 저장
    gender: user.gender || "",
    ageGroup: user.ageGroup || "",
    completedAt: user.completedAt,
    scriptAssignments: user.scriptAssignments || [],
  };
  localStorage.setItem("userInfo", JSON.stringify(localUserInfo));
};

/**
 * 로컬 스토리지에서 사용자 정보 읽기
 */
export const getLocalUserInfo = ():
  | (Pick<User, "completedAt" | "scriptAssignments"> & {
      name?: string;
      gender?: string;
      ageGroup?: string;
    })
  | null => {
  if (typeof window === "undefined") return null;

  const existingUserInfo = localStorage.getItem("userInfo");
  if (!existingUserInfo) return null;

  try {
    return JSON.parse(existingUserInfo);
  } catch (error) {
    console.error("로컬 사용자 정보 파싱 오류:", error);
    localStorage.removeItem("userInfo");
    return null;
  }
};

/**
 * 로컬 스토리지 정리
 */
export const clearLocalUserData = () => {
  localStorage.removeItem("userInfo");
  sessionStorage.clear();
};
