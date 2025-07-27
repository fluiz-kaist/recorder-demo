// pages/api/admin/recordings/download/[recordingId].ts
import { NextApiRequest, NextApiResponse } from "next";
import { doc, getDoc } from "firebase/firestore";
import { ref, getDownloadURL } from "firebase/storage";
import { db, storage } from "@/lib/firebase/config";

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
    // 관리자 권한 확인
    const adminToken = req.cookies["admin-token"];
    if (!adminToken) {
      return res.status(401).json({
        success: false,
        message: "관리자 권한이 필요합니다.",
      });
    }

    const { recordingId } = req.query;

    if (!recordingId) {
      return res.status(400).json({
        success: false,
        message: "녹음 ID가 필요합니다.",
      });
    }

    // 녹음 정보 조회
    const recordingDoc = await getDoc(
      doc(db, "audioRecordingsV2", recordingId as string)
    );

    if (!recordingDoc.exists()) {
      return res.status(404).json({
        success: false,
        message: "녹음을 찾을 수 없습니다.",
      });
    }

    const recordingData = recordingDoc.data();

    // Firebase Storage에서 직접 다운로드 URL 생성
    try {
      const audioRef = ref(storage, recordingData.audioUrl);
      const downloadUrl = await getDownloadURL(audioRef);

      // 다운로드 URL로 리다이렉트
      res.redirect(307, downloadUrl);
    } catch (storageError) {
      console.error("Storage 접근 오류:", storageError);

      // 이미 다운로드 URL인 경우 그대로 리다이렉트
      if (recordingData.audioUrl.includes("firebasestorage.googleapis.com")) {
        res.redirect(307, recordingData.audioUrl);
      } else {
        return res.status(500).json({
          success: false,
          message: "오디오 파일에 접근할 수 없습니다.",
        });
      }
    }
  } catch (error) {
    console.error("녹음 다운로드 오류:", error);
    return res.status(500).json({
      success: false,
      message: "서버 오류가 발생했습니다.",
    });
  }
}
