// pages/api/admin/recordings/download/[recordingId].ts
import { NextApiRequest, NextApiResponse } from "next";
import { adminDb, adminStorage } from "@/lib/firebase/admin";

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

  const audioCollectionName =
    process.env.NEXT_PUBLIC_DB_AUDIO_RECORDINGS_COLLECTION || "recording-temp";

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

    if (!recordingId || typeof recordingId !== "string") {
      return res.status(400).json({
        success: false,
        message: "녹음 ID가 필요합니다.",
      });
    }

    // 녹음 정보 조회 (Firestore Admin SDK)
    const recordingSnap = await adminDb
      .collection(audioCollectionName)
      .doc(recordingId)
      .get();

    if (!recordingSnap.exists) {
      return res.status(404).json({
        success: false,
        message: "녹음을 찾을 수 없습니다.",
      });
    }

    const recordingData = recordingSnap.data();
    const audioUrl = recordingData?.audioUrl;

    if (!audioUrl) {
      return res.status(400).json({
        success: false,
        message: "audioUrl 정보가 없습니다.",
      });
    }

    // audioUrl이 이미 firebase storage 전체 URL인 경우 그대로 리다이렉트
    if (audioUrl.includes("firebasestorage.googleapis.com")) {
      return res.redirect(307, audioUrl);
    }

    // audioUrl이 storage 경로일 경우 → signed URL 생성
    const decodedPath = decodeURIComponent(
      audioUrl.replace(/^.*\/o\//, "").replace(/\?.*$/, "")
    );

    const file = adminStorage.bucket().file(decodedPath);

    const [signedUrl] = await file.getSignedUrl({
      action: "read",
      expires: Date.now() + 10 * 60 * 1000, // 10분 후 만료
    });

    return res.redirect(307, signedUrl);
  } catch (error) {
    console.error("녹음 다운로드 오류:", error);
    return res.status(500).json({
      success: false,
      message: "서버 오류가 발생했습니다.",
    });
  }
}
