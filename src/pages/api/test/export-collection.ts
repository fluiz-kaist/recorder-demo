// pages/api/dev/export-collection.ts
import { NextApiRequest, NextApiResponse } from "next";
import { adminDb } from "@/lib/firebase/admin";
import { isDevelopment } from "@/utils/envConfig";

interface RequestBody {
  collectionName: string;
  limit?: number;
}

interface ResponseData {
  success?: boolean;
  message?: string;
  data?: any[];
  documentCount?: number;
  error?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>
) {
  // 환경 체크
  console.log("응?isDevelopment", isDevelopment());
  if (!isDevelopment()) {
    return res.status(403).json({
      error: "이 기능은 개발 환경에서만 사용할 수 있습니다.",
    });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { collectionName, limit = 100 }: RequestBody = req.body;

  if (!collectionName) {
    return res.status(400).json({
      error: "컬렉션 이름이 필요합니다.",
    });
  }

  try {
    console.log(`📥 데이터 Export 시작: ${collectionName} (최대 ${limit}개)`);

    // 현재 환경의 DB에서 데이터 가져오기 (프로덕션 설정으로 실행시)
    const query = adminDb.collection(collectionName).limit(limit);

    const snapshot = await query.get();

    if (snapshot.empty) {
      console.log("⚠️ Export할 문서가 없습니다.");
      return res.status(200).json({
        success: true,
        message: "Export할 문서가 없습니다.",
        data: [],
        documentCount: 0,
      });
    }

    // 문서 데이터 추출
    const exportedData = [];
    for (const doc of snapshot.docs) {
      const docData: {
        id: string;
        data: any;
        subcollections: { [key: string]: any[] };
      } = {
        id: doc.id,
        data: doc.data(),
        subcollections: {},
      };
      // 하위 컬렉션 가져오기
      const subcollections = await doc.ref.listCollections();
      for (const subcol of subcollections) {
        const subSnapshot = await subcol.get();
        docData.subcollections[subcol.id] = subSnapshot.docs.map((subDoc) => ({
          id: subDoc.id,
          data: subDoc.data(),
        }));
      }

      exportedData.push(docData);
    }

    console.log(`✅ Export 완료: ${exportedData.length}개 문서`);

    return res.status(200).json({
      success: true,
      message: `성공적으로 ${exportedData.length}개 문서를 Export했습니다.`,
      data: exportedData,
      documentCount: exportedData.length,
    });
  } catch (error: any) {
    console.error("❌ Export 실패:", error);
    return res.status(500).json({
      error: `Export 중 오류가 발생했습니다: ${error.message}`,
    });
  }
}
