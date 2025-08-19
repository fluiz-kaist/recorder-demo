// pages/api/dev/export-collection.ts
import { NextApiRequest, NextApiResponse } from "next";
import { adminDb } from "@/lib/firebase/admin";
import { isDevelopment } from "@/utils/envConfig";

interface RequestBody {
  collectionName: string;
  limit?: number;
  includeSubcollections?: boolean; // 추가
  startDate?: string; // 추가 (ISO 문자열)
  endDate?: string; // 추가 (ISO 문자열)
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

  const {
    collectionName,
    limit = 100,
    includeSubcollections = false, // 추가
    startDate, // 추가
    endDate, // 추가
  }: RequestBody = req.body;

  if (!collectionName) {
    return res.status(400).json({
      error: "컬렉션 이름이 필요합니다.",
    });
  }

  try {
    console.log(`📥 데이터 Export 시작: ${collectionName} (최대 ${limit}개)`);

    // 쿼리 빌드 부분 수정
    let query: FirebaseFirestore.Query<FirebaseFirestore.DocumentData> =
      adminDb.collection(collectionName);

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
    // 날짜 필터 추가
    if (startDate) {
      query = query.where("uploadedAt", ">=", new Date(startDate));
    }
    if (endDate) {
      query = query.where("uploadedAt", "<", new Date(endDate));
    }

    query = query.limit(limit);

    // 하위 컬렉션 처리 부분을 조건부로 변경
    for (const doc of snapshot.docs) {
      const docData: {
        id: string;
        data: any;
        subcollections?: { [key: string]: any[] }; // optional로 변경
      } = {
        id: doc.id,
        data: doc.data(),
      };

      // 하위 컬렉션 처리를 조건부로
      if (includeSubcollections) {
        docData.subcollections = {};
        const subcollections = await doc.ref.listCollections();
        for (const subcol of subcollections) {
          const subSnapshot = await subcol.get();
          docData.subcollections[subcol.id] = subSnapshot.docs.map(
            (subDoc) => ({
              id: subDoc.id,
              data: subDoc.data(),
            })
          );
        }
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
