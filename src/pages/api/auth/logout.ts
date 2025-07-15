import { NextApiRequest, NextApiResponse } from "next";
import { serialize } from "cookie";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  // 쿠키 삭제
  const cookie = serialize("auth-token", "", {
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0, // 즉시 만료
    path: "/",
  });

  res.setHeader("Set-Cookie", cookie);

  return res.status(200).json({
    success: true,
    message: "로그아웃 되었습니다.",
  });
}
