// pages/api/auth/verifyAuthorizedUser.ts
import { NextApiRequest, NextApiResponse } from "next";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  updateDoc,
  getDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { serialize } from "cookie";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      message: "Method not allowed",
    });
  }

  const { name, socialNumber } = req.body;

  // 입력 검증
  if (!name || !socialNumber) {
    return res.status(400).json({
      success: false,
      message: "이름과 주민번호를 모두 입력해주세요.",
    });
  }

  try {
    // authorizedUsers 컬렉션에서 검색
    const authorizedQuery = query(
      collection(db, "authorizedUsers"),
      where("name", "==", name),
      where("socialNumber", "==", socialNumber)
    );

    const authorizedSnap = await getDocs(authorizedQuery);

    if (authorizedSnap.empty) {
      return res.status(401).json({
        success: false,
        message: "승인되지 않은 사용자입니다.",
      });
    }

    // 문서 정보 가져오기
    const userDoc = authorizedSnap.docs[0];
    const userData = userDoc.data();

    // 이미 userId가 있는지 확인
    let userId = userData.userId;

    if (!userId) {
      // 새로운 userId 생성 (더 안전한 방식)
      userId = `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      // DB에 userId 저장
      await updateDoc(doc(db, "authorizedUsers", userDoc.id), {
        userId: userId,
        lastLogin: new Date().toISOString(),
        createdAt: userData.createdAt || new Date().toISOString(),
      });
    } else {
      // 기존 userId 있으면 lastLogin만 업데이트
      await updateDoc(doc(db, "authorizedUsers", userDoc.id), {
        lastLogin: new Date().toISOString(),
      });
    }

    // users 컬렉션에서 기존 사용자 확인
    const userDocRef = doc(db, "users", userId);
    const existingUserDoc = await getDoc(userDocRef);
    const isExistingUser = existingUserDoc.exists();

    // httpOnly 쿠키 설정
    const cookie = serialize("auth-token", userId, {
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 7일
      path: "/",
    });

    res.setHeader("Set-Cookie", cookie);

    return res.status(200).json({
      success: true,
      message: "인증 성공",
      user: {
        name: userData.name,
        userId: userId,
        isExistingUser: isExistingUser,
        ...(isExistingUser && { existingData: existingUserDoc.data() }),
      },
    });
  } catch (error) {
    console.error("인증 확인 중 오류:", error);
    return res.status(500).json({
      success: false,
      message: "서버 오류가 발생했습니다.",
    });
  }
}
