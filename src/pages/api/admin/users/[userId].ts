// pages/api/admin/users/[userId].ts - 사용자 삭제 API
import { NextApiRequest, NextApiResponse } from "next";
import {
  doc,
  deleteDoc,
  collection,
  query,
  where,
  getDocs,
  writeBatch,
} from "firebase/firestore";
import { db } from "@/lib/firebase/config";
// import { AudioRecording, Script } from "@/types/firebase";

interface DeleteUserResponse {
  success: boolean;
  message: string;
  details?: {
    deletedUser: boolean;
    deletedRecordings: number;
    deletedScripts: number;
  };
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<DeleteUserResponse>
) {
  const { userId } = req.query;

  if (req.method !== "DELETE") {
    return res.status(405).json({
      success: false,
      message: "Method not allowed",
    });
  }

  if (!userId || typeof userId !== "string") {
    return res.status(400).json({
      success: false,
      message: "사용자 ID가 필요합니다.",
    });
  }

  try {
    console.log(`🗑️ 사용자 삭제 시작: ${userId}`);

    const batch = writeBatch(db);
    let deletedRecordings = 0;
    let deletedScripts = 0;

    // 1. 사용자의 오디오 녹음 삭제
    const audioCollection = collection(db, "audioRecordings");
    const audioQuery = query(audioCollection, where("userId", "==", userId));
    const audioSnapshot = await getDocs(audioQuery);

    console.log(`🎙️ 삭제할 오디오 녹음: ${audioSnapshot.docs.length}개`);

    audioSnapshot.docs.forEach((docSnapshot) => {
      batch.delete(docSnapshot.ref);
      deletedRecordings++;
    });

    // 2. 사용자에게 할당된 스크립트 삭제
    const scriptsCollection = collection(db, "scripts");
    const scriptsQuery = query(
      scriptsCollection,
      where("assignedTo", "==", userId)
    );
    const scriptsSnapshot = await getDocs(scriptsQuery);

    console.log(`📝 삭제할 스크립트: ${scriptsSnapshot.docs.length}개`);

    scriptsSnapshot.docs.forEach((docSnapshot) => {
      batch.delete(docSnapshot.ref);
      deletedScripts++;
    });

    // 3. 배치 커밋 (오디오와 스크립트 삭제)
    await batch.commit();

    // 4. 사용자 문서 삭제 (별도 트랜잭션)
    const userRef = doc(db, "users", userId);
    await deleteDoc(userRef);

    console.log("✅ 사용자 삭제 완료:", {
      userId,
      deletedRecordings,
      deletedScripts,
    });

    return res.status(200).json({
      success: true,
      message: "사용자가 성공적으로 삭제되었습니다.",
      details: {
        deletedUser: true,
        deletedRecordings,
        deletedScripts,
      },
    });
  } catch (error) {
    console.error("❌ 사용자 삭제 실패:", error);
    return res.status(500).json({
      success: false,
      message: "사용자 삭제에 실패했습니다.",
    });
  }
}
