//api/users/[userId].ts
import { NextApiRequest, NextApiResponse } from "next";
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { User } from "@/types/firebase";

// 한국 시간 생성 유틸리티
const getKoreanTime = (): string => {
  const now = new Date();
  const koreanTime = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return koreanTime.toISOString();
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { userId } = req.query;

  // userId 유효성 검사
  if (!userId || typeof userId !== "string") {
    return res.status(400).json({
      success: false,
      message: "유효한 사용자 ID가 필요합니다.",
    });
  }

  const userDocRef = doc(db, "users", userId);

  try {
    if (req.method === "GET") {
      // 🔍 사용자 조회 + lastAccessAt 업데이트 (1회 호출)
      console.log("🔍 사용자 조회:", userId);

      try {
        const userSnap = await getDoc(userDocRef);

        if (!userSnap.exists()) {
          return res.status(404).json({
            success: false,
            message: "사용자를 찾을 수 없습니다.",
          });
        }

        const userData = userSnap.data() as User;
        const now = getKoreanTime();

        // lastAccessAt 업데이트 (에러 무시 - 조회가 목적이므로)
        updateDoc(userDocRef, {
          lastAccessAt: now,
        }).catch((err) => console.warn("lastAccessAt 업데이트 실패:", err));

        return res.status(200).json({
          success: true,
          user: {
            ...userData,
            lastAccessAt: now, // 업데이트된 시간 반영
          },
        });
      } catch (error) {
        console.error("❌에러 발생:", error);
        return res.status(404).json({
          success: false,
          message: "사용자를 찾을 수 없습니다.",
        });
      }
    } else if (req.method === "POST") {
      // 🏪 사용자 등록
      console.log("🏪 사용자 등록:", userId);

      const {
        gender,
        ageGroup,
        hasConsented = true, // 기본값 true (동의 후 등록이므로)
        completedAt,
      } = req.body;

      // 필수 필드 검증
      if (!gender || !ageGroup) {
        return res.status(400).json({
          success: false,
          message: "성별과 연령대는 필수입니다.",
        });
      }

      // 동의 여부 확인
      if (!hasConsented) {
        return res.status(400).json({
          success: false,
          message: "서비스 이용 동의가 필요합니다.",
        });
      }

      // 사용자 존재 여부 확인
      const existingUser = await getDoc(userDocRef);
      if (existingUser.exists()) {
        // 기존 사용자 데이터 반환 + lastAccessAt 업데이트
        const userData = existingUser.data() as User;
        const now = getKoreanTime();

        // lastAccessAt 업데이트
        await updateDoc(userDocRef, {
          lastAccessAt: now,
        });

        return res.status(200).json({
          success: true,
          message: "기존 사용자로 로그인되었습니다.",
          user: {
            ...userData,
            lastAccessAt: now,
          },
        });
      }
      // 현재 한국 시간
      const now = getKoreanTime();

      // 새 사용자 데이터 (모든 타임스탬프를 string으로 통일)
      const newUserData: User = {
        id: userId,
        gender,
        ageGroup,
        hasConsented,
        createdAt: now,
        lastAccessAt: now,
        completedAt: completedAt ? now : undefined,
        scriptAssignments: [], // 빈 배열로 초기화
      };

      // Firestore에 사용자 생성 (string 타임스탬프로 저장)
      await setDoc(userDocRef, newUserData);

      return res.status(201).json({
        success: true,
        message: "사용자가 성공적으로 등록되었습니다.",
        user: newUserData,
      });
    } else if (req.method === "PATCH") {
      // 🔄 사용자 정보 수정
      console.log("🔄 사용자 정보 수정:", userId);

      // 사용자 존재 여부 확인
      const userSnap = await getDoc(userDocRef);

      if (!userSnap.exists()) {
        return res.status(404).json({
          success: false,
          message: "사용자를 찾을 수 없습니다.",
        });
      }

      const currentUserData = userSnap.data() as User;

      // 현재 한국 시간
      const now = getKoreanTime();

      const updateData: Partial<User> = {
        lastAccessAt: now,
      };

      // 업데이트할 필드들 추가
      const { gender, ageGroup, hasConsented, completedAt, scriptAssignments } =
        req.body;

      if (gender) updateData.gender = gender;
      if (ageGroup) updateData.ageGroup = ageGroup;
      if (hasConsented !== undefined) updateData.hasConsented = hasConsented;
      if (completedAt !== undefined) {
        updateData.completedAt = completedAt ? now : undefined;
      }
      if (scriptAssignments !== undefined) {
        updateData.scriptAssignments = scriptAssignments;
      }

      // Firestore 문서 업데이트
      await updateDoc(userDocRef, updateData);

      // 업데이트된 사용자 데이터 반환 (추가 조회 없이)
      const updatedUserData: User = {
        ...currentUserData,
        ...updateData,
      };

      return res.status(200).json({
        success: true,
        message: "사용자 정보가 수정되었습니다.",
        user: updatedUserData,
      });
    } else {
      // 지원하지 않는 메소드
      res.setHeader("Allow", ["GET", "POST", "PATCH"]);
      return res.status(405).json({
        success: false,
        message: `Method ${req.method} Not Allowed`,
      });
    }
  } catch (error) {
    console.error("🚨 Firestore 오류:", error);

    // Firestore 특정 오류 처리
    if (error instanceof Error) {
      if (error.message.includes("permission-denied")) {
        return res.status(403).json({
          success: false,
          message: "접근 권한이 없습니다.",
        });
      }

      if (error.message.includes("not-found")) {
        return res.status(404).json({
          success: false,
          message: "요청한 데이터를 찾을 수 없습니다.",
        });
      }
    }

    return res.status(500).json({
      success: false,
      message: "서버 오류가 발생했습니다.",
      ...(process.env.NODE_ENV === "development" && {
        error: error instanceof Error ? error.message : "Unknown error",
      }),
    });
  }
}
