// pages/api/auth/verifyAdmin.ts
import { NextApiRequest, NextApiResponse } from "next";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  updateDoc,
  //   getDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { serialize } from "cookie";
// import bcrypt from "bcryptjs";

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

  const { adminId, password } = req.body;

  // 입력 검증
  if (!adminId || !password) {
    return res.status(400).json({
      success: false,
      message: "관리자 ID와 비밀번호를 모두 입력해주세요.",
    });
  }

  try {
    // admins 컬렉션에서 name으로 검색
    const adminQuery = query(
      collection(db, "admin"),
      where("name", "==", adminId) // adminId를 name 필드로 사용
    );

    const adminSnap = await getDocs(adminQuery);

    if (adminSnap.empty) {
      return res.status(401).json({
        success: false,
        message: "존재하지 않는 관리자 계정입니다.",
      });
    }

    // 문서 정보 가져오기
    const adminDoc = adminSnap.docs[0];
    const adminData = adminDoc.data();

    // 비밀번호 확인 (평문 비교 - 간단한 구현)
    if (adminData.password !== password) {
      return res.status(401).json({
        success: false,
        message: "비밀번호가 올바르지 않습니다.",
      });
    }

    // 세션 토큰 생성
    const sessionToken = `admin-${Date.now()}-${Math.random()
      .toString(36)
      .substr(2, 9)}`;

    // 관리자 문서에 세션 토큰 저장
    await updateDoc(doc(db, "admin", adminDoc.id), {
      sessionToken: sessionToken,
      lastLogin: new Date().toISOString(),
    });

    // httpOnly 쿠키 설정 (관리자용)
    const cookie = serialize("admin-token", sessionToken, {
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 4, // 4시간
      path: "/",
    });

    res.setHeader("Set-Cookie", cookie);

    return res.status(200).json({
      success: true,
      message: "관리자 인증 성공",
      admin: {
        name: adminData.name,
        sessionToken: sessionToken,
        lastLogin: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("관리자 인증 중 오류:", error);
    return res.status(500).json({
      success: false,
      message: "서버 오류가 발생했습니다.",
    });
  }
}
