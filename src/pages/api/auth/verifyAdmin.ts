// pages/api/auth/verifyAdmin.ts
import { NextApiRequest, NextApiResponse } from "next";
import { doc, updateDoc, getDoc } from "firebase/firestore";
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
    // 🔄 수정: 문서 ID로 직접 접근
    const adminDocRef = doc(db, "admin", adminId); // admin/admin 문서
    const adminDoc = await getDoc(adminDocRef);

    if (!adminDoc.exists()) {
      return res.status(401).json({
        success: false,
        message: "존재하지 않는 관리자 계정입니다.",
      });
    }

    const adminData = adminDoc.data();

    // 비밀번호 확인
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
