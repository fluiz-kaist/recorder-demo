// pages/api/user/get-user.ts

import { NextApiRequest, NextApiResponse } from "next";
import { adminDb } from "@/lib/firebase/admin"; // Admin SDK용 Firestore 인스턴스 import

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const userCollectionName =
    process.env.NEXT_PUBLIC_DB_USER_COLLECTION || "users-temp";

  const { userId } = req.query;
  const authToken = req.cookies["auth-token"];

  // 쿠키 인증 확인
  if (!authToken) {
    return res.status(401).json({
      success: false,
      message: "인증이 필요합니다.",
    });
  }

  // 본인 정보만 조회 가능하도록 체크
  if (authToken !== userId) {
    return res.status(403).json({
      success: false,
      message: "접근 권한이 없습니다.",
    });
  }

  try {
    // Admin SDK를 통해 사용자 문서 조회
    const userDoc = await adminDb
      .collection(userCollectionName)
      .doc(userId as string)
      .get();

    if (!userDoc.exists) {
      return res.status(404).json({
        success: false,
        message: "사용자를 찾을 수 없습니다.",
      });
    }

    const userData = userDoc.data();

    return res.status(200).json({
      success: true,
      user: userData,
    });
  } catch (error) {
    console.error("사용자 정보 조회 오류:", error);
    return res.status(500).json({
      success: false,
      message: "서버 오류가 발생했습니다.",
    });
  }
}
