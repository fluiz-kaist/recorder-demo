// pages/api/auth/verifyAdmin.ts

import { NextApiRequest, NextApiResponse } from "next";
import { adminDb } from "@/lib/firebase/admin"; // Admin SDK Firestore 인스턴스
import { serialize } from "cookie";
import { generateAdminToken } from "@/lib/jwt-node";

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

  if (!adminId || !password) {
    return res.status(400).json({
      success: false,
      message: "관리자 ID와 비밀번호를 모두 입력해주세요.",
    });
  }

  try {
    const adminDocRef = adminDb.collection("admin").doc(adminId);

    const adminDoc = await adminDocRef.get();

    console.log("adminDoc?", adminDoc.data());

    if (!adminDoc.exists) {
      return res.status(401).json({
        success: false,
        message: "존재하지 않는 관리자 계정입니다.",
      });
    }

    const adminData = adminDoc.data();

    if (!adminData || adminData.password !== password) {
      return res.status(401).json({
        success: false,
        message: "비밀번호가 올바르지 않습니다.",
      });
    }

    // JWT 토큰 생성
    const jwtToken = generateAdminToken({
      adminId: adminDoc.id,
      name: adminData.name,
    });

    // JWT를 쿠키로 설정
    const cookie = serialize("admin-token", jwtToken, {
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
        adminId: adminDoc.id,
        name: adminData.name,
        token: jwtToken,
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
