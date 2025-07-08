// pages/api/admin/clear-all-data.ts - 전체 데이터 삭제 API
import { NextApiRequest, NextApiResponse } from "next";
import { collection, getDocs, writeBatch } from "firebase/firestore";
import { db } from "@/lib/firebase/config";

interface ClearAllDataResponse {
  success: boolean;
  message: string;
  details?: {
    deletedUsers: number;
    deletedRecordings: number;
    deletedScripts: number;
  };
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ClearAllDataResponse>
) {
  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      message: "Method not allowed",
    });
  }

  try {
    console.log("🚨 전체 데이터 삭제 시작 - 위험한 작업!");

    let deletedUsers = 0;
    let deletedRecordings = 0;
    let deletedScripts = 0;

    // 1. 모든 사용자 삭제
    console.log("👥 사용자 데이터 삭제 중...");
    const usersCollection = collection(db, "users");
    const usersSnapshot = await getDocs(usersCollection);

    if (usersSnapshot.docs.length > 0) {
      const usersBatch = writeBatch(db);
      usersSnapshot.docs.forEach((docSnapshot) => {
        usersBatch.delete(docSnapshot.ref);
        deletedUsers++;
      });
      await usersBatch.commit();
    }

    // 2. 모든 오디오 녹음 삭제
    console.log("🎙️ 오디오 녹음 삭제 중...");
    const audioCollection = collection(db, "audioRecordings");
    const audioSnapshot = await getDocs(audioCollection);

    if (audioSnapshot.docs.length > 0) {
      const audioBatch = writeBatch(db);
      audioSnapshot.docs.forEach((docSnapshot) => {
        audioBatch.delete(docSnapshot.ref);
        deletedRecordings++;
      });
      await audioBatch.commit();
    }

    // 3. 모든 스크립트 할당 삭제
    console.log("📝 스크립트 할당 삭제 중...");
    const scriptsCollection = collection(db, "scripts");
    const scriptsSnapshot = await getDocs(scriptsCollection);

    if (scriptsSnapshot.docs.length > 0) {
      const scriptsBatch = writeBatch(db);
      scriptsSnapshot.docs.forEach((docSnapshot) => {
        scriptsBatch.delete(docSnapshot.ref);
        deletedScripts++;
      });
      await scriptsBatch.commit();
    }

    // 4. 기타 컬렉션 정리 (필요한 경우 추가)
    // 예: scriptUsage, systemLogs 등

    console.log("✅ 전체 데이터 삭제 완료:", {
      deletedUsers,
      deletedRecordings,
      deletedScripts,
    });

    return res.status(200).json({
      success: true,
      message: "모든 데이터가 성공적으로 삭제되었습니다.",
      details: {
        deletedUsers,
        deletedRecordings,
        deletedScripts,
      },
    });
  } catch (error) {
    console.error("❌ 전체 데이터 삭제 실패:", error);
    return res.status(500).json({
      success: false,
      message: "전체 데이터 삭제에 실패했습니다.",
    });
  }
}
