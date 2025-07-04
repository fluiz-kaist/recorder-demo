// pages/api/auth/verifyAuthorizedUser.ts
import { NextApiRequest, NextApiResponse } from "next";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase/config";

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

  const { name, socialNumber } = req.body;

  // 입력 검증
  if (!name || !socialNumber) {
    return res.status(400).json({
      success: false,
      message: "이름과 주민번호를 모두 입력해주세요.",
    });
  }

  try {
    // authorizedUsers 컬렉션에서 검색
    const authorizedQuery = query(
      collection(db, "authorizedUsers"),
      where("name", "==", name),
      where("socialNumber", "==", socialNumber)
    );

    const authorizedSnap = await getDocs(authorizedQuery);

    if (authorizedSnap.empty) {
      return res.status(401).json({
        success: false,
        message: "승인되지 않은 사용자입니다.",
      });
    }

    // 인증 성공 - 새 userId 생성
    const userId = `user-${Date.now()}`;

    return res.status(200).json({
      success: true,
      message: "인증 성공",
      userId,
      name, // 이름도 함께 반환
    });
  } catch (error) {
    console.error("인증 확인 중 오류:", error);
    return res.status(500).json({
      success: false,
      message: "서버 오류가 발생했습니다.",
    });
  }
}
