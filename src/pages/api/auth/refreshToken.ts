// pages/api/auth/refreshToken.ts - Claims 기반 최적화 버전
import { NextApiRequest, NextApiResponse } from "next";
import { serialize } from "cookie";
import { createCustomToken } from "@/lib/firebase/customToken";
import { getDocByIdAdmin } from "@/lib/firebase/firestoreAdmin";
import { adminAuth } from "@/lib/firebase/admin";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "POST 요청만 허용됩니다." });
  }

  try {
    const firebaseToken = req.cookies["firebase-token"];

    if (!firebaseToken) {
      return res.status(401).json({
        success: false,
        message: "Firebase 토큰이 필요합니다.",
      });
    }

    // 🔥 Firebase Token 검증 및 Claims 추출
    let decodedToken;
    try {
      decodedToken = await adminAuth.verifyIdToken(firebaseToken);
    } catch (tokenError) {
      console.error("Firebase 토큰 검증 실패:", tokenError);
      return res.status(401).json({
        success: false,
        message: "유효하지 않은 Firebase 토큰입니다.",
      });
    }

    // 🚀 Claims에서 필요한 정보 추출 (DB 조회 없이!)
    const { userId, userHash, userName, role } = decodedToken;

    // 필수 정보가 없다면 DB에서 다시 조회 (fallback)
    let userData = null;
    if (!userId || !userHash || !userName) {
      console.log("Claims 정보 부족, DB에서 조회...");
      const userCollectionName =
        process.env.NEXT_PUBLIC_DB_USER_COLLECTION || "users-temp";
      userData = await getDocByIdAdmin(userCollectionName, decodedToken.uid);

      if (!userData) {
        return res.status(404).json({
          success: false,
          message: "사용자를 찾을 수 없습니다.",
        });
      }
    }

    // 🎯 최신 정보로 새 Custom Token 생성
    const customToken = await createCustomToken(
      userId || userData?.id || decodedToken.uid,
      {
        userHash: userHash || userData?.authorizedUserId,
        userName: userName || userData?.userName || "Unknown",
        role: role || userData?.role || "user",
        userId: userId || userData?.id || decodedToken.uid,
      }
    );

    // 🍪 Custom Token 쿠키 갱신
    const tokenCookie = serialize("firebase-token", customToken, {
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 60 * 60, // 1시간
      path: "/",
    });

    res.setHeader("Set-Cookie", tokenCookie);

    return res.status(200).json({
      success: true,
      customToken: customToken,
      user: {
        uid: decodedToken.uid,
        userId: userId || userData?.id,
        userName: userName || userData?.userName,
        role: role || userData?.role || "user",
      },
    });
  } catch (error) {
    console.error("Firebase 토큰 갱신 오류:", error);
    return res.status(500).json({
      success: false,
      message: "토큰 갱신에 실패했습니다.",
    });
  }
}
