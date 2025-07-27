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

    // 🔄 수정: name 대신 문서 ID 사용
    return res.status(200).json({
      success: true,
      message: "관리자 권한 확인됨",
      admin: {
        name: adminDoc.id, // 👈 문서 ID를 name으로 사용
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
