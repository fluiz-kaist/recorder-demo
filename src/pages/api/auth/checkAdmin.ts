// pages/api/auth/checkAdmin.ts
import { NextApiRequest, NextApiResponse } from "next";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase/config";

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
    // admins 컬렉션에서 세션 토큰으로 검색
    const adminQuery = query(
      collection(db, "admin"),
      where("sessionToken", "==", adminToken)
    );

    const adminSnap = await getDocs(adminQuery);

    if (adminSnap.empty) {
      console.log("❌ 세션 토큰과 일치하는 관리자 없음");
      return res.status(401).json({
        success: false,
        message: "유효하지 않은 관리자 세션입니다.",
      });
    }

    const adminDoc = adminSnap.docs[0];
    const adminData = adminDoc.data();

    console.log("✅ 관리자 확인됨:", adminData.name);

    // 세션 만료 확인 (4시간)
    if (adminData.lastLogin) {
      const lastLogin = new Date(adminData.lastLogin);
      const now = new Date();
      const fourHours = 4 * 60 * 60 * 1000; // 4시간을 밀리초로

      if (now.getTime() - lastLogin.getTime() > fourHours) {
        console.log("⏰ 관리자 세션 만료");
        return res.status(401).json({
          success: false,
          message: "관리자 세션이 만료되었습니다.",
        });
      }
    }

    return res.status(200).json({
      success: true,
      message: "관리자 권한 확인됨",
      admin: {
        name: adminData.name,
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
