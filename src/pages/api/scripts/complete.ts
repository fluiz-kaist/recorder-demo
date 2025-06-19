// pages/api/scripts/complete.ts
import { NextApiRequest, NextApiResponse } from "next";
import {
  doc,
  updateDoc,
  arrayUnion,
  serverTimestamp,
  increment,
} from "firebase/firestore";

import { db } from "@/lib/firebase/config";
import { CompleteScriptRequest } from "@/types/firebase";

interface CompleteScriptResponse {
  success: boolean;
  message?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<CompleteScriptResponse>
) {
  if (req.method !== "POST") {
    return res
      .status(405)
      .json({ success: false, message: "Method not allowed" });
  }

  try {
    const {
      userId,
      scriptId,
      scriptType,
      audioUrl,
      sttText,
    }: CompleteScriptRequest = req.body;

    if (!userId || !scriptId || !scriptType || !audioUrl || !sttText) {
      return res.status(400).json({
        success: false,
        message: "필수 필드가 누락되었습니다.",
      });
    }

    // 1. 사용자 완료 스크립트 목록 업데이트
    const userRef = doc(db, "users", userId);
    const completedField = `completedScripts.${scriptType}`;

    await updateDoc(userRef, {
      [completedField]: arrayUnion(scriptId),
      totalCompleted: increment(1),
      lastAccess: serverTimestamp(),
    });

    // 2. 사용자 진도 업데이트
    const progressRef = doc(db, "users", userId, "progress", scriptId);
    await updateDoc(progressRef, {
      status: "completed",
      recordedAt: serverTimestamp(),
      audioUrl,
      sttText,
    });

    return res.status(200).json({
      success: true,
      message: "스크립트가 성공적으로 완료되었습니다.",
    });
  } catch (error) {
    console.error("Error completing script:", error);
    return res.status(500).json({
      success: false,
      message: "서버 오류가 발생했습니다.",
    });
  }
}
