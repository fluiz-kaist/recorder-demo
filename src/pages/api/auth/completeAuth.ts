// pages/api/auth/completeAuth.ts - 새로 생성 (동의 완료 후 쿠키 생성)
import { NextApiRequest, NextApiResponse } from "next";
import { serialize } from "cookie";
import { updateDoc, doc } from "firebase/firestore";
import { db } from "@/lib/firebase/config";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      message: "POST 방식만 지원합니다.",
    });
  }

  const { userId, userHash } = req.body;

  // 입력 검증
  if (!userId) {
    return res.status(400).json({
      success: false,
      message: "사용자 ID가 필요합니다.",
    });
  }

  try {
    console.log(`🍪 쿠키 생성: ${userId}`);

    // 🆕 authorizedUsersV2에 userId 저장
    await updateDoc(doc(db, "authorizedUsersV2", userHash), {
      userId: userId,
      lastLogin: new Date().toISOString(),
    });

    // 쿠키 생성 (동의 완료 후)
    const cookie = serialize("auth-token", userId, {
      httpOnly: false, // 클라이언트에서 접근 가능
      secure: process.env.NODE_ENV === "production", // HTTPS에서만
      sameSite: "lax", // CSRF 공격 방지
      maxAge: 60 * 60 * 24 * 7, // 7일
      path: "/",
    });

    res.setHeader("Set-Cookie", cookie);

    return res.status(200).json({
      success: true,
      message: "인증 완료 - 쿠키 생성됨",
      userId: userId,
    });
  } catch (error) {
    console.error("❌ 쿠키 생성 중 오류:", error);
    return res.status(500).json({
      success: false,
      message: "서버 오류가 발생했습니다.",
    });
  }
}
