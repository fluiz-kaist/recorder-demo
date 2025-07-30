// pages/api/auth/checkAdmin.ts
import { NextApiRequest, NextApiResponse } from "next";
import { verifyAdminToken } from "@/lib/jwt-node";
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
    return res.status(405).json({
      success: false,
      message: "Method not allowed",
    });
  }

  // 쿠키에서 admin-token 확인
  const adminToken = req.cookies["admin-token"];

  console.log("🔍 관리자 토큰 확인:", adminToken ? "있음" : "없음");

  if (!adminToken) {
    return res.status(401).json({
      success: false,
      message: "관리자 토큰이 없습니다.",
    });
  }

  try {
    // JWT 토큰 검증
    const decoded = verifyAdminToken(adminToken);

    if (!decoded) {
      console.log("❌ JWT 토큰 검증 실패");
      return res.status(401).json({
        success: false,
        message: "유효하지 않은 관리자 토큰입니다.",
      });
    }

    console.log("✅ 관리자 확인됨:", decoded.name);

    return res.status(200).json({
      success: true,
      message: "관리자 권한 확인됨",
      admin: {
        adminId: decoded.adminId,
        name: decoded.name,
      },
    });
  } catch (error) {
    console.error("❌ 관리자 권한 확인 중 오류:", error);
    return res.status(500).json({
      success: false,
      message: "서버 오류가 발생했습니다.",
    });
  }
}
