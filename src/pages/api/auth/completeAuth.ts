// pages/api/auth/completeAuth.ts - 수정된 버전 (Custom Token 포함)
import { NextApiRequest, NextApiResponse } from "next";
import { serialize } from "cookie";
import { createCustomToken } from "@/lib/firebase/customToken";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "POST 요청만 허용됩니다." });
  }

  try {
    const { userId, userHash, userName } = req.body;

    if (!userId || !userHash) {
      return res.status(400).json({
        message: "userId와 userHash가 필요합니다.",
      });
    }

    // 🆕 Firebase Custom Token 생성
    const customToken = await createCustomToken(userId, {
      userHash,
      userName: userName || "Unknown",
      role: "user",
      userId,
    });

    // 🆕 Custom Token을 위한 쿠키 추가
    const tokenCookie = serialize("firebase-token", customToken, {
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 60 * 60, // 1시간 (Custom Token은 짧게)
      path: "/",
    });

    res.setHeader("Set-Cookie", [tokenCookie]);

    console.log(`🍪 쿠키 설정 완료 - userId: ${userId}`);
    console.log(`🔥 Firebase Custom Token 생성 완료`);

    return res.status(200).json({
      message: "인증 완료",
      userId: userId,
      customToken: customToken,
    });
  } catch (error) {
    console.error("completeAuth 오류:", error);
    return res.status(500).json({
      message: "서버 오류가 발생했습니다.",
    });
  }
}
