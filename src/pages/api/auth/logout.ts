// pages/api/auth/logout.ts -Firebase 로그아웃 포함
import { NextApiRequest, NextApiResponse } from "next";
import { serialize } from "cookie";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  // 🆕 Firebase Token 쿠키 삭제
  const tokenCookie = serialize("firebase-token", "", {
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });

  res.setHeader("Set-Cookie", [tokenCookie]);

  return res.status(200).json({
    success: true,
    message: "로그아웃 되었습니다.",
  });
}
