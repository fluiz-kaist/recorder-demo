// pages/api/dev/import-collection.ts
import { NextApiRequest, NextApiResponse } from "next";
import { adminDb } from "@/lib/firebase/admin";
import { isDevelopment } from "@/utils/envConfig";

interface DocumentData {
  id: string;
  data: any;
  subcollections?: { [key: string]: DocumentData[] };
}

interface RequestBody {
  collectionName: string;
  data: DocumentData[];
  overwrite?: boolean;
}

interface ResponseData {
  success?: boolean;
  message?: string;
  importedCount?: number;
  skippedCount?: number;
  importedDocuments?: string[];
  error?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>
) {
  // 환경 체크
  if (!isDevelopment()) {
    return res.status(403).json({
      error: "이 기능은 개발 환경에서만 사용할 수 있습니다.",
    });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { collectionName, data, overwrite = true }: RequestBody = req.body;

  if (!collectionName || !data || !Array.isArray(data)) {
    return res.status(400).json({
      error: "컬렉션 이름과 데이터 배열이 필요합니다.",
    });
  }

  if (data.length === 0) {
    return res.status(400).json({
      error: "Import할 데이터가 없습니다.",
    });
  }

  try {
    console.log(
      `📤 데이터 Import 시작: ${collectionName} (${data.length}개 문서)`
    );

    const importedDocuments: string[] = [];
    let importedCount = 0;
    let skippedCount = 0;

    // 배치 처리를 위한 준비
    const batch = adminDb.batch();
    const BATCH_SIZE = 500;
    let batchCount = 0;

    for (const item of data) {
      // 1. 데이터 유효성 검사
      if (!item.id || !item.data) {
        console.warn(`⚠️ 잘못된 데이터 형식: ${JSON.stringify(item)}`);
        skippedCount++;
        continue;
      }

      // 2. 메인 문서 레퍼런스 생성
      const docRef = adminDb.collection(collectionName).doc(item.id);

      // 3. 덮어쓰기 모드가 아닌 경우 기존 문서 존재 여부 확인
      if (!overwrite) {
        const existingDoc = await docRef.get();
        if (existingDoc.exists) {
          console.log(`⏭️ 문서가 이미 존재함 (스킵): ${item.id}`);
          skippedCount++;
          continue;
        }
      }

      // 4. 메인 문서를 배치에 추가
      batch.set(docRef, item.data);
      batchCount++;

      // 5. 하위 컬렉션 처리 (있는 경우)
      if (item.subcollections) {
        for (const [subcolName, subDocs] of Object.entries(
          item.subcollections
        )) {
          // 각 하위 컬렉션의 문서들 처리
          for (const subDoc of subDocs as any[]) {
            // 하위 문서 레퍼런스 생성
            const subDocRef = docRef.collection(subcolName).doc(subDoc.id);

            // 하위 문서를 배치에 추가
            batch.set(subDocRef, subDoc.data);
            batchCount++;

            // 배치 크기 체크 및 커밋 (하위 컬렉션 처리 중)
            if (batchCount >= BATCH_SIZE) {
              await batch.commit();
              console.log(`📦 하위 컬렉션 배치 커밋: ${batchCount}개 문서`);

              // 새로운 배치 생성
              const newBatch = adminDb.batch();
              Object.assign(batch, newBatch);
              batchCount = 0;
            }
          }
        }
      }

      // 6. 성공적으로 처리된 문서 기록
      importedDocuments.push(item.id);
      importedCount++;

      // 7. 메인 배치 크기 체크 및 커밋
      if (batchCount >= BATCH_SIZE) {
        await batch.commit();
        console.log(`📦 메인 배치 커밋: ${batchCount}개 문서`);

        // 새로운 배치 생성
        const newBatch = adminDb.batch();
        Object.assign(batch, newBatch);
        batchCount = 0;
      }
    }

    // 남은 문서들 커밋
    if (batchCount > 0) {
      await batch.commit();
      console.log(`📦 최종 배치 커밋: ${batchCount}개 문서`);
    }

    console.log(
      `✅ Import 완료: ${importedCount}개 문서 (스킵: ${skippedCount}개)`
    );

    return res.status(200).json({
      success: true,
      message: `성공적으로 ${importedCount}개 문서를 Import했습니다. (스킵: ${skippedCount}개)`,
      importedCount,
      skippedCount,
      importedDocuments,
    });
  } catch (error: any) {
    console.error("❌ Import 실패:", error);
    return res.status(500).json({
      error: `Import 중 오류가 발생했습니다: ${error.message}`,
    });
  }
}
