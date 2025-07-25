// pages/api/audio/recordings/index.ts - 녹음 기록 조회 API

import { NextApiRequest, NextApiResponse } from "next";
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
} from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { AudioRecording } from "@/types/audio";

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

  try {
    const { userId, taskType, domain, limit: queryLimit } = req.query;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "userId는 필수입니다.",
      });
    }

    // 기본 쿼리 구성
    let q = query(
      collection(db, "audioRecordings"),
      where("userId", "==", userId as string),
      orderBy("recordedAt", "desc")
    );

    // 필터 적용
    if (taskType) {
      q = query(q, where("taskType", "==", taskType));
    }

    if (domain) {
      q = query(q, where("textData.domain", "==", domain));
    }

    if (queryLimit) {
      const limitNum = parseInt(queryLimit as string, 10);
      if (!isNaN(limitNum) && limitNum > 0) {
        q = query(q, limit(limitNum));
      }
    }

    const querySnapshot = await getDocs(q);
    const recordings = querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as AudioRecording[];

    return res.status(200).json({
      success: true,
      recordings,
      total: recordings.length,
    });
  } catch (error) {
    console.error("녹음 기록 조회 중 오류:", error);
    return res.status(500).json({
      success: false,
      message: "녹음 기록 조회 중 오류가 발생했습니다.",
    });
  }
}
