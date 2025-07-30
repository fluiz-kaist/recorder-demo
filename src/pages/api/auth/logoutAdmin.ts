// pages/api/auth/logoutAdmin.ts
import { NextApiRequest, NextApiResponse } from "next";
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

  try {
    // 쿠키 삭제 (만료시간을 과거로 설정)
    const cookie = serialize("admin-token", "", {
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 0, // 즉시 만료
      expires: new Date(0), // 과거 날짜로 설정
      path: "/",
    });

    res.setHeader("Set-Cookie", cookie);

    return res.status(200).json({
      success: true,
      message: "로그아웃되었습니다.",
    });
  } catch (error) {
    console.error("관리자 로그아웃 중 오류:", error);
    return res.status(500).json({
      success: false,
      message: "서버 오류가 발생했습니다.",
    });
  }
}
