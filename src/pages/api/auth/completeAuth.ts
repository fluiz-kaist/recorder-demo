// pages/api/auth/completeAuth.ts - 수정된 버전

import { NextApiRequest, NextApiResponse } from "next";
import { serialize } from "cookie";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "POST 요청만 허용됩니다." });
  }

  try {
    const { userId, userHash } = req.body;

    if (!userId || !userHash) {
      return res.status(400).json({
        message: "userId와 userHash가 필요합니다.",
      });
    }

    // 🔧 쿠키 설정 - userId를 토큰으로 사용
    const cookie = serialize("auth-token", userId, {
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 60 * 60 * 24 * 7, // 7일
      path: "/",
    });

    res.setHeader("Set-Cookie", cookie);

    console.log(`🍪 쿠키 설정 완료 - userId: ${userId}`);
    console.log("🍪 서버에서 쿠키 설정:", { userId, cookie });
    return res.status(200).json({
      message: "인증 완료",
      userId: userId,
    });


  } catch (error) {
    console.error("completeAuth 오류:", error);
    return res.status(500).json({
      message: "서버 오류가 발생했습니다.",
    });
  }
}
